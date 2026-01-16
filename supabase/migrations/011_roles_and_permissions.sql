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
