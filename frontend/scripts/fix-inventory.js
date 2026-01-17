#!/usr/bin/env node
/**
 * Script para insertar datos de inventario en Supabase
 * Ejecutar: node scripts/fix-inventory.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Variables de entorno faltantes');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixInventory() {
  console.log('🔍 Verificando estado de la tabla inventory...\n');

  // 1. Verificar datos existentes
  const { data: existingProducts, error: selectError } = await supabase
    .from('inventory')
    .select('product_id, product_name, total_grams_available');

  if (selectError) {
    console.error('❌ Error al leer inventory:', selectError.message);
    process.exit(1);
  }

  console.log(`📦 Productos encontrados: ${existingProducts.length}`);
  if (existingProducts.length > 0) {
    console.log('\nProductos actuales:');
    existingProducts.forEach(p => {
      console.log(`   - ${p.product_name} (${p.total_grams_available}g)`);
    });
  }

  // 2. Productos que deberían existir
  const requiredProducts = [
    { name: 'Café Tostado (Grano)', grams: 5000 },
    { name: 'Café Molido Medio', grams: 2500 }
  ];

  // 3. Verificar cuáles faltan
  const missingProducts = requiredProducts.filter(required =>
    !existingProducts.some(existing => existing.product_name === required.name)
  );

  if (missingProducts.length === 0) {
    console.log('\n✅ Todos los productos ya existen. No se requiere acción.');
    return;
  }

  console.log(`\n🔧 Insertando ${missingProducts.length} producto(s) faltante(s)...`);

  // 4. Insertar productos faltantes
  for (const product of missingProducts) {
    const { data, error } = await supabase
      .from('inventory')
      .insert([{
        product_name: product.name,
        total_grams_available: product.grams
      }])
      .select();

    if (error) {
      console.error(`❌ Error insertando "${product.name}":`, error.message);
    } else {
      console.log(`   ✓ Insertado: ${product.name} (${product.grams}g)`);
    }
  }

  // 5. Verificar resultado final
  const { data: finalProducts, error: finalError } = await supabase
    .from('inventory')
    .select('product_id, product_name, total_grams_available')
    .order('product_name');

  if (finalError) {
    console.error('❌ Error verificando resultado:', finalError.message);
    return;
  }

  console.log('\n✅ Estado final de inventory:');
  console.log(`   Total de productos: ${finalProducts.length}`);
  finalProducts.forEach(p => {
    console.log(`   - ${p.product_name}: ${p.total_grams_available}g`);
  });

  console.log('\n🎉 Fix completado exitosamente!');
  console.log('👉 Abre tu app en https://frontend-kohl-beta-60.vercel.app y verifica el dropdown.');
}

fixInventory().catch(err => {
  console.error('❌ Error inesperado:', err);
  process.exit(1);
});
