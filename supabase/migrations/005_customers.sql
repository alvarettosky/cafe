-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert a default 'Guest' customer for anonymous sales
INSERT INTO customers (id, full_name, phone)
VALUES ('00000000-0000-0000-0000-000000000000', 'Cliente General', 'N/A')
ON CONFLICT (id) DO NOTHING;

-- Optional: Add index for search
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(full_name);
