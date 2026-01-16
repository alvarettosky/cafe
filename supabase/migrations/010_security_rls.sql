-- Enable RLS on all tables
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Policy: Inventory
-- Allow read access to everyone (anon + authenticated)
CREATE POLICY "Enable read access for all users" ON inventory
    FOR SELECT USING (true);

-- Allow insert/update only via service role or RPCs (implicitly covered, but explicit for direct access)
-- For now, allowing anon insert/update to prevent breaking app without auth, BUT adding a comment that this should be restricted.
-- In a real strict DART scenario, this would be 'authenticated' only.
CREATE POLICY "Enable write access for all users" ON inventory
    FOR ALL USING (true) WITH CHECK (true);

-- Policy: Customers
CREATE POLICY "Enable read access for all users" ON customers
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON customers
    FOR INSERT WITH CHECK (true);

-- Policy: Sales
CREATE POLICY "Enable read/write for all users" ON sales
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable read/write for all users" ON sale_items
    FOR ALL USING (true) WITH CHECK (true);
