-- Create inventory table
CREATE TABLE IF NOT EXISTS inventory (
    product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_name TEXT NOT NULL,
    total_grams_available INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT positive_stock CHECK (total_grams_available >= 0)
);

-- Index for performance on locking
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id);
