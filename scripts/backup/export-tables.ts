/**
 * Export tables from Supabase to JSON backup files
 * Run with: npx tsx scripts/backup/export-tables.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Tables to export (in order of dependencies)
const TABLES_TO_EXPORT = [
  'profiles',
  'products',
  'product_variants',
  'inventory',
  'customers',
  'customer_contacts',
  'customer_auth',
  'price_lists',
  'price_list_items',
  'delivery_zones',
  'sales',
  'sale_items',
  'deliveries',
  'delivery_items',
  'customer_subscriptions',
  'subscription_items',
  'referral_program_config',
  'referrals',
  'inventory_movements',
  'whatsapp_templates',
  // Faltaba. La base tiene 21 tablas y esta lista respaldaba 20: un restore
  // dejaba sin recuperar la configuración de precios por tipo de cliente
  // (5 filas en producción el 2026-08-07). Lo destapó comparar el conteo
  // declarado en FICHA_TECNICA («20») con el medido contra `pg_class` («21»).
  'customer_type_price_lists',
];

interface ExportResult {
  success: boolean;
  tables: {
    name: string;
    rowCount: number;
    error?: string;
  }[];
  timestamp: string;
  outputPath: string;
}

export async function exportTables(outputDir?: string): Promise<ExportResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = outputDir || path.join(process.cwd(), 'backups', timestamp);

  // Create backup directory
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const result: ExportResult = {
    success: true,
    tables: [],
    timestamp,
    outputPath: backupDir,
  };

  console.log(`Starting backup to ${backupDir}...`);

  for (const tableName of TABLES_TO_EXPORT) {
    try {
      console.log(`  Exporting ${tableName}...`);

      const { data, error } = await supabase.from(tableName).select('*');

      if (error) {
        console.error(`    Error: ${error.message}`);
        result.tables.push({
          name: tableName,
          rowCount: 0,
          error: error.message,
        });
        // Continue with other tables even if one fails
        continue;
      }

      const rowCount = data?.length || 0;
      const filePath = path.join(backupDir, `${tableName}.json`);

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

      console.log(`    Exported ${rowCount} rows`);
      result.tables.push({
        name: tableName,
        rowCount,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`    Exception: ${errorMessage}`);
      result.tables.push({
        name: tableName,
        rowCount: 0,
        error: errorMessage,
      });
    }
  }

  // El ESQUEMA viaja con los datos.
  //
  // Hasta el 2026-08-07 el ZIP eran solo JSON de filas. Con eso no se
  // reconstruye nada: no hay tablas, ni funciones, ni políticas, ni triggers.
  // La restauración dependía de que quien la intentara tuviera a mano el repo
  // **en la misma versión** que produjo los datos — y el ensayo de restauración
  // demostró que ni siquiera el repo bastaba (ver `014` y BACKLOG §P0-BACKUP).
  //
  // Copiando aquí las migraciones, el archivo que se guarda fuera de Supabase
  // es autosuficiente: esquema + datos, coherentes entre sí porque se empaquetan
  // en el mismo instante.
  const migracionesOrigen = path.join(__dirname, '..', '..', 'supabase', 'migrations');
  let migracionesCopiadas = 0;
  try {
    const destino = path.join(backupDir, 'schema');
    fs.mkdirSync(destino, { recursive: true });
    for (const archivo of fs.readdirSync(migracionesOrigen).filter(f => f.endsWith('.sql'))) {
      fs.copyFileSync(path.join(migracionesOrigen, archivo), path.join(destino, archivo));
      migracionesCopiadas++;
    }
    console.log(`  Schema: ${migracionesCopiadas} migraciones incluidas en el backup`);
  } catch (err) {
    // No se silencia: un backup sin esquema es un backup a medias, y hay que
    // enterarse ahora y no el día de la restauración.
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`  ERROR copiando el esquema al backup: ${msg}`);
    result.tables.push({ name: '_schema', rowCount: 0, error: msg });
  }

  // Create metadata file
  const metadata = {
    timestamp,
    supabaseUrl,
    tables: result.tables,
    totalRows: result.tables.reduce((sum, t) => sum + t.rowCount, 0),
    errors: result.tables.filter(t => t.error).length,
    schemaMigrations: migracionesCopiadas,
  };

  fs.writeFileSync(path.join(backupDir, '_metadata.json'), JSON.stringify(metadata, null, 2));

  // Check if any table had errors
  result.success = result.tables.every(t => !t.error);

  console.log(`\nBackup complete!`);
  console.log(`  Total tables: ${result.tables.length}`);
  console.log(`  Total rows: ${metadata.totalRows}`);
  console.log(`  Errors: ${metadata.errors}`);

  return result;
}

// Run if called directly
if (require.main === module) {
  exportTables()
    .then(result => {
      if (!result.success) {
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Backup failed:', err);
      process.exit(1);
    });
}
