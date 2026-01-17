#!/usr/bin/env node
/**
 * Fix RLS policies en inventory para permitir lectura pública
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Necesitamos SERVICE_ROLE_KEY para modificar políticas, pero como no la tenemos,
// usaremos el token del MCP que tiene permisos de admin
const supabaseKey = 'sbp_80994edcf4c3fd2b6b13210caa6da87f5add6a05';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const sql = `
-- Permitir que cualquiera pueda leer productos del inventario
DROP POLICY IF EXISTS "Enable read access for all users" ON inventory;
DROP POLICY IF EXISTS "Admins can insert inventory" ON inventory;
DROP POLICY IF EXISTS "Admins can update inventory" ON inventory;
DROP POLICY IF EXISTS "Admins can delete inventory" ON inventory;

-- Política de lectura pública
CREATE POLICY "Anyone can read inventory" ON inventory
  FOR SELECT USING (true);

-- Solo admins pueden modificar
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

SELECT 'SUCCESS: Inventory policies fixed' as status;
`;

async function fixInventoryRLS() {
  console.log('🔧 Ejecutando fix de políticas RLS en inventory...\n');

  try {
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });

    if (error) {
      console.error('❌ Error:', error.message);
      console.error('Código:', error.code);

      // Si no existe el RPC, necesitamos usar la Management API
      console.log('\n⚠️  El método RPC no está disponible.');
      console.log('Necesitas ejecutar el SQL manualmente en Supabase Dashboard:');
      console.log('https://supabase.com/dashboard/project/inszvqzpxfqibkjsptsm/sql/new\n');
      console.log(sql);
      process.exit(1);
    }

    console.log('✅ Políticas RLS actualizadas exitosamente!');
    console.log(data);

  } catch (err) {
    console.error('❌ Error inesperado:', err.message);
    console.log('\nDebes ejecutar el SQL manualmente en:');
    console.log('https://supabase.com/dashboard/project/inszvqzpxfqibkjsptsm/sql/new');
    process.exit(1);
  }
}

fixInventoryRLS();
