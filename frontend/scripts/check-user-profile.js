#!/usr/bin/env node
/**
 * Verificar si el usuario actual tiene perfil
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserProfile() {
  const userId = '9577322a-3171-4378-bf34-d3cebc844847';

  console.log('🔍 Verificando perfil del usuario:', userId);

  // 1. Verificar si el usuario existe en profiles
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('❌ Error:', error.message);
    console.error('   Code:', error.code);
    console.error('   Details:', error.details);
    console.error('   Hint:', error.hint);

    // Intentar sin single() para ver si hay múltiples registros
    console.log('\n🔍 Intentando sin .single()...');
    const { data: allData, error: allError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId);

    if (allError) {
      console.error('❌ Error también sin single():', allError.message);
    } else {
      console.log('✅ Encontrados:', allData.length, 'registros');
      console.log(allData);
    }
  } else {
    console.log('✅ Perfil encontrado:');
    console.log(data);
  }

  // 2. Listar TODOS los perfiles
  console.log('\n📋 Todos los perfiles en la BD:');
  const { data: allProfiles, error: listError } = await supabase
    .from('profiles')
    .select('*');

  if (listError) {
    console.error('❌ Error listando profiles:', listError.message);
  } else {
    console.log(`Total: ${allProfiles.length} perfiles`);
    allProfiles.forEach(p => {
      console.log(`   - ${p.id} | ${p.full_name} | ${p.role}`);
    });
  }
}

checkUserProfile().catch(err => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
