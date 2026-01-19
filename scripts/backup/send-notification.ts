import { Resend } from 'resend';
import { BackupMetadata, TableExportResult } from './types';

interface NotificationData {
  success: boolean;
  metadata?: BackupMetadata;
  results?: TableExportResult[];
  error?: string;
  driveLink?: string;
}

export async function sendBackupNotification(
  resendApiKey: string,
  recipientEmail: string,
  data: NotificationData
): Promise<void> {
  const resend = new Resend(resendApiKey);

  if (data.success && data.metadata && data.results) {
    // Success email
    const totalRows = Object.values(data.metadata.tables).reduce((sum, t) => sum + t.rows, 0);
    const totalSize = Object.values(data.metadata.tables).reduce(
      (sum, t) => sum + t.size_bytes,
      0
    );

    const tablesList = Object.entries(data.metadata.tables)
      .map(
        ([name, info]) =>
          `  - ${name}: ${info.rows} registros (${(info.size_bytes / 1024).toFixed(1)} KB)`
      )
      .join('\n');

    const html = `
      <h2 style="color: #22c55e;">✅ Backup Diario Exitoso - Café Mirador</h2>
      <p><strong>Fecha/Hora:</strong> ${new Date(data.metadata.timestamp).toLocaleString('es-CO')}</p>
      <p><strong>Duración:</strong> ${data.metadata.duration_seconds} segundos</p>
      <p><strong>Total de registros:</strong> ${totalRows.toLocaleString()}</p>
      <p><strong>Tamaño total:</strong> ${(totalSize / 1024 / 1024).toFixed(2)} MB</p>

      <h3>Tablas incluidas:</h3>
      <pre style="background: #f3f4f6; padding: 12px; border-radius: 4px;">${tablesList}</pre>

      <p><strong>Hash SHA-256:</strong> <code style="background: #f3f4f6; padding: 2px 6px;">${data.metadata.hash_sha256}</code></p>

      ${data.driveLink ? `<p><a href="${data.driveLink}" style="color: #3b82f6;">Ver en Google Drive</a></p>` : ''}

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="color: #6b7280; font-size: 12px;">GitHub Run ID: ${data.metadata.github_run_id || 'N/A'}</p>
    `;

    await resend.emails.send({
      from: 'Backup System <backups@cafemirador.com>',
      to: recipientEmail,
      subject: '✅ Backup Diario Exitoso - Café Mirador',
      html,
    });

    console.log('✓ Notificación de éxito enviada');
  } else {
    // Error email
    const failedTables =
      data.results
        ?.filter(r => !r.success)
        .map(r => `  - ${r.tableName}: ${r.error}`)
        .join('\n') || 'Error desconocido';

    const html = `
      <h2 style="color: #ef4444;">⚠️ Error en Backup Automático - Café Mirador</h2>
      <p><strong>Fecha/Hora:</strong> ${new Date().toLocaleString('es-CO')}</p>

      <h3>Tablas que fallaron:</h3>
      <pre style="background: #fef2f2; padding: 12px; border-radius: 4px; color: #991b1b;">${failedTables}</pre>

      ${data.error ? `<p><strong>Error general:</strong></p><pre style="background: #fef2f2; padding: 12px; border-radius: 4px; color: #991b1b;">${data.error}</pre>` : ''}

      <h3>Acción recomendada:</h3>
      <p>Revisar los logs de GitHub Actions y verificar:</p>
      <ul>
        <li>Conexión a Supabase</li>
        <li>Credenciales de Google Drive</li>
        <li>Permisos de la service account</li>
      </ul>
    `;

    await resend.emails.send({
      from: 'Backup System <backups@cafemirador.com>',
      to: recipientEmail,
      subject: '⚠️ Error en Backup Automático - Café Mirador',
      html,
    });

    console.log('✓ Notificación de error enviada');
  }
}

// CLI execution for testing
if (require.main === module) {
  const apiKey = process.env.RESEND_API_KEY;
  const email = process.env.NOTIFICATION_EMAIL;
  const testType = process.argv[2] || 'success';

  if (!apiKey || !email) {
    console.error('Error: RESEND_API_KEY y NOTIFICATION_EMAIL son requeridos');
    process.exit(1);
  }

  const mockData: NotificationData =
    testType === 'success'
      ? {
          success: true,
          metadata: {
            timestamp: new Date().toISOString(),
            tables: {
              inventory: { rows: 15, size_bytes: 2048 },
              sales: { rows: 1234, size_bytes: 45000 },
              customers: { rows: 89, size_bytes: 5600 },
            },
            duration_seconds: 8,
            hash_sha256: 'abc123def456...',
          },
          results: [],
          driveLink: 'https://drive.google.com/drive/folders/example',
        }
      : {
          success: false,
          error: 'Connection timeout',
          results: [
            { tableName: 'sales', rows: 0, sizeBytes: 0, success: false, error: 'Timeout' },
          ],
        };

  sendBackupNotification(apiKey, email, mockData)
    .then(() => console.log('Notificación enviada'))
    .catch(error => {
      console.error('Error enviando notificación:', error);
      process.exit(1);
    });
}
