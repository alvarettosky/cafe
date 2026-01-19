import { createClient } from '@supabase/supabase-js';
import { createWriteStream } from 'fs';
import { createGzip } from 'zlib';
import { statSync } from 'fs';
import { BACKUP_TABLES } from './types';

export async function exportToSQL(
  supabaseUrl: string,
  serviceKey: string,
  outputPath: string
): Promise<{ sizeBytes: number; rowCount: number }> {
  const supabase = createClient(supabaseUrl, serviceKey);
  const gzip = createGzip();
  const writeStream = createWriteStream(outputPath);

  gzip.pipe(writeStream);

  let totalRows = 0;

  // Write SQL header
  gzip.write('-- Cafe Mirador Backup\n');
  gzip.write(`-- Generado: ${new Date().toISOString()}\n`);
  gzip.write('-- Base de datos: Supabase PostgreSQL\n\n');
  gzip.write('BEGIN;\n\n');

  for (const tableName of BACKUP_TABLES) {
    try {
      console.log(`Exportando tabla a SQL: ${tableName}`);

      // Fetch all data
      const allData: Record<string, unknown>[] = [];
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .range(offset, offset + pageSize - 1);

        if (error) throw error;

        allData.push(...(data || []));
        hasMore = (data?.length || 0) === pageSize;
        offset += pageSize;
      }

      if (allData.length === 0) {
        gzip.write(`-- Tabla ${tableName} está vacía\n\n`);
        continue;
      }

      // Write DELETE statement
      gzip.write(`-- Tabla: ${tableName} (${allData.length} filas)\n`);
      gzip.write(`DELETE FROM ${tableName};\n`);

      // Write INSERT statements
      const columns = Object.keys(allData[0]);
      gzip.write(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES\n`);

      allData.forEach((row, index) => {
        const values = columns.map(col => {
          const value = row[col];
          if (value === null) return 'NULL';
          if (typeof value === 'string') {
            return `'${value.replace(/'/g, "''")}'`;
          }
          if (value instanceof Date) {
            return `'${value.toISOString()}'`;
          }
          if (typeof value === 'object') {
            return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
          }
          return String(value);
        });

        const isLast = index === allData.length - 1;
        gzip.write(`  (${values.join(', ')})${isLast ? ';\n\n' : ',\n'}`);
      });

      totalRows += allData.length;
      console.log(`✓ ${tableName}: ${allData.length} filas`);
    } catch (error) {
      console.error(`✗ Error exportando ${tableName}:`, error);
      gzip.write(`-- ERROR: Falló exportar ${tableName}\n\n`);
    }
  }

  gzip.write('COMMIT;\n');
  gzip.end();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      const stats = statSync(outputPath);
      resolve({ sizeBytes: stats.size, rowCount: totalRows });
    });
    writeStream.on('error', reject);
  });
}

// CLI execution
if (require.main === module) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos');
    process.exit(1);
  }

  const output = process.argv[2] || './backups/backup.sql.gz';

  exportToSQL(url, key, output)
    .then(({ sizeBytes, rowCount }) => {
      console.log(`\n✓ SQL dump completo: ${rowCount} filas, ${sizeBytes} bytes`);
    })
    .catch(error => {
      console.error('Exportación SQL falló:', error);
      process.exit(1);
    });
}
