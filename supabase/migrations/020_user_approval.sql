-- ============================================
-- MIGRATION: User Approval System
-- ============================================

-- 1. Agregar columna approved a profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT false;

-- 2. Aprobar usuarios existentes (IMPORTANTE: ejecutar ANTES de cambiar RLS)
UPDATE profiles SET approved = true WHERE approved = false;

-- 3. Modificar trigger para nuevos usuarios (quedan pendientes)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, approved)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'seller',
    false  -- Nuevos usuarios quedan pendientes
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC: Obtener usuarios pendientes (solo admin)
CREATE OR REPLACE FUNCTION get_pending_users()
RETURNS TABLE (id UUID, email TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Verificar que el usuario es admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email::TEXT, p.created_at
  FROM auth.users u
  JOIN profiles p ON u.id = p.id
  WHERE p.approved = false
  ORDER BY p.created_at DESC;
END;
$$;

-- 5. RPC: Aprobar usuario (solo admin)
CREATE OR REPLACE FUNCTION approve_user(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Verificar que el usuario es admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE profiles SET approved = true WHERE id = p_user_id;
END;
$$;

-- 6. RPC: Rechazar usuario (solo admin)
CREATE OR REPLACE FUNCTION reject_user(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Verificar que el usuario es admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Eliminar de auth.users (cascade elimina profile)
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

-- 7. Actualizar RLS para requerir aprobación en tablas sensibles

-- Sales
DROP POLICY IF EXISTS "Employees can CRUD sales" ON sales;
CREATE POLICY "Approved employees can CRUD sales" ON sales
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND approved = true
    )
  );

-- Sale Items
DROP POLICY IF EXISTS "Employees can CRUD sale items" ON sale_items;
CREATE POLICY "Approved employees can CRUD sale items" ON sale_items
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND approved = true
    )
  );

-- Customers
DROP POLICY IF EXISTS "Employees can manage customers" ON customers;
CREATE POLICY "Approved employees can manage customers" ON customers
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND approved = true
    )
  );

-- Inventory (lectura para aprobados, escritura solo admin)
DROP POLICY IF EXISTS "Enable read access for all users" ON inventory;
CREATE POLICY "Approved users can read inventory" ON inventory
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND approved = true
    )
  );
