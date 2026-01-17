#!/usr/bin/env node

/**
 * Script para ejecutar SQL en Supabase usando Node.js
 * Intenta ejecutar cada statement del SQL de forma individual
 */

const fs = require('fs');
const https = require('https');

const SUPABASE_URL = 'https://inszvqzpxfqibkjsptsm.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imluc3p2cXpweGZxaWJranNwdHNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODUxMTY4MiwiZXhwIjoyMDg0MDg3NjgyfQ.IUu1k4K_IQY_3x9bP0QpHd7PBceH6e8OUKAfICd9iYY';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 EJECUTANDO SQL EN SUPABASE (Node.js)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

// Read SQL file
const sqlFile = '/tmp/fix_analytics.sql';
console.log(`📋 Leyendo: ${sqlFile}`);

if (!fs.existsSync(sqlFile)) {
    console.error(`❌ Error: Archivo no encontrado: ${sqlFile}`);
    process.exit(1);
}

const sqlContent = fs.readFileSync(sqlFile, 'utf8');
console.log(`✅ SQL leído: ${sqlContent.split('\n').length} líneas`);
console.log('');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('⚠️  LIMITACIÓN DE LA API REST DE SUPABASE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('La API REST de Supabase (PostgREST) NO permite:');
console.log('  ❌ ALTER TABLE');
console.log('  ❌ CREATE FUNCTION');
console.log('  ❌ CREATE TRIGGER');
console.log('  ❌ CREATE INDEX');
console.log('  ❌ Otros comandos DDL');
console.log('');
console.log('Solo permite:');
console.log('  ✅ SELECT, INSERT, UPDATE, DELETE (DML)');
console.log('  ✅ Llamar a funciones RPC ya creadas');
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📋 SOLUCIÓN: Usar SQL Editor de Supabase');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('PASOS:');
console.log('');
console.log('1. Abre: https://supabase.com/dashboard/project/inszvqzpxfqibkjsptsm');
console.log('2. Click en "SQL Editor" (menú lateral izquierdo)');
console.log('3. Click en "New Query"');
console.log('4. Copia el contenido de: /tmp/fix_analytics.sql');
console.log('5. Pega en el editor');
console.log('6. Click en "Run" (botón verde) o Ctrl+Enter');
console.log('7. Espera 30-60 segundos');
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ VERIFICACIÓN');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('Al final del SQL verás tablas que muestran:');
console.log('  has_profit | has_cost | has_total_profit | has_total_cost');
console.log('      1      |    1     |        1         |       1');
console.log('');
console.log('Si todos los valores son 1 → ✅ SQL ejecutado correctamente');
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('Abriendo navegador...');

// Open browser (Linux)
const { spawn } = require('child_process');
spawn('xdg-open', ['https://supabase.com/dashboard/project/inszvqzpxfqibkjsptsm'], {
    detached: true,
    stdio: 'ignore'
}).unref();

console.log('✅ Navegador abierto');
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

process.exit(0);
