-- ============================================================================
-- Migration 023b: Actualizar RPC process_coffee_sale con registro Kardex
-- ============================================================================
-- Propósito: Modificar el RPC de ventas para registrar movimientos de
-- inventario en la tabla inventory_movements (Kardex).
--
-- Dependencia: Ejecutar DESPUÉS de 023_inventory_kardex.sql
-- ============================================================================

-- Primero, modificamos el trigger para que NO se dispare durante operaciones
-- del RPC (evita duplicados). Usamos una session variable.

CREATE OR REPLACE FUNCTION record_inventory_adjustment()
RETURNS TRIGGER AS $$
BEGIN
    -- NO registrar si la operación viene del RPC de ventas
    -- El RPC usa SET LOCAL para indicar que es una operación de venta
    IF current_setting('app.is_sale_operation', true) = 'true' THEN
        RETURN NEW;
    END IF;

    -- Solo registrar si hay cambio real en el stock
    IF OLD.total_grams_available IS DISTINCT FROM NEW.total_grams_available THEN
        INSERT INTO inventory_movements (
            product_id,
            movement_type,
            quantity_grams,
            stock_before,
            stock_after,
            reference_type,
            reason,
            performed_by
        ) VALUES (
            NEW.product_id,
            'adjustment',
            NEW.total_grams_available - OLD.total_grams_available,
            OLD.total_grams_available,
            NEW.total_grams_available,
            'manual',
            'Ajuste directo desde gestión de inventario',
            auth.uid()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Actualizar RPC process_coffee_sale con registro de movimientos
-- ============================================================================

CREATE OR REPLACE FUNCTION process_coffee_sale(
    p_customer_id UUID,
    p_items JSONB,
    p_created_at TIMESTAMPTZ DEFAULT NULL,
    p_payment_method TEXT DEFAULT 'Efectivo'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sale_id UUID;
    v_item JSONB;
    v_product_id UUID;
    v_total_amount NUMERIC(10, 2) := 0;
    v_total_cost NUMERIC(10, 2) := 0;
    v_total_profit NUMERIC(10, 2) := 0;
    v_grams_to_deduct INTEGER;
    v_cost_per_gram NUMERIC(10, 4);
    v_item_cost NUMERIC(10, 2);
    v_item_profit NUMERIC(10, 2);
    v_current_stock INTEGER;
BEGIN
    -- Marcar que es una operación de venta (evita duplicados en trigger)
    PERFORM set_config('app.is_sale_operation', 'true', true);

    -- Create sale record
    INSERT INTO sales (customer_id, created_at, payment_method)
    VALUES (
        p_customer_id,
        COALESCE(p_created_at, NOW()),
        p_payment_method
    )
    RETURNING id INTO v_sale_id;

    -- Process each item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;

        -- Calculate grams to deduct
        v_grams_to_deduct := CASE
            WHEN v_item->>'unit' = 'libra' THEN 500 * (v_item->>'quantity')::INTEGER
            WHEN v_item->>'unit' = 'media_libra' THEN 250 * (v_item->>'quantity')::INTEGER
            ELSE 0
        END;

        -- Get current stock and cost per gram (with lock)
        SELECT total_grams_available, cost_per_gram
        INTO v_current_stock, v_cost_per_gram
        FROM inventory
        WHERE product_id = v_product_id
        FOR UPDATE;

        -- Validate sufficient stock
        IF v_current_stock < v_grams_to_deduct THEN
            RAISE EXCEPTION 'Stock insuficiente para producto %. Disponible: %g, Requerido: %g',
                v_product_id, v_current_stock, v_grams_to_deduct;
        END IF;

        -- Calculate item cost and profit
        v_item_cost := v_grams_to_deduct * COALESCE(v_cost_per_gram, 0);
        v_item_profit := (v_item->>'price')::NUMERIC - v_item_cost;

        -- === REGISTRO EN KARDEX ===
        -- Registrar movimiento de tipo 'sale' ANTES de actualizar inventory
        INSERT INTO inventory_movements (
            product_id,
            movement_type,
            quantity_grams,
            stock_before,
            stock_after,
            reference_id,
            reference_type,
            reason,
            unit_cost,
            performed_by
        ) VALUES (
            v_product_id,
            'sale',
            -v_grams_to_deduct,  -- Negativo porque es salida
            v_current_stock,
            v_current_stock - v_grams_to_deduct,
            v_sale_id,
            'sale',
            'Venta procesada',
            v_cost_per_gram,
            auth.uid()
        );

        -- Insert sale item (trigger will calculate profit)
        INSERT INTO sale_items (
            sale_id,
            product_id,
            unit,
            quantity,
            price_per_unit,
            total_price
        ) VALUES (
            v_sale_id,
            v_product_id,
            v_item->>'unit',
            (v_item->>'quantity')::INTEGER,
            (v_item->>'price')::NUMERIC / (v_item->>'quantity')::INTEGER,
            (v_item->>'price')::NUMERIC
        );

        -- Update inventory (trigger NO se dispara por app.is_sale_operation)
        UPDATE inventory
        SET total_grams_available = total_grams_available - v_grams_to_deduct,
            last_updated = NOW()
        WHERE product_id = v_product_id;

        -- Accumulate totals
        v_total_amount := v_total_amount + (v_item->>'price')::NUMERIC;
        v_total_cost := v_total_cost + v_item_cost;
        v_total_profit := v_total_profit + v_item_profit;
    END LOOP;

    -- Update sale totals with profit info
    UPDATE sales
    SET total_amount = v_total_amount,
        total_cost = v_total_cost,
        total_profit = v_total_profit,
        profit_margin = CASE
            WHEN v_total_amount > 0 THEN (v_total_profit / v_total_amount) * 100
            ELSE 0
        END
    WHERE id = v_sale_id;

    RETURN jsonb_build_object(
        'sale_id', v_sale_id,
        'total_amount', v_total_amount,
        'total_profit', v_total_profit,
        'profit_margin', CASE
            WHEN v_total_amount > 0 THEN (v_total_profit / v_total_amount) * 100
            ELSE 0
        END
    );
END;
$$;

-- ============================================================================
-- Función helper para registrar reposición de inventario
-- ============================================================================
CREATE OR REPLACE FUNCTION restock_inventory(
    p_product_id UUID,
    p_quantity_grams INTEGER,
    p_unit_cost NUMERIC(10, 4) DEFAULT NULL,
    p_batch_number VARCHAR(50) DEFAULT NULL,
    p_reason TEXT DEFAULT 'Reposición de inventario'
)
RETURNS UUID AS $$
DECLARE
    v_current_stock INTEGER;
    v_movement_id UUID;
BEGIN
    -- Get current stock with lock
    SELECT total_grams_available INTO v_current_stock
    FROM inventory
    WHERE product_id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto % no encontrado', p_product_id;
    END IF;

    -- Marcar como operación de restock (evita trigger duplicado)
    PERFORM set_config('app.is_sale_operation', 'true', true);

    -- Register movement
    INSERT INTO inventory_movements (
        product_id,
        movement_type,
        quantity_grams,
        stock_before,
        stock_after,
        reference_type,
        reason,
        unit_cost,
        batch_number,
        performed_by
    ) VALUES (
        p_product_id,
        'restock',
        p_quantity_grams,  -- Positivo porque es entrada
        v_current_stock,
        v_current_stock + p_quantity_grams,
        'purchase_order',
        p_reason,
        p_unit_cost,
        p_batch_number,
        auth.uid()
    ) RETURNING id INTO v_movement_id;

    -- Update inventory
    UPDATE inventory
    SET total_grams_available = total_grams_available + p_quantity_grams,
        last_updated = NOW(),
        last_restock_date = NOW(),
        cost_per_gram = COALESCE(p_unit_cost, cost_per_gram)
    WHERE product_id = p_product_id;

    RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION restock_inventory IS 'Registra reposición de inventario con movimiento en kardex';

-- ============================================================================
-- Función helper para registrar merma/pérdida
-- ============================================================================
CREATE OR REPLACE FUNCTION register_inventory_loss(
    p_product_id UUID,
    p_quantity_grams INTEGER,
    p_reason TEXT
)
RETURNS UUID AS $$
DECLARE
    v_current_stock INTEGER;
    v_movement_id UUID;
BEGIN
    IF p_reason IS NULL OR p_reason = '' THEN
        RAISE EXCEPTION 'Se requiere una razón para registrar merma';
    END IF;

    -- Get current stock with lock
    SELECT total_grams_available INTO v_current_stock
    FROM inventory
    WHERE product_id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto % no encontrado', p_product_id;
    END IF;

    IF v_current_stock < p_quantity_grams THEN
        RAISE EXCEPTION 'No se puede registrar merma mayor al stock actual. Stock: %g, Merma: %g',
            v_current_stock, p_quantity_grams;
    END IF;

    -- Marcar como operación especial
    PERFORM set_config('app.is_sale_operation', 'true', true);

    -- Register movement
    INSERT INTO inventory_movements (
        product_id,
        movement_type,
        quantity_grams,
        stock_before,
        stock_after,
        reference_type,
        reason,
        performed_by
    ) VALUES (
        p_product_id,
        'loss',
        -p_quantity_grams,  -- Negativo porque es salida
        v_current_stock,
        v_current_stock - p_quantity_grams,
        'manual',
        p_reason,
        auth.uid()
    ) RETURNING id INTO v_movement_id;

    -- Update inventory
    UPDATE inventory
    SET total_grams_available = total_grams_available - p_quantity_grams,
        last_updated = NOW()
    WHERE product_id = p_product_id;

    RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION register_inventory_loss IS 'Registra merma o pérdida de inventario con movimiento en kardex';

-- Permisos
GRANT EXECUTE ON FUNCTION restock_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION register_inventory_loss TO authenticated;
