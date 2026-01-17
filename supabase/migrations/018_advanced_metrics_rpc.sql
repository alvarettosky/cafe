-- Migration: Advanced Metrics RPC
-- Task 4: Create comprehensive analytics function for dashboard
-- This creates get_advanced_metrics() which returns:
-- 1. Revenue metrics (total revenue, cost, profit, avg margin)
-- 2. Sales metrics (count, avg ticket)
-- 3. Payment method breakdown (count, total, profit per method)
-- 4. Pending credits total
-- 5. Top 10 products by revenue
-- 6. Inventory status (value, low stock count)

-- Advanced dashboard metrics with profit analysis
CREATE OR REPLACE FUNCTION get_advanced_metrics(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
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
    -- Default to current day if no dates provided
    v_start_date := COALESCE(p_start_date, CURRENT_DATE);
    v_end_date := COALESCE(p_end_date, CURRENT_DATE + INTERVAL '1 day');

    SELECT jsonb_build_object(
        -- Revenue metrics
        'total_revenue', COALESCE(SUM(total_amount), 0),
        'total_cost', COALESCE(SUM(total_cost), 0),
        'total_profit', COALESCE(SUM(total_profit), 0),
        'avg_profit_margin', COALESCE(AVG(profit_margin), 0),
        'sales_count', COUNT(*),
        'avg_ticket', COALESCE(AVG(total_amount), 0),

        -- Payment method breakdown
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

        -- Pending credits
        'pending_credits', (
            SELECT COALESCE(SUM(total_amount), 0)
            FROM sales
            WHERE payment_method = 'Pago a crédito o pendiente'
            AND created_at >= v_start_date AND created_at < v_end_date
        ),

        -- Top products
        'top_products', (
            SELECT jsonb_agg(product_data ORDER BY revenue DESC)
            FROM (
                SELECT
                    i.product_name,
                    COUNT(si.id) as units_sold,
                    SUM(si.total_price) as revenue,
                    SUM(si.profit) as profit
                FROM sale_items si
                JOIN inventory i ON si.product_id = i.product_id
                JOIN sales s ON si.sale_id = s.id
                WHERE s.created_at >= v_start_date AND s.created_at < v_end_date
                GROUP BY i.product_name
                ORDER BY revenue DESC
                LIMIT 10
            ) as product_data
        ),

        -- Inventory status
        'inventory_value', (
            SELECT COALESCE(SUM(total_grams_available * cost_per_gram), 0)
            FROM inventory
        ),
        'low_stock_items', (
            SELECT COUNT(*)
            FROM inventory
            WHERE total_grams_available < reorder_point
        )

    ) INTO v_result
    FROM sales
    WHERE created_at >= v_start_date AND created_at < v_end_date;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_advanced_metrics IS 'Comprehensive metrics including profit, payments, top products for specified date range';
