-- Migration: Time Series Data RPCs
-- Task 5: Create RPC functions for chart data
-- This creates:
-- 1. get_sales_time_series() - Daily/weekly/monthly revenue/profit trends
-- 2. get_product_performance() - Product metrics over specified period

-- Time series function for revenue/profit charts
-- Supports daily, weekly, or monthly grouping
CREATE OR REPLACE FUNCTION get_sales_time_series(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_interval TEXT DEFAULT 'daily'  -- 'daily', 'weekly', 'monthly'
)
RETURNS TABLE (
    period_start TIMESTAMPTZ,
    period_label TEXT,
    revenue NUMERIC,
    cost NUMERIC,
    profit NUMERIC,
    profit_margin NUMERIC,
    sales_count BIGINT,
    avg_ticket NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
    v_trunc_format TEXT;
BEGIN
    -- Default to last 30 days if no dates provided
    v_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
    v_end_date := COALESCE(p_end_date, CURRENT_DATE + INTERVAL '1 day');

    -- Validate interval parameter
    IF p_interval NOT IN ('daily', 'weekly', 'monthly') THEN
        RAISE EXCEPTION 'Invalid interval. Must be daily, weekly, or monthly';
    END IF;

    -- Set truncation format based on interval
    v_trunc_format := CASE p_interval
        WHEN 'daily' THEN 'day'
        WHEN 'weekly' THEN 'week'
        WHEN 'monthly' THEN 'month'
    END;

    RETURN QUERY
    WITH time_periods AS (
        SELECT
            date_trunc(v_trunc_format, s.created_at) as period_start,
            s.total_amount,
            s.total_cost,
            s.total_profit
        FROM sales s
        WHERE s.created_at >= v_start_date
          AND s.created_at < v_end_date
    )
    SELECT
        tp.period_start,
        -- Format label based on interval
        CASE p_interval
            WHEN 'daily' THEN to_char(tp.period_start, 'YYYY-MM-DD')
            WHEN 'weekly' THEN to_char(tp.period_start, 'YYYY-MM-DD') || ' (Week)'
            WHEN 'monthly' THEN to_char(tp.period_start, 'YYYY-MM')
        END as period_label,
        COALESCE(SUM(tp.total_amount), 0)::NUMERIC as revenue,
        COALESCE(SUM(tp.total_cost), 0)::NUMERIC as cost,
        COALESCE(SUM(tp.total_profit), 0)::NUMERIC as profit,
        CASE
            WHEN SUM(tp.total_amount) > 0
            THEN (SUM(tp.total_profit) / SUM(tp.total_amount) * 100)::NUMERIC
            ELSE 0
        END as profit_margin,
        COUNT(*)::BIGINT as sales_count,
        COALESCE(AVG(tp.total_amount), 0)::NUMERIC as avg_ticket
    FROM time_periods tp
    GROUP BY tp.period_start
    ORDER BY tp.period_start ASC;
END;
$$;

COMMENT ON FUNCTION get_sales_time_series IS 'Returns time series data for revenue/profit charts with daily, weekly, or monthly grouping';

-- Product performance analysis function
-- Returns detailed metrics for each product over a specified period
CREATE OR REPLACE FUNCTION get_product_performance(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_limit INT DEFAULT NULL
)
RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    units_sold BIGINT,
    revenue NUMERIC,
    cost NUMERIC,
    profit NUMERIC,
    profit_margin NUMERIC,
    avg_price_per_unit NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
    v_limit INT;
BEGIN
    -- Default to last 30 days if no dates provided
    v_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
    v_end_date := COALESCE(p_end_date, CURRENT_DATE + INTERVAL '1 day');
    v_limit := COALESCE(p_limit, 100); -- Default to top 100 products

    RETURN QUERY
    SELECT
        i.product_id,
        i.product_name,
        COUNT(si.id)::BIGINT as units_sold,
        COALESCE(SUM(si.total_price), 0)::NUMERIC as revenue,
        COALESCE(SUM(si.total_price - si.profit), 0)::NUMERIC as cost,
        COALESCE(SUM(si.profit), 0)::NUMERIC as profit,
        CASE
            WHEN SUM(si.total_price) > 0
            THEN (SUM(si.profit) / SUM(si.total_price) * 100)::NUMERIC
            ELSE 0
        END as profit_margin,
        COALESCE(AVG(si.price_per_unit), 0)::NUMERIC as avg_price_per_unit
    FROM sale_items si
    JOIN inventory i ON si.product_id = i.product_id
    JOIN sales s ON si.sale_id = s.id
    WHERE s.created_at >= v_start_date
      AND s.created_at < v_end_date
    GROUP BY i.product_id, i.product_name
    ORDER BY revenue DESC
    LIMIT v_limit;
END;
$$;

COMMENT ON FUNCTION get_product_performance IS 'Returns product performance metrics including units sold, revenue, profit, and margins for specified period';
