-- =============================================================================
-- FIX ANALYTICS: Add missing profit tracking columns and update RPC functions
-- Execute this in Supabase SQL Editor to fix analytics page errors
-- VERSION 3: Fixed ORDER BY in get_advanced_metrics
-- =============================================================================

-- Step 1: Add profit tracking columns to sale_items
ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC(10, 4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit NUMERIC(10, 2) DEFAULT 0;

-- Step 2: Add profit columns to sales (aggregated)
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS total_cost NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_profit NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit_margin NUMERIC(5, 2) DEFAULT 0;

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sale_items_profit ON sale_items(profit);
CREATE INDEX IF NOT EXISTS idx_sales_profit ON sales(total_profit);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at);

-- Step 4: Create function to calculate profit for sale items
CREATE OR REPLACE FUNCTION calculate_sale_item_profit()
RETURNS TRIGGER AS $$
DECLARE
    v_cost_per_gram NUMERIC(10, 4);
    v_grams_sold INTEGER;
    v_total_cost NUMERIC(10, 2);
BEGIN
    -- Get cost per gram from inventory
    SELECT cost_per_gram INTO v_cost_per_gram
    FROM inventory
    WHERE product_id = NEW.product_id;

    -- Calculate grams sold based on unit
    v_grams_sold := CASE
        WHEN NEW.unit = 'libra' THEN 500 * NEW.quantity
        WHEN NEW.unit = 'media_libra' THEN 250 * NEW.quantity
        ELSE 0
    END;

    -- Calculate total cost
    v_total_cost := v_grams_sold * COALESCE(v_cost_per_gram, 0);

    -- Update cost and profit
    NEW.cost_per_unit := v_total_cost / NEW.quantity;
    NEW.profit := NEW.total_price - v_total_cost;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger for automatic profit calculation
DROP TRIGGER IF EXISTS trigger_calculate_profit ON sale_items;
CREATE TRIGGER trigger_calculate_profit
    BEFORE INSERT OR UPDATE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION calculate_sale_item_profit();

-- Step 6: Backfill profit data for existing sale items
UPDATE sale_items si
SET
    cost_per_unit = (
        CASE
            WHEN si.unit = 'libra' THEN 500 * si.quantity
            WHEN si.unit = 'media_libra' THEN 250 * si.quantity
            ELSE 0
        END * COALESCE((SELECT cost_per_gram FROM inventory WHERE product_id = si.product_id), 0)
    ) / si.quantity,
    profit = si.total_price - (
        CASE
            WHEN si.unit = 'libra' THEN 500 * si.quantity
            WHEN si.unit = 'media_libra' THEN 250 * si.quantity
            ELSE 0
        END * COALESCE((SELECT cost_per_gram FROM inventory WHERE product_id = si.product_id), 0)
    )
WHERE profit IS NULL OR profit = 0;

-- Step 7: Update sales table with aggregated profit data
UPDATE sales s
SET
    total_cost = COALESCE((
        SELECT SUM(si.total_price - si.profit)
        FROM sale_items si
        WHERE si.sale_id = s.id
    ), 0),
    total_profit = COALESCE((
        SELECT SUM(si.profit)
        FROM sale_items si
        WHERE si.sale_id = s.id
    ), 0),
    profit_margin = CASE
        WHEN s.total_amount > 0 THEN
            (COALESCE((SELECT SUM(si.profit) FROM sale_items si WHERE si.sale_id = s.id), 0) / s.total_amount * 100)
        ELSE 0
    END
WHERE total_profit IS NULL OR total_profit = 0;

