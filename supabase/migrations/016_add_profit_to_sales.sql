-- Migration: Add profit calculation to sale items
-- Task 2 of Advanced Metrics Dashboard
-- This migration adds profit tracking columns and automatic calculation via trigger

-- Add profit tracking to sale_items
ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC(10, 4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit NUMERIC(10, 2) DEFAULT 0;

-- Add profit column to sales (aggregated)
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS total_cost NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_profit NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit_margin NUMERIC(5, 2) DEFAULT 0;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sale_items_profit ON sale_items(profit);
CREATE INDEX IF NOT EXISTS idx_sales_profit ON sales(total_profit);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at);

-- Create function to calculate profit for a sale item
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

    -- Calculate grams sold
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

-- Create trigger
DROP TRIGGER IF EXISTS trigger_calculate_profit ON sale_items;
CREATE TRIGGER trigger_calculate_profit
    BEFORE INSERT OR UPDATE ON sale_items
    FOR EACH ROW
    EXECUTE FUNCTION calculate_sale_item_profit();

COMMENT ON FUNCTION calculate_sale_item_profit() IS 'Auto-calculates profit when sale item is created/updated';
