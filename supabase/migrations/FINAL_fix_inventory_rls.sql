-- FIX FINAL: Permitir lectura pública de inventory
-- Este fue el último fix necesario para que los productos aparezcan en el dropdown

DROP POLICY IF EXISTS "Enable read access for all users" ON inventory;
DROP POLICY IF EXISTS "Admins can insert inventory" ON inventory;
DROP POLICY IF EXISTS "Admins can update inventory" ON inventory;
DROP POLICY IF EXISTS "Admins can delete inventory" ON inventory;

-- Política de lectura pública (cualquiera puede ver el catálogo)
CREATE POLICY "Anyone can read inventory" ON inventory
  FOR SELECT USING (true);

-- Solo admins pueden modificar inventory
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

SELECT 'SUCCESS: Inventory RLS fixed - products now visible' as status;
