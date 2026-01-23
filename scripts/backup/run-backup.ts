#!/usr/bin/env npx tsx
/**
 * Main backup orchestrator script
 * Coordinates: export -> upload -> cleanup -> notify
 *
 * Usage:
 *   npx tsx scripts/backup/run-backup.ts
 *
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - RESEND_API_KEY (optional)
 *   - NOTIFICATION_EMAIL (optional)
 */

import * as fs from 'fs';
import { exportTables } from './export-tables';
import { uploadToSupabaseStorage } from './upload-supabase';
import { cleanupBackups } from './cleanup-retention';
import { sendBackupNotification } from './send-notification';

interface BackupResult {
    success: boolean;
    timestamp: string;
    exportPath?: string;
    tablesExported: number;
    totalRows: number;
    errors: number;
    storagePath?: string;
    downloadUrl?: string;
    fileSize?: string;
    cleanupResult?: {
        kept: number;
        deleted: number;
    };
    notificationSent: boolean;
}

export async function runBackup(): Promise<BackupResult> {
    const timestamp = new Date().toISOString().split('T')[0];
    console.log('='.repeat(50));
    console.log(`BACKUP STARTED: ${timestamp}`);
    console.log('='.repeat(50));

    const result: BackupResult = {
        success: false,
        timestamp,
        tablesExported: 0,
        totalRows: 0,
        errors: 0,
        notificationSent: false,
    };

    try {
        // Step 1: Export tables
        console.log('\n[1/4] Exporting tables from Supabase...');
        const exportResult = await exportTables();

        result.exportPath = exportResult.outputPath;
        result.tablesExported = exportResult.tables.length;
        result.totalRows = exportResult.tables.reduce((sum, t) => sum + t.rowCount, 0);
        result.errors = exportResult.tables.filter((t) => t.error).length;

        if (!exportResult.success) {
            console.error('Export had errors, but continuing...');
        }

        // Step 2: Upload to Supabase Storage
        console.log('\n[2/4] Uploading to Supabase Storage...');
        const backupFileName = `cafe-mirador-backup-${timestamp}`;
        const uploadResult = await uploadToSupabaseStorage(exportResult.outputPath, backupFileName);

        if (!uploadResult.success) {
            throw new Error(`Upload failed: ${uploadResult.error}`);
        }

        result.storagePath = uploadResult.path;
        result.downloadUrl = uploadResult.publicUrl;

        // Get file size
        const zipPath = `${exportResult.outputPath}.zip`;
        if (fs.existsSync(zipPath)) {
            const stats = fs.statSync(zipPath);
            result.fileSize = formatBytes(stats.size);
        }

        // Step 3: Cleanup old backups
        console.log('\n[3/4] Cleaning up old backups...');
        try {
            const cleanupResult = await cleanupBackups();
            result.cleanupResult = {
                kept: cleanupResult.kept.length,
                deleted: cleanupResult.deleted.length,
            };
        } catch (cleanupErr) {
            console.error('Cleanup failed (non-fatal):', cleanupErr);
        }

        // Step 4: Send notification
        console.log('\n[4/4] Sending notification...');
        try {
            const notifyResult = await sendBackupNotification(
                {
                    timestamp,
                    tablesExported: result.tablesExported,
                    totalRows: result.totalRows,
                    errors: result.errors,
                    fileSize: result.fileSize,
                    storagePath: result.storagePath,
                },
                true
            );
            result.notificationSent = notifyResult.success;
        } catch (notifyErr) {
            console.error('Notification failed (non-fatal):', notifyErr);
        }

        // Cleanup local files
        console.log('\nCleaning up local files...');
        try {
            fs.rmSync(exportResult.outputPath, { recursive: true, force: true });
            const zipPath = `${exportResult.outputPath}.zip`;
            if (fs.existsSync(zipPath)) {
                fs.unlinkSync(zipPath);
            }
        } catch {
            console.warn('Could not clean up local files');
        }

        result.success = true;
        console.log('\n' + '='.repeat(50));
        console.log('BACKUP COMPLETED SUCCESSFULLY');
        console.log('='.repeat(50));
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('\n' + '='.repeat(50));
        console.error('BACKUP FAILED:', errorMessage);
        console.error('='.repeat(50));

        // Try to send failure notification
        try {
            await sendBackupNotification(
                {
                    timestamp,
                    tablesExported: result.tablesExported,
                    totalRows: result.totalRows,
                    errors: result.errors + 1,
                },
                false
            );
        } catch {
            console.error('Could not send failure notification');
        }
    }

    // Print summary
    console.log('\n--- SUMMARY ---');
    console.log(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Tables: ${result.tablesExported}`);
    console.log(`Rows: ${result.totalRows}`);
    console.log(`Errors: ${result.errors}`);
    if (result.fileSize) console.log(`Size: ${result.fileSize}`);
    if (result.storagePath) console.log(`Storage: ${result.storagePath}`);
    if (result.cleanupResult) {
        console.log(`Cleanup: ${result.cleanupResult.deleted} deleted, ${result.cleanupResult.kept} kept`);
    }
    console.log(`Notification: ${result.notificationSent ? 'sent' : 'not sent'}`);

    return result;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run if called directly
if (require.main === module) {
    runBackup()
        .then((result) => {
            process.exit(result.success ? 0 : 1);
        })
        .catch((err) => {
            console.error('Unexpected error:', err);
            process.exit(1);
        });
}
