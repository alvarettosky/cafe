-- Update function to accept payment method
CREATE OR REPLACE FUNCTION process_coffee_sale(
    p_customer_id UUID,
    p_items JSONB,
    p_created_at TIMESTAMPTZ DEFAULT NOW(),
    p_payment_method TEXT DEFAULT 'Efectivo' -- New parameter
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item JSONB;
    v_product_id UUID;
    v_unit TEXT;
    v_quantity INTEGER;
    v_grams_per_unit INTEGER;
    v_total_grams_needed INTEGER;
    v_current_stock INTEGER;
    v_new_stock INTEGER;
    v_sale_id UUID;
    v_price_per_unit NUMERIC(10,2);
    v_item_total_price NUMERIC(10,2);
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_unit := v_item->>'unit';
        v_quantity := (v_item->>'quantity')::INTEGER;
        
        -- Determine grams per unit
        IF v_unit = 'libra' THEN
            v_grams_per_unit := 500;
        ELSIF v_unit = 'media_libra' THEN
            v_grams_per_unit := 250;
        ELSE
            RAISE EXCEPTION 'Invalid unit: %. Must be "libra" or "media_libra".', v_unit;
        END IF;
        
        v_total_grams_needed := v_grams_per_unit * v_quantity;
        
        -- Lock & Check stock
        SELECT total_grams_available INTO v_current_stock
        FROM inventory
        WHERE product_id = v_product_id
        FOR UPDATE;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product % not found.', v_product_id;
        END IF;
        
        IF v_current_stock < v_total_grams_needed THEN
            RAISE EXCEPTION 'Insufficient stock. Requested: %g, Available: %g', v_total_grams_needed, v_current_stock;
        END IF;
        
        -- Update stock
        UPDATE inventory
        SET total_grams_available = v_current_stock - v_total_grams_needed,
            last_updated = NOW()
        WHERE product_id = v_product_id;

        -- Create sale record if not exists
        IF v_sale_id IS NULL THEN
            INSERT INTO sales (customer_id, total_amount, created_at, payment_method)
            VALUES (p_customer_id, 0, p_created_at, p_payment_method)
            RETURNING id INTO v_sale_id;
        END IF;

        v_price_per_unit := COALESCE((v_item->>'price')::NUMERIC, 0);
        v_item_total_price := v_price_per_unit * v_quantity;

        -- Insert item
        INSERT INTO sale_items (sale_id, product_id, unit, quantity, price_per_unit, total_price)
        VALUES (v_sale_id, v_product_id, v_unit, v_quantity, v_price_per_unit, v_item_total_price);

        -- Update total
        UPDATE sales SET total_amount = total_amount + v_item_total_price WHERE id = v_sale_id;
        
    END LOOP;

    RETURN jsonb_build_object('success', true, 'message', 'Sale processed', 'sale_id', v_sale_id);

EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$;
