-- Migration: Update process_coffee_sale RPC with Profit Tracking
-- Task 3: Update the main RPC function to calculate and store profit information
-- This updates the existing process_coffee_sale function to:
-- 1. Calculate item costs based on inventory.cost_per_gram
-- 2. Calculate item profits (price - cost)
-- 3. Aggregate total_cost, total_profit for the entire sale
-- 4. Calculate profit_margin percentage
-- 5. Return profit information in the response

-- Update process_coffee_sale to calculate and store profits
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
    v_total_amount NUMERIC(10, 2) := 0;
    v_total_cost NUMERIC(10, 2) := 0;
    v_total_profit NUMERIC(10, 2) := 0;
    v_grams_to_deduct INTEGER;
    v_cost_per_gram NUMERIC(10, 4);
    v_item_cost NUMERIC(10, 2);
    v_item_profit NUMERIC(10, 2);
BEGIN
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
        -- Calculate grams to deduct
        v_grams_to_deduct := CASE
            WHEN v_item->>'unit' = 'libra' THEN 500 * (v_item->>'quantity')::INTEGER
            WHEN v_item->>'unit' = 'media_libra' THEN 250 * (v_item->>'quantity')::INTEGER
            ELSE 0
        END;

        -- Get cost per gram for profit calculation
        SELECT cost_per_gram INTO v_cost_per_gram
        FROM inventory
        WHERE product_id = (v_item->>'product_id')::UUID;

        -- Calculate item cost and profit
        v_item_cost := v_grams_to_deduct * COALESCE(v_cost_per_gram, 0);
        v_item_profit := (v_item->>'price')::NUMERIC - v_item_cost;

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
            (v_item->>'product_id')::UUID,
            v_item->>'unit',
            (v_item->>'quantity')::INTEGER,
            (v_item->>'price')::NUMERIC / (v_item->>'quantity')::INTEGER,
            (v_item->>'price')::NUMERIC
        );

        -- Update inventory
        UPDATE inventory
        SET total_grams_available = total_grams_available - v_grams_to_deduct,
            last_updated = NOW()
        WHERE product_id = (v_item->>'product_id')::UUID;

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
