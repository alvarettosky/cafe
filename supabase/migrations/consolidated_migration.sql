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
-- Create a function to process coffee sales transactionally
CREATE OR REPLACE FUNCTION process_coffee_sale(
    p_customer_id UUID,
    p_items JSONB -- Array of objects: [{"product_id": "...", "unit": "libra"|"media_libra", "quantity": 1, "price": 10.50}]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item JSONB;
    v_product_id UUID;
    v_unit TEXT;
    v_quantity INTEGER;
    v_grams_per_unit INTEGER;
    v_total_grams_needed INTEGER;
    v_current_stock INTEGER;
    v_new_stock INTEGER;
    v_sale_id UUID;
    v_price_per_unit NUMERIC(10,2);
    v_item_total_price NUMERIC(10,2);
BEGIN
    -- Start transaction automatically in PL/PGSQL functions

    -- Create sale record (assuming sales table exists, otherwise simplified for inventory focus)
    -- For this specific task, we focus on inventory integrity.
    
    -- Iterate through items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_unit := v_item->>'unit';
        v_quantity := (v_item->>'quantity')::INTEGER;
        
        -- Determine grams per unit
        IF v_unit = 'libra' THEN
            v_grams_per_unit := 500;
        ELSIF v_unit = 'media_libra' THEN
            v_grams_per_unit := 250;
        ELSE
            RAISE EXCEPTION 'Invalid unit: %. Must be "libra" or "media_libra".', v_unit;
        END IF;
        
        v_total_grams_needed := v_grams_per_unit * v_quantity;
        
        -- Lock the inventory row for update
        SELECT total_grams_available INTO v_current_stock
        FROM inventory
        WHERE product_id = v_product_id
        FOR UPDATE;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product % not found in inventory.', v_product_id;
        END IF;
        
        -- Check sufficient stock
        IF v_current_stock < v_total_grams_needed THEN
            RAISE EXCEPTION 'Insufficient stock for product %. Requested: %g, Available: %g', 
                v_product_id, v_total_grams_needed, v_current_stock;
        END IF;
        
        -- Update stock
        v_new_stock := v_current_stock - v_total_grams_needed;
        
        UPDATE inventory
        SET total_grams_available = v_new_stock,
            last_updated = NOW()
        WHERE product_id = v_product_id;

        -- Record sale item
        -- Create sale record if not exists (simple logic: one sale per RPC call)
        IF v_sale_id IS NULL THEN
            INSERT INTO sales (customer_id, total_amount)
            VALUES (p_customer_id, 0) -- Update total later
            RETURNING id INTO v_sale_id;
        END IF;

        v_price_per_unit := COALESCE((v_item->>'price')::NUMERIC, 0);
        v_item_total_price := v_price_per_unit * v_quantity;

        -- Insert item
        INSERT INTO sale_items (sale_id, product_id, unit, quantity, price_per_unit, total_price)
        VALUES (
            v_sale_id,
            v_product_id,
            v_unit,
            v_quantity,
            v_price_per_unit, 
            v_item_total_price
        );

        -- Update total sale amount
        UPDATE sales 
        SET total_amount = total_amount + v_item_total_price 
        WHERE id = v_sale_id;
        
    END LOOP;

    -- For this specific task focused on INVENTORY, we have handled the critical section.
    -- The prompt asked specifically for "Prevent negative inventory".
    -- The transactional nature is satisfied by the PL/pgSQL block.

    RETURN jsonb_build_object('success', true, 'message', 'Sale processed successfully', 'sale_id', v_sale_id);

EXCEPTION
    WHEN OTHERS THEN
        -- Transaction is rolled back automatically by raising exception
        RAISE;
END;
$$;
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
-- Semilla de datos iniciales para Café Palestina

-- Insertar productos básicos si no existen
INSERT INTO inventory (product_name, total_grams_available)
VALUES 
    ('Café Tostado (Grano)', 5000),  -- 10 Libras aprox
    ('Café Molido Medio', 2500)      -- 5 Libras aprox
ON CONFLICT DO NOTHING;

-- Nota: En un escenario real, querrás guardar los IDs generados para usarlos en el frontend.
-- Puedes consultarlos con: SELECT * FROM inventory;
-- Function to get consolidated dashboard stats
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_inventory_grams INTEGER;
    v_sales_today NUMERIC(10,2);
    v_low_stock_count INTEGER;
    v_roasted_coffee_lbs NUMERIC(10,2);
BEGIN
    -- 1. Total Inventory (Grams)
    SELECT COALESCE(SUM(total_grams_available), 0)
    INTO v_total_inventory_grams
    FROM inventory;

    -- 2. Sales Today (Sum of total_amount for records created today)
    -- Using CURRENT_DATE to assume server time match, ideally convert to timezone if needed
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_sales_today
    FROM sales
    WHERE created_at >= CURRENT_DATE;

    -- 3. Low Stock Alerts (Items with < 5 lbs i.e., 2500g, arbitrary threshold for demo)
    SELECT COUNT(*)
    INTO v_low_stock_count
    FROM inventory
    WHERE total_grams_available < 2500;

    -- 4. Specific 'Roasted Coffee' Stat (Assuming we want to sum coffee that contains 'Tostado' in name)
    -- Just an example metric, converting grams to lbs (approx / 453.59)
    SELECT COALESCE(SUM(total_grams_available), 0) / 500.0 -- Using 500g = 1lb simplified for this domain
    INTO v_roasted_coffee_lbs
    FROM inventory
    WHERE product_name ILIKE '%Tostado%';

    RETURN jsonb_build_object(
        'total_inventory_grams', v_total_inventory_grams,
        'sales_today', v_sales_today,
        'low_stock_count', v_low_stock_count,
        'roasted_coffee_lbs', v_roasted_coffee_lbs
    );
END;
$$;
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
-- Update function to accept custom date for sales
CREATE OR REPLACE FUNCTION process_coffee_sale(
    p_customer_id UUID,
    p_items JSONB, -- Array of objects: [{"product_id": "...", "unit": "libra"|"media_libra", "quantity": 1, "price": 10.50}]
    p_created_at TIMESTAMPTZ DEFAULT NOW() -- New optional parameter for custom dates
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item JSONB;
    v_product_id UUID;
    v_unit TEXT;
    v_quantity INTEGER;
    v_grams_per_unit INTEGER;
    v_total_grams_needed INTEGER;
    v_current_stock INTEGER;
    v_new_stock INTEGER;
    v_sale_id UUID;
    v_price_per_unit NUMERIC(10,2);
    v_item_total_price NUMERIC(10,2);
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_unit := v_item->>'unit';
        v_quantity := (v_item->>'quantity')::INTEGER;
        
        -- Determine grams per unit
        IF v_unit = 'libra' THEN
            v_grams_per_unit := 500;
        ELSIF v_unit = 'media_libra' THEN
            v_grams_per_unit := 250;
        ELSE
            RAISE EXCEPTION 'Invalid unit: %. Must be "libra" or "media_libra".', v_unit;
        END IF;
        
        v_total_grams_needed := v_grams_per_unit * v_quantity;
        
        -- Lock the inventory row for update
        SELECT total_grams_available INTO v_current_stock
        FROM inventory
        WHERE product_id = v_product_id
        FOR UPDATE;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product % not found in inventory.', v_product_id;
        END IF;
        
        -- Check sufficient stock
        IF v_current_stock < v_total_grams_needed THEN
            RAISE EXCEPTION 'Insufficient stock for product %. Requested: %g, Available: %g', 
                v_product_id, v_total_grams_needed, v_current_stock;
        END IF;
        
        -- Update stock
        v_new_stock := v_current_stock - v_total_grams_needed;
        
        UPDATE inventory
        SET total_grams_available = v_new_stock,
            last_updated = NOW()
        WHERE product_id = v_product_id;

        -- Create sale record if not exists
        IF v_sale_id IS NULL THEN
            INSERT INTO sales (customer_id, total_amount, created_at)
            VALUES (p_customer_id, 0, p_created_at) -- Use the provided date
            RETURNING id INTO v_sale_id;
        END IF;

        v_price_per_unit := COALESCE((v_item->>'price')::NUMERIC, 0);
        v_item_total_price := v_price_per_unit * v_quantity;

        -- Insert item
        INSERT INTO sale_items (sale_id, product_id, unit, quantity, price_per_unit, total_price)
        VALUES (
            v_sale_id,
            v_product_id,
            v_unit,
            v_quantity,
            v_price_per_unit, 
            v_item_total_price
        );

        -- Update total sale amount
        UPDATE sales 
        SET total_amount = total_amount + v_item_total_price 
        WHERE id = v_sale_id;
        
    END LOOP;

    RETURN jsonb_build_object('success', true, 'message', 'Sale processed successfully', 'sale_id', v_sale_id);

EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$;
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
-- Update function to accept payment method
CREATE OR REPLACE FUNCTION process_coffee_sale(
    p_customer_id UUID,
    p_items JSONB,
    p_created_at TIMESTAMPTZ DEFAULT NOW(),
    p_payment_method TEXT DEFAULT 'Efectivo' -- New parameter
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item JSONB;
    v_product_id UUID;
    v_unit TEXT;
    v_quantity INTEGER;
    v_grams_per_unit INTEGER;
    v_total_grams_needed INTEGER;
    v_current_stock INTEGER;
    v_new_stock INTEGER;
    v_sale_id UUID;
    v_price_per_unit NUMERIC(10,2);
    v_item_total_price NUMERIC(10,2);
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_unit := v_item->>'unit';
        v_quantity := (v_item->>'quantity')::INTEGER;
        
        -- Determine grams per unit
        IF v_unit = 'libra' THEN
            v_grams_per_unit := 500;
        ELSIF v_unit = 'media_libra' THEN
            v_grams_per_unit := 250;
        ELSE
            RAISE EXCEPTION 'Invalid unit: %. Must be "libra" or "media_libra".', v_unit;
        END IF;
        
        v_total_grams_needed := v_grams_per_unit * v_quantity;
        
        -- Lock & Check stock
        SELECT total_grams_available INTO v_current_stock
        FROM inventory
        WHERE product_id = v_product_id
        FOR UPDATE;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product % not found.', v_product_id;
        END IF;
        
        IF v_current_stock < v_total_grams_needed THEN
            RAISE EXCEPTION 'Insufficient stock. Requested: %g, Available: %g', v_total_grams_needed, v_current_stock;
        END IF;
        
        -- Update stock
        UPDATE inventory
        SET total_grams_available = v_current_stock - v_total_grams_needed,
            last_updated = NOW()
        WHERE product_id = v_product_id;

        -- Create sale record if not exists
        IF v_sale_id IS NULL THEN
            INSERT INTO sales (customer_id, total_amount, created_at, payment_method)
            VALUES (p_customer_id, 0, p_created_at, p_payment_method)
            RETURNING id INTO v_sale_id;
        END IF;

        v_price_per_unit := COALESCE((v_item->>'price')::NUMERIC, 0);
        v_item_total_price := v_price_per_unit * v_quantity;

        -- Insert item
        INSERT INTO sale_items (sale_id, product_id, unit, quantity, price_per_unit, total_price)
        VALUES (v_sale_id, v_product_id, v_unit, v_quantity, v_price_per_unit, v_item_total_price);

        -- Update total
        UPDATE sales SET total_amount = total_amount + v_item_total_price WHERE id = v_sale_id;
        
    END LOOP;

    RETURN jsonb_build_object('success', true, 'message', 'Sale processed', 'sale_id', v_sale_id);

EXCEPTION
    WHEN OTHERS THEN
        RAISE;
END;
$$;
-- Add address column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;
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
-- Create a table for public profiles linked to auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'seller' CHECK (role IN ('admin', 'seller')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Allow admins to read all profiles
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow users to update their own profile (e.g. name)
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- TRIGGER: Automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', 'seller');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- UPDATE INVENTORY POLICIES (Admin Only for Write)
DROP POLICY IF EXISTS "Enable write access for all users" ON inventory;

CREATE POLICY "Admins can insert inventory" ON inventory
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update inventory" ON inventory
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete inventory" ON inventory
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- UPDATE SALES POLICIES
-- Only authenticated users can insert sales (Sellers and Admins)
DROP POLICY IF EXISTS "Enable read/write for all users" ON sales;

CREATE POLICY "Authenticated users can insert sales" ON sales
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Users can see their own sales, Admins can see all
CREATE POLICY "Users see own sales, Admins see all" ON sales
  FOR SELECT USING (
    auth.uid() = customer_id -- Assuming customer_id links to auth.users? Wait, sales.customer_id connects to `customers` table, NOT auth.users usually in this schema.
    -- Correction: "Vendedores por ahora no firman las ventas con su ID", they create sales for "Customers".
    -- Requirement: "Los demás vendedores del proyecto podrán ingresar/editar/eliminar ventas".
    -- So any authenticated user can CRUD sales.
    OR
    EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Let's simplify Sales to "Employees can do everything on sales" since it's a shared POS usually?
-- Or strictly:
CREATE POLICY "Employees can CRUD sales" ON sales
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Employees can CRUD sale items" ON sale_items
  FOR ALL USING (auth.role() = 'authenticated');

-- Allow admins to also manage customers specifically if needed, but 'employees' usually manage customers.
DROP POLICY IF EXISTS "Enable insert access for all users" ON customers;
CREATE POLICY "Employees can manage customers" ON customers
  FOR ALL USING (auth.role() = 'authenticated');
-- Utility Script: Auto-confirm test user and make Admin
-- Run this in Supabase SQL Editor to skip manual configuration steps.

-- 1. Confirm Email
-- FIXED: Set confirmation_token to empty string '' instead of NULL to avoid scan errors
UPDATE auth.users
SET email_confirmed_at = NOW(),
    confirmation_token = ''
WHERE email = 'vendedor-test@cafe.com';

-- 2. Make Admin
UPDATE public.profiles
SET role = 'admin'
WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'vendedor-test@cafe.com'
);

-- 3. (Optional) Create profile if trigger failed for some reason
INSERT INTO public.profiles (id, full_name, role)
SELECT id, 'Vendedor Test', 'admin'
FROM auth.users
WHERE email = 'vendedor-test@cafe.com'
AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.users.id);
-- CRITICAL FIX: Resolve "Scan error ... converting NULL to string"
-- Run this IMMEDIATELY in the Supabase SQL Editor if you see the "Scan error" in your console.

-- Fix confirmation_token
UPDATE auth.users
SET confirmation_token = ''
WHERE confirmation_token IS NULL;

-- Fix other potential token fields causing similar issues
UPDATE auth.users
SET recovery_token = ''
WHERE recovery_token IS NULL;

UPDATE auth.users
SET email_change_token_new = ''
WHERE email_change_token_new IS NULL;

UPDATE auth.users
SET email_change = ''
WHERE email_change IS NULL;

-- Output result to verify
SELECT email, confirmation_token FROM auth.users;
