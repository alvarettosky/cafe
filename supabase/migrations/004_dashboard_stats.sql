-- Function to get consolidated dashboard stats
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_inventory_grams INTEGER;
    v_sales_today NUMERIC(10,2);
    v_low_stock_count INTEGER;
    v_roasted_coffee_lbs NUMERIC(10,2);
BEGIN
    -- 1. Total Inventory (Grams)
    SELECT COALESCE(SUM(total_grams_available), 0)
    INTO v_total_inventory_grams
    FROM inventory;

    -- 2. Sales Today (Sum of total_amount for records created today)
    -- Using CURRENT_DATE to assume server time match, ideally convert to timezone if needed
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_sales_today
    FROM sales
    WHERE created_at >= CURRENT_DATE;

    -- 3. Low Stock Alerts (Items with < 5 lbs i.e., 2500g, arbitrary threshold for demo)
    SELECT COUNT(*)
    INTO v_low_stock_count
    FROM inventory
    WHERE total_grams_available < 2500;

    -- 4. Specific 'Roasted Coffee' Stat (Assuming we want to sum coffee that contains 'Tostado' in name)
    -- Just an example metric, converting grams to lbs (approx / 453.59)
    SELECT COALESCE(SUM(total_grams_available), 0) / 500.0 -- Using 500g = 1lb simplified for this domain
    INTO v_roasted_coffee_lbs
    FROM inventory
    WHERE product_name ILIKE '%Tostado%';

    RETURN jsonb_build_object(
        'total_inventory_grams', v_total_inventory_grams,
        'sales_today', v_sales_today,
        'low_stock_count', v_low_stock_count,
        'roasted_coffee_lbs', v_roasted_coffee_lbs
    );
END;
$$;
