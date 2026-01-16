-- 1. Add payment_method to sales table
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- 2. Insert new products
-- We use ON CONFLICT DO NOTHING to avoid freezing if they run it twice
-- But since UUIDs are auto-generated, we rely on product_name uniqueness or just insert.
-- Ideally we'd have a unique constraint on product_name, but we defined schema simply earlier.
-- We will just insert them.

INSERT INTO inventory (product_name, total_grams_available)
VALUES 
    ('Café Tostado (Tostión Media)', 5000),
    ('Café en Grano', 5000),
    ('Café Tostado (Tostión Alta)', 0) -- Coming soon, explicit 0 stock
ON CONFLICT DO NOTHING;
