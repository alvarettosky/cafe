#!/usr/bin/env node
import { promises as fs } from 'fs';
import { exportToJSON } from './export-to-json';
import { exportToSQL } from './export-to-sql';
import { uploadDirectory, uploadToGoogleDrive } from './upload-to-gdrive';
import { cleanupOldBackups } from './cleanup-old-backups';
import { sendBackupNotification } from './send-notification';

async function main() {
  const timestamp = new Date().toISOString().split('T')[0];
  const isFirstDayOfMonth = new Date().getDate() === 1;
  const tempDir = `./backups/temp-${Date.now()}`;

  // Validate required environment variables
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GOOGLE_DRIVE_CREDENTIALS',
    'GOOGLE_DRIVE_DAILY_FOLDER_ID',
    'GOOGLE_DRIVE_WEEKLY_FOLDER_ID',
    'GOOGLE_DRIVE_MONTHLY_FOLDER_ID',
    'RESEND_API_KEY',
    'NOTIFICATION_EMAIL',
  ];

  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingVars.length > 0) {
    console.error(`Error: Faltan variables de entorno: ${missingVars.join(', ')}`);
    process.exit(1);
  }

  try {
    console.log('=== Iniciando Proceso de Backup ===');
    console.log(`Fecha: ${timestamp}`);
    console.log(`Primer día del mes: ${isFirstDayOfMonth}\n`);

    // 1. Export to JSON
    console.log('Paso 1: Exportando a JSON...');
    const { results, metadata } = await exportToJSON(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      tempDir
    );

    // Check for failures
    const failedTables = results.filter(r => !r.success);
    if (failedTables.length > 0) {
      console.warn(`⚠️ ${failedTables.length} tabla(s) fallaron durante exportación`);
    }

    // 2. Export to SQL (monthly only)
    if (isFirstDayOfMonth) {
      console.log('\nPaso 2: Generando SQL dump (mensual)...');
      const sqlPath = `${tempDir}/monthly-${timestamp}.sql.gz`;
      await exportToSQL(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        sqlPath
      );
    }

    // 3. Upload to Google Drive
    console.log('\nPaso 3: Subiendo a Google Drive...');
    const folderId = isFirstDayOfMonth
      ? process.env.GOOGLE_DRIVE_MONTHLY_FOLDER_ID!
      : process.env.GOOGLE_DRIVE_DAILY_FOLDER_ID!;

    const uploadResults = await uploadDirectory(
      process.env.GOOGLE_DRIVE_CREDENTIALS!,
      folderId,
      tempDir
    );

    const driveLink = uploadResults[0]?.webViewLink;

    // 4. Cleanup old backups
    console.log('\nPaso 4: Limpiando backups antiguos...');
    const cleanupStats = await cleanupOldBackups(
      process.env.GOOGLE_DRIVE_CREDENTIALS!,
      process.env.GOOGLE_DRIVE_DAILY_FOLDER_ID!,
      process.env.GOOGLE_DRIVE_WEEKLY_FOLDER_ID!,
      process.env.GOOGLE_DRIVE_MONTHLY_FOLDER_ID!
    );

    console.log(
      `Eliminados: ${cleanupStats.dailyDeleted} diarios, ${cleanupStats.weeklyDeleted} semanales, ${cleanupStats.monthlyDeleted} mensuales`
    );

    // 5. Send success notification
    console.log('\nPaso 5: Enviando notificación...');
    await sendBackupNotification(
      process.env.RESEND_API_KEY!,
      process.env.NOTIFICATION_EMAIL!,
      {
        success: failedTables.length === 0,
        metadata,
        results,
        driveLink,
      }
    );

    // 6. Cleanup temp directory
    await fs.rm(tempDir, { recursive: true });

    console.log('\n=== Backup Completo ===');

    if (failedTables.length > 0) {
      console.warn(`⚠️ Completado con ${failedTables.length} error(es)`);
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n=== Backup Falló ===');
    console.error(error);

    // Send error notification
    try {
      await sendBackupNotification(
        process.env.RESEND_API_KEY!,
        process.env.NOTIFICATION_EMAIL!,
        {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    } catch (notifError) {
      console.error('Error enviando notificación:', notifError);
    }

    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }

    process.exit(1);
  }
}

main();
