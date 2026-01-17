-- Add cost tracking to inventory table
ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS cost_per_gram NUMERIC(10, 4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS supplier TEXT,
ADD COLUMN IF NOT EXISTS reorder_point INTEGER DEFAULT 2500,
ADD COLUMN IF NOT EXISTS last_restock_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_cost ON inventory(cost_per_gram);
CREATE INDEX IF NOT EXISTS idx_inventory_reorder ON inventory(reorder_point);

-- Update existing products with estimated costs (can be adjusted later)
-- Assuming avg cost of $0.02 per gram ($10/lb)
UPDATE inventory
SET cost_per_gram = 0.02
WHERE cost_per_gram = 0;

COMMENT ON COLUMN inventory.cost_per_gram IS 'Cost per gram in USD';
COMMENT ON COLUMN inventory.reorder_point IS 'Minimum stock level in grams before reorder alert';
