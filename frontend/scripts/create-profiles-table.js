#!/usr/bin/env node
/**
 * Script para crear tabla profiles y sus políticas en Supabase
 * Ejecutar: node scripts/create-profiles-table.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Necesitamos la SERVICE_ROLE_KEY para operaciones admin
// Por ahora usaremos el ANON_KEY y ejecutaremos el SQL directamente

console.log('⚠️  IMPORTANTE: Este script necesita ejecutarse en el SQL Editor de Supabase');
console.log('⚠️  No se puede crear la tabla profiles desde el cliente con ANON_KEY\n');

console.log('📋 INSTRUCCIONES:');
console.log('1. Abre: https://supabase.com/dashboard/project/inszvqzpxfqibkjsptsm/sql/new');
console.log('2. Copia y pega el siguiente SQL:\n');

const sql = `
-- Crear tabla profiles si no existe
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'seller' CHECK (role IN ('admin', 'seller')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Crear políticas (con IF NOT EXISTS emulado mediante DROP IF EXISTS primero)
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

-- Trigger para crear perfil automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', new.email), 'seller')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Crear perfil para usuario existente si no existe
INSERT INTO public.profiles (id, full_name, role)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'full_name', email) as full_name,
  'admin' as role  -- El primer usuario será admin
FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = users.id)
LIMIT 1;

-- Verificar resultado
SELECT 'SUCCESS: Profiles table created' as status;
SELECT * FROM public.profiles;
`;

console.log('─'.repeat(80));
console.log(sql);
console.log('─'.repeat(80));
console.log('\n3. Haz clic en RUN');
console.log('4. Verifica que veas "SUCCESS: Profiles table created"\n');

// Verificar si podemos leer profiles (después de crearlo)
async function verifyProfiles() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('5️⃣ Después de ejecutar el SQL, presiona ENTER para verificar...');

  // Esperar input del usuario
  process.stdin.once('data', async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role');

    if (error) {
      console.error('❌ Error verificando profiles:', error.message);
    } else {
      console.log(`✅ Profiles verificado: ${data.length} usuario(s)`);
      console.log(data);
    }
    process.exit(0);
  });
}

verifyProfiles();
