#!/usr/bin/env node
/**
 * Simular cómo Vercel intenta leer inventory
 * Este script usa EXACTAMENTE las mismas credenciales que Vercel
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Simulando consulta desde Vercel (sin autenticación)...\n');
console.log('Credenciales:');
console.log(`  URL: ${supabaseUrl}`);
console.log(`  Key: ${supabaseKey.substring(0, 20)}...\n`);

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInventoryAccess() {
  // EXACTAMENTE la misma consulta que hace el componente new-sale-modal.tsx línea 41
  const { data, error } = await supabase
    .from('inventory')
    .select('product_id, product_name');

  console.log('📊 Resultado de la consulta:\n');

  if (error) {
    console.error('❌ ERROR:', error.message);
    console.error('   Code:', error.code);
    console.error('   Details:', error.details);
    console.error('   Hint:', error.hint);
    console.error('\n⚠️  ESTE ES EL PROBLEMA: Vercel no puede leer inventory!');
    console.error('   Solución: Necesitas arreglar las políticas RLS de inventory\n');
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️  La consulta funciona pero NO HAY DATOS');
    console.log('   Productos encontrados: 0');
    console.log('   Esto significa que:');
    console.log('   1. Las políticas RLS bloquean la lectura, o');
    console.log('   2. La tabla realmente está vacía\n');
    return;
  }

  console.log(`✅ Consulta exitosa: ${data.length} productos encontrados\n`);
  console.log('Productos:');
  data.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.product_name} (ID: ${p.product_id})`);
  });
  console.log('\n🎉 ¡Todo funciona! Los productos deberían aparecer en Vercel.');
}

testInventoryAccess().catch(err => {
  console.error('💥 Error inesperado:', err);
  process.exit(1);
});
