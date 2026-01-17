-- EJECUTAR INMEDIATAMENTE: Crear tabla profiles faltante
-- Esta tabla es necesaria para que la aplicación funcione

-- 1. Crear tabla profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'seller' CHECK (role IN ('admin', 'seller')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Crear políticas (DROP primero para evitar errores de duplicados)
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 4. Trigger para crear perfil automáticamente cuando se registra un usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    'seller'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Crear perfil para todos los usuarios existentes que no tengan uno
-- El primer usuario será admin, los demás sellers
DO $$
DECLARE
  first_user UUID;
BEGIN
  -- Obtener el primer usuario (será admin)
  SELECT id INTO first_user
  FROM auth.users
  ORDER BY created_at
  LIMIT 1;

  -- Crear profiles para todos los usuarios existentes
  INSERT INTO public.profiles (id, full_name, role)
  SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email) as full_name,
    CASE WHEN u.id = first_user THEN 'admin' ELSE 'seller' END as role
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = u.id
  );
END $$;

-- 6. Verificar resultado
SELECT
  'SUCCESS: Profiles table created and populated' as status,
  COUNT(*) as total_profiles
FROM public.profiles;

-- Mostrar los perfiles creados
SELECT
  id,
  full_name,
  role,
  created_at
FROM public.profiles
ORDER BY created_at;
