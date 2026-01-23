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

    // Create metadata file
    const metadata = {
        timestamp,
        supabaseUrl,
        tables: result.tables,
        totalRows: result.tables.reduce((sum, t) => sum + t.rowCount, 0),
        errors: result.tables.filter((t) => t.error).length,
    };

    fs.writeFileSync(path.join(backupDir, '_metadata.json'), JSON.stringify(metadata, null, 2));

    // Check if any table had errors
    result.success = result.tables.every((t) => !t.error);

    console.log(`\nBackup complete!`);
    console.log(`  Total tables: ${result.tables.length}`);
    console.log(`  Total rows: ${metadata.totalRows}`);
    console.log(`  Errors: ${metadata.errors}`);

    return result;
}

// Run if called directly
if (require.main === module) {
    exportTables()
        .then((result) => {
            if (!result.success) {
                process.exit(1);
            }
        })
        .catch((err) => {
            console.error('Backup failed:', err);
            process.exit(1);
        });
}
