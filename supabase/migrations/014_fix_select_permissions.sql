-- Ensure Inventory is readable by everyone (or at least authenticated users)
-- This fixes the issue where the dropdown appears empty due to RLS blocking the SELECT query.

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON inventory
    FOR SELECT
    USING (true);

-- Also ensure Customers are readable for the dropdown
CREATE POLICY "Enable read access for all users" ON customers
    FOR SELECT
    USING (true);
