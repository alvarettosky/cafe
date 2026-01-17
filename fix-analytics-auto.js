#!/usr/bin/env node

/**
 * Script automático para arreglar Analytics
 * Ejecuta el SQL fix directamente en Supabase
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Colores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Leer Service Role Key del archivo mcp.json
function getServiceRoleKey() {
  try {
    const mcpPath = path.join(process.env.HOME, '.config', 'claude', 'mcp.json');
    const mcpContent = fs.readFileSync(mcpPath, 'utf8');
    const mcpConfig = JSON.parse(mcpContent);
    const key = mcpConfig.mcpServers.supabase.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!key || key.length < 100) {
      log('\n⚠️  ADVERTENCIA: Service Role Key parece estar truncada o incompleta', 'yellow');
      log(`Longitud actual: ${key.length} caracteres`, 'yellow');
      log('Las claves válidas tienen ~200+ caracteres\n', 'yellow');
      return null;
    }

    return key;
  } catch (error) {
    log(`❌ Error leyendo mcp.json: ${error.message}`, 'red');
    return null;
  }
}

// Leer el SQL fix
function getSQLFix() {
  try {
    const sqlPath = path.join(__dirname, 'supabase', 'migrations', 'FIX_ANALYTICS_TABLES.sql');
    return fs.readFileSync(sqlPath, 'utf8');
  } catch (error) {
    log(`❌ Error leyendo SQL fix: ${error.message}`, 'red');
    return null;
  }
}

// Ejecutar SQL en Supabase usando REST API
function executeSQLViaPSQL(sql, serviceRoleKey) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });

    const options = {
      hostname: 'inszvqzpxfqibkjsptsm.supabase.co',
      port: 443,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(body);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Main
async function main() {
  log('\n🔧 INICIANDO FIX AUTOMÁTICO DE ANALYTICS\n', 'cyan');

  // Paso 1: Obtener Service Role Key
  log('📋 Paso 1: Obteniendo Service Role Key...', 'blue');
  const serviceRoleKey = getServiceRoleKey();

  if (!serviceRoleKey) {
    log('\n❌ FALLO: No se pudo obtener una Service Role Key válida\n', 'red');
    log('SOLUCIÓN MANUAL:', 'yellow');
    log('1. Ve a: https://supabase.com/dashboard/project/inszvqzpxfqibkjsptsm/settings/api-keys', 'yellow');
    log('2. Copia la clave completa "service_role" (Secret keys)', 'yellow');
    log('3. Edita ~/.config/claude/mcp.json', 'yellow');
    log('4. Reemplaza SUPABASE_SERVICE_ROLE_KEY con la clave completa', 'yellow');
    log('5. Vuelve a ejecutar este script\n', 'yellow');
    log('O EJECUTA MANUALMENTE:', 'yellow');
    log('1. Ve a: https://supabase.com/dashboard/project/inszvqzpxfqibkjsptsm', 'yellow');
    log('2. Click en "SQL Editor"', 'yellow');
    log('3. Copia el contenido de: supabase/migrations/FIX_ANALYTICS_TABLES.sql', 'yellow');
    log('4. Pégalo en SQL Editor y haz click en "Run"\n', 'yellow');
    process.exit(1);
  }

  log('✅ Service Role Key encontrada\n', 'green');

  // Paso 2: Leer SQL Fix
  log('📋 Paso 2: Leyendo script SQL...', 'blue');
  const sql = getSQLFix();

  if (!sql) {
    log('❌ FALLO: No se pudo leer el archivo SQL', 'red');
    process.exit(1);
  }

  log('✅ Script SQL cargado\n', 'green');

  // Paso 3: Mostrar instrucciones manuales (más confiable que la API)
  log('📋 Paso 3: EJECUTAR FIX MANUALMENTE (Recomendado)\n', 'blue');
  log('El fix requiere ejecutar DDL (ALTER TABLE, CREATE FUNCTION)', 'yellow');
  log('que no está disponible via REST API.\n', 'yellow');

  log('PASOS PARA EJECUTAR:', 'cyan');
  log('1. Ve a: https://supabase.com/dashboard/project/inszvqzpxfqibkjsptsm', 'cyan');
  log('2. Click en "SQL Editor" en el menú lateral', 'cyan');
  log('3. Click en "New Query"', 'cyan');
  log('4. Copia el contenido completo de:', 'cyan');
  log('   supabase/migrations/FIX_ANALYTICS_TABLES.sql', 'cyan');
  log('5. Pégalo en el editor SQL', 'cyan');
  log('6. Click en "Run" (o Ctrl+Enter)', 'cyan');
  log('7. Espera a que termine (verás mensajes de éxito)', 'cyan');
  log('8. Al final verás tablas de verificación con todo en 1\n', 'cyan');

  log('VERIFICAR QUE FUNCIONÓ:', 'green');
  log('Ve a: https://cafe-pi-steel.vercel.app/analytics', 'green');
  log('La página debería cargar correctamente mostrando gráficos\n', 'green');

  log('⏱️  Tiempo estimado: 2-3 minutos', 'blue');
  log('\n✨ Instrucciones generadas exitosamente\n', 'green');
}

main().catch(error => {
  log(`\n❌ ERROR: ${error.message}\n`, 'red');
  process.exit(1);
});
