-- Create sales tables to support the transactional RPC
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES inventory(product_id),
    unit TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price_per_unit NUMERIC(10, 2) NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL
);
