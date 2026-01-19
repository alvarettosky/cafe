import { createClient } from '@supabase/supabase-js';
import { createWriteStream, promises as fs } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import { BACKUP_TABLES, TableExportResult, BackupMetadata } from './types';

export async function exportToJSON(
  supabaseUrl: string,
  serviceKey: string,
  outputDir: string
): Promise<{ results: TableExportResult[]; metadata: BackupMetadata }> {
  const supabase = createClient(supabaseUrl, serviceKey);
  const timestamp = new Date().toISOString();
  const results: TableExportResult[] = [];
  const startTime = Date.now();

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Export each table
  for (const tableName of BACKUP_TABLES) {
    try {
      console.log(`Exportando tabla: ${tableName}`);

      // Fetch all data with pagination
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

      // Write to compressed JSON file
      const fileName = `${tableName}.json.gz`;
      const filePath = `${outputDir}/${fileName}`;
      const jsonContent = JSON.stringify(allData, null, 2);

      const writeStream = createWriteStream(filePath);
      const gzip = createGzip();

      await pipeline(
        async function* () {
          yield jsonContent;
        },
        gzip,
        writeStream
      );

      const stats = await fs.stat(filePath);

      results.push({
        tableName,
        rows: allData.length,
        sizeBytes: stats.size,
        success: true,
      });

      console.log(`✓ ${tableName}: ${allData.length} filas, ${stats.size} bytes`);
    } catch (error) {
      results.push({
        tableName,
        rows: 0,
        sizeBytes: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`✗ ${tableName}: ${error}`);
    }
  }

  // Calculate hash of all exported files
  const hash = crypto.createHash('sha256');
  for (const result of results) {
    if (result.success) {
      const content = await fs.readFile(`${outputDir}/${result.tableName}.json.gz`);
      hash.update(content);
    }
  }

  const metadata: BackupMetadata = {
    timestamp,
    tables: Object.fromEntries(
      results
        .filter(r => r.success)
        .map(r => [r.tableName, { rows: r.rows, size_bytes: r.sizeBytes }])
    ),
    duration_seconds: Math.floor((Date.now() - startTime) / 1000),
    github_run_id: process.env.GITHUB_RUN_ID,
    hash_sha256: hash.digest('hex'),
  };

  // Write metadata file
  await fs.writeFile(`${outputDir}/metadata.json`, JSON.stringify(metadata, null, 2));

  return { results, metadata };
}

// CLI execution
if (require.main === module) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos');
    process.exit(1);
  }

  const output = process.argv[2] || './backups/temp';

  exportToJSON(url, key, output)
    .then(({ results, metadata }) => {
      console.log('\n=== Exportación Completa ===');
      console.log(`Duración: ${metadata.duration_seconds}s`);
      console.log(`Hash: ${metadata.hash_sha256}`);

      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        console.error(`\n${failed.length} tabla(s) fallaron:`);
        failed.forEach(f => console.error(`  - ${f.tableName}: ${f.error}`));
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Exportación falló:', error);
      process.exit(1);
    });
}
