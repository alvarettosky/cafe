-- Update process_coffee_sale RPC to accept customer_recurrence_days parameter

DROP FUNCTION IF EXISTS process_coffee_sale(UUID, JSONB, TIMESTAMPTZ, TEXT, INTEGER);
DROP FUNCTION IF EXISTS process_coffee_sale(UUID, JSONB, TIMESTAMPTZ, TEXT);

CREATE OR REPLACE FUNCTION process_coffee_sale(
    p_customer_id UUID,
    p_items JSONB,
    p_created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    p_payment_method TEXT DEFAULT 'Efectivo',
    p_customer_recurrence_days INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sale_id UUID;
    v_item JSONB;
    v_product_id UUID;
    v_unit TEXT;
    v_quantity NUMERIC;
    v_price NUMERIC;
    v_total_amount NUMERIC := 0;
    v_total_cost NUMERIC := 0;
    v_total_profit NUMERIC := 0;
    v_cost_per_unit NUMERIC;
    v_item_profit NUMERIC;
BEGIN
    -- Create sale record with recurrence
    INSERT INTO sales (
        customer_id,
        total_amount,
        payment_method,
        created_at,
        customer_recurrence_days
    ) VALUES (
        p_customer_id,
        0,
        p_payment_method,
        p_created_at,
        p_customer_recurrence_days
    ) RETURNING id INTO v_sale_id;

    -- Process each item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_unit := v_item->>'unit';
        v_quantity := (v_item->>'quantity')::NUMERIC;
        v_price := (v_item->>'price')::NUMERIC;

        -- Get cost per unit from inventory
        SELECT
            CASE
                WHEN v_unit = 'kg' THEN cost_per_kg
                ELSE cost_per_unit
            END INTO v_cost_per_unit
        FROM inventory
        WHERE product_id = v_product_id;

        -- Calculate item profit
        v_item_profit := (v_price - COALESCE(v_cost_per_unit, 0)) * v_quantity;

        -- Insert sale item
        INSERT INTO sale_items (
            sale_id,
            product_id,
            quantity,
            unit,
            unit_price,
            total_price,
            cost_per_unit,
            profit
        ) VALUES (
            v_sale_id,
            v_product_id,
            v_quantity,
            v_unit,
            v_price,
            v_price * v_quantity,
            v_cost_per_unit,
            v_item_profit
        );

        -- Update inventory
        IF v_unit = 'kg' THEN
            UPDATE inventory
            SET
                stock_kg = stock_kg - v_quantity,
                updated_at = CURRENT_TIMESTAMP
            WHERE product_id = v_product_id;
        ELSE
            UPDATE inventory
            SET
                stock_units = stock_units - v_quantity,
                updated_at = CURRENT_TIMESTAMP
            WHERE product_id = v_product_id;
        END IF;

        -- Accumulate totals
        v_total_amount := v_total_amount + (v_price * v_quantity);
        v_total_cost := v_total_cost + (COALESCE(v_cost_per_unit, 0) * v_quantity);
    END LOOP;

    -- Calculate total profit
    v_total_profit := v_total_amount - v_total_cost;

    -- Update sales record with totals
    UPDATE sales
    SET
        total_amount = v_total_amount,
        total_cost = v_total_cost,
        total_profit = v_total_profit,
        profit_margin = CASE
            WHEN v_total_amount > 0 THEN (v_total_profit / v_total_amount * 100)
            ELSE 0
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_sale_id;

    RETURN v_sale_id;
END;
$$;