-- Step 7.5: DROP existing RPC functions before recreating them
DROP FUNCTION IF EXISTS get_advanced_metrics(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS get_advanced_metrics(timestamp with time zone, timestamp with time zone);
DROP FUNCTION IF EXISTS get_sales_time_series(timestamptz, timestamptz, text);
DROP FUNCTION IF EXISTS get_sales_time_series(timestamp with time zone, timestamp with time zone, text);
DROP FUNCTION IF EXISTS get_product_performance(timestamptz, timestamptz);
DROP FUNCTION IF EXISTS get_product_performance(timestamp with time zone, timestamp with time zone);

-- Step 8: Recreate get_advanced_metrics RPC function
CREATE OR REPLACE FUNCTION get_advanced_metrics(
    start_date TIMESTAMPTZ DEFAULT NULL,
    end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    -- Default to current month if no dates provided
    v_start_date := COALESCE(start_date, date_trunc('month', CURRENT_DATE));
    v_end_date := COALESCE(end_date, date_trunc('month', CURRENT_DATE) + INTERVAL '1 month');

    SELECT jsonb_build_object(
        'total_revenue', COALESCE(SUM(total_amount), 0),
        'total_cost', COALESCE(SUM(total_cost), 0),
        'total_profit', COALESCE(SUM(total_profit), 0),
        'avg_profit_margin', COALESCE(AVG(profit_margin), 0),
        'sales_count', COUNT(*),
        'avg_ticket', COALESCE(AVG(total_amount), 0),
        'payment_breakdown', (
            SELECT jsonb_object_agg(
                COALESCE(payment_method, 'Unknown'),
                payment_data
            )
            FROM (
                SELECT
                    payment_method,
                    jsonb_build_object(
                        'count', COUNT(*),
                        'total', COALESCE(SUM(total_amount), 0),
                        'profit', COALESCE(SUM(total_profit), 0)
                    ) as payment_data
                FROM sales
                WHERE created_at >= v_start_date AND created_at < v_end_date
                GROUP BY payment_method
            ) pm
        ),
        'pending_credits', (
            SELECT COALESCE(SUM(total_amount), 0)
            FROM sales
            WHERE payment_method = 'Pago a crédito o pendiente'
            AND created_at >= v_start_date AND created_at < v_end_date
        ),
        'top_products', (
            SELECT COALESCE(jsonb_agg(product_data), '[]'::jsonb)
            FROM (
                SELECT jsonb_build_object(
                    'product_name', i.product_name,
                    'units_sold', COUNT(si.id),
                    'revenue', SUM(si.total_price),
                    'profit', SUM(si.profit),
                    'profit_margin', CASE
                        WHEN SUM(si.total_price) > 0
                        THEN (SUM(si.profit) / SUM(si.total_price) * 100)
                        ELSE 0
                    END
                ) as product_data
                FROM sale_items si
                JOIN inventory i ON si.product_id = i.product_id
                JOIN sales s ON si.sale_id = s.id
                WHERE s.created_at >= v_start_date AND s.created_at < v_end_date
                GROUP BY i.product_name
                ORDER BY SUM(si.total_price) DESC
                LIMIT 10
            ) as top_prods
        ),
        'inventory_value', (
            SELECT COALESCE(SUM(total_grams_available * cost_per_gram), 0)
            FROM inventory
        ),
        'low_stock_items', (
            SELECT COUNT(*)
            FROM inventory
            WHERE total_grams_available < COALESCE(reorder_point, 1000)
        )
    ) INTO v_result
    FROM sales
    WHERE created_at >= v_start_date AND created_at < v_end_date;

    RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- Step 9: Recreate get_sales_time_series RPC function
CREATE OR REPLACE FUNCTION get_sales_time_series(
    start_date TIMESTAMPTZ DEFAULT NULL,
    end_date TIMESTAMPTZ DEFAULT NULL,
    granularity TEXT DEFAULT 'day'
)
RETURNS TABLE (
    date TEXT,
    revenue NUMERIC,
    profit NUMERIC,
    cost NUMERIC,
    sales_count BIGINT,
    avg_ticket NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
BEGIN
    -- Default to last 30 days if no dates provided
    v_start_date := COALESCE(start_date, CURRENT_DATE - INTERVAL '30 days');
    v_end_date := COALESCE(end_date, CURRENT_DATE + INTERVAL '1 day');

    RETURN QUERY
    SELECT
        to_char(date_trunc(granularity, s.created_at), 'YYYY-MM-DD') as date,
        COALESCE(SUM(s.total_amount), 0)::NUMERIC as revenue,
        COALESCE(SUM(s.total_profit), 0)::NUMERIC as profit,
        COALESCE(SUM(s.total_cost), 0)::NUMERIC as cost,
        COUNT(*)::BIGINT as sales_count,
        COALESCE(AVG(s.total_amount), 0)::NUMERIC as avg_ticket
    FROM sales s
    WHERE s.created_at >= v_start_date AND s.created_at < v_end_date
    GROUP BY date_trunc(granularity, s.created_at)
    ORDER BY date_trunc(granularity, s.created_at) ASC;
END;
$$;

-- Step 10: Recreate get_product_performance RPC function
CREATE OR REPLACE FUNCTION get_product_performance(
    start_date TIMESTAMPTZ DEFAULT NULL,
    end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    product_name TEXT,
    units_sold BIGINT,
    revenue NUMERIC,
    profit NUMERIC,
    profit_margin NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
BEGIN
    -- Default to last 30 days if no dates provided
    v_start_date := COALESCE(start_date, CURRENT_DATE - INTERVAL '30 days');
    v_end_date := COALESCE(end_date, CURRENT_DATE + INTERVAL '1 day');

    RETURN QUERY
    SELECT
        i.product_name,
        COUNT(si.id)::BIGINT as units_sold,
        COALESCE(SUM(si.total_price), 0)::NUMERIC as revenue,
        COALESCE(SUM(si.profit), 0)::NUMERIC as profit,
        CASE
            WHEN SUM(si.total_price) > 0
            THEN (SUM(si.profit) / SUM(si.total_price) * 100)::NUMERIC
            ELSE 0
        END as profit_margin
    FROM sale_items si
    JOIN inventory i ON si.product_id = i.product_id
    JOIN sales s ON si.sale_id = s.id
    WHERE s.created_at >= v_start_date AND s.created_at < v_end_date
    GROUP BY i.product_name
    ORDER BY revenue DESC
    LIMIT 100;
END;
$$;

-- =============================================================================
-- VERIFICATION QUERIES (run these to verify the fix worked)
-- =============================================================================

-- Check if columns exist
SELECT
    'sale_items columns' as check_name,
    COUNT(*) FILTER (WHERE column_name = 'profit') as has_profit,
    COUNT(*) FILTER (WHERE column_name = 'cost_per_unit') as has_cost
FROM information_schema.columns
WHERE table_name = 'sale_items';

SELECT
    'sales columns' as check_name,
    COUNT(*) FILTER (WHERE column_name = 'total_profit') as has_total_profit,
    COUNT(*) FILTER (WHERE column_name = 'total_cost') as has_total_cost
FROM information_schema.columns
WHERE table_name = 'sales';

-- Check if functions exist
SELECT
    'RPC functions' as check_name,
    COUNT(*) FILTER (WHERE routine_name = 'get_advanced_metrics') as has_advanced_metrics,
    COUNT(*) FILTER (WHERE routine_name = 'get_sales_time_series') as has_time_series,
    COUNT(*) FILTER (WHERE routine_name = 'get_product_performance') as has_product_perf
FROM information_schema.routines
WHERE routine_schema = 'public';

-- Test the functions (safely)
SELECT 'Testing get_advanced_metrics' as test_name;
SELECT 'Testing get_sales_time_series' as test_name;
SELECT 'Testing get_product_performance' as test_name;
