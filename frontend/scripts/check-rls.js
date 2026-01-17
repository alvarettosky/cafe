#!/usr/bin/env node
/**
 * Script para verificar políticas RLS en Supabase
 * Ejecutar: node scripts/check-rls.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRLS() {
  console.log('🔍 Verificando políticas RLS y permisos...\n');

  // 1. Verificar que podemos leer inventory con anon key
  console.log('1️⃣ Test: Lectura con ANON KEY');
  const { data: products, error: readError } = await supabase
    .from('inventory')
    .select('product_id, product_name');

  if (readError) {
    console.error('   ❌ Error leyendo inventory:', readError.message);
    console.error('   Código:', readError.code);
    console.error('   Detalles:', readError.details);
  } else {
    console.log(`   ✅ Lectura exitosa: ${products.length} productos`);
  }

  // 2. Verificar configuración de Supabase
  console.log('\n2️⃣ Configuración de Supabase:');
  console.log(`   URL: ${supabaseUrl}`);
  console.log(`   Key (primeros 20 chars): ${supabaseKey.substring(0, 20)}...`);

  // 3. Consultar las políticas RLS directamente
  console.log('\n3️⃣ Políticas RLS en tabla inventory:');
  const { data: policies, error: policiesError } = await supabase
    .rpc('get_policies_for_table', { table_name: 'inventory' })
    .select();

  if (policiesError) {
    console.log('   ⚠️  No se pudo consultar políticas (esto es normal si no existe el RPC)');
    console.log('   Mensaje:', policiesError.message);
  } else {
    console.log('   Políticas encontradas:', policies);
  }

  // 4. Intentar una consulta más específica
  console.log('\n4️⃣ Test: Consulta con filtro');
  const { data: filtered, error: filterError } = await supabase
    .from('inventory')
    .select('*')
    .limit(1);

  if (filterError) {
    console.error('   ❌ Error con filtro:', filterError.message);
  } else {
    console.log(`   ✅ Consulta con filtro exitosa: ${filtered.length} resultado(s)`);
    if (filtered.length > 0) {
      console.log('   Primer producto:', filtered[0]);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('DIAGNÓSTICO:');
  if (!readError) {
    console.log('✅ Las credenciales locales FUNCIONAN correctamente');
    console.log('⚠️  El problema está en Vercel, no en la base de datos');
    console.log('\nPosibles causas:');
    console.log('1. Variables de entorno mal configuradas en Vercel');
    console.log('2. Cache de Vercel sirviendo datos viejos');
    console.log('3. Build de Vercel sin las variables correctas');
  } else {
    console.log('❌ Problema de permisos RLS en la base de datos');
    console.log('   Necesitas ejecutar: supabase/migrations/010_security_rls.sql');
  }
}

checkRLS().catch(err => {
  console.error('❌ Error inesperado:', err);
  process.exit(1);
});
