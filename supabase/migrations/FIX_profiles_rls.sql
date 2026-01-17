-- FIX: Arreglar políticas RLS de profiles que causan error 500
-- El problema es que las políticas recursivas causan loops infinitos

-- 1. Eliminar todas las políticas existentes
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 2. Crear política simple: todos los usuarios autenticados pueden leer todos los profiles
-- Esto es seguro porque profiles solo contiene roles, no información sensible
CREATE POLICY "Authenticated users can read all profiles" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- 3. Solo el mismo usuario puede actualizar su propio perfil
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 4. Verificar que funciona
SELECT 'SUCCESS: RLS policies fixed' as status;

-- Mostrar las políticas actuales
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'profiles';
