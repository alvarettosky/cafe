/**
 * Send backup notification emails via Resend
 */

import { Resend } from 'resend';

interface BackupStats {
    timestamp: string;
    tablesExported: number;
    totalRows: number;
    errors: number;
    fileSize?: string;
    driveLink?: string;
}

interface NotificationResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

export async function sendBackupNotification(
    stats: BackupStats,
    isSuccess: boolean
): Promise<NotificationResult> {
    const apiKey = process.env.RESEND_API_KEY;
    const recipientEmail = process.env.NOTIFICATION_EMAIL;

    if (!apiKey) {
        console.warn('RESEND_API_KEY not configured, skipping notification');
        return { success: true, error: 'Notifications not configured' };
    }

    if (!recipientEmail) {
        console.warn('NOTIFICATION_EMAIL not configured, skipping notification');
        return { success: true, error: 'Recipient not configured' };
    }

    const resend = new Resend(apiKey);

    const status = isSuccess ? 'Completado' : 'Fallido';
    const statusEmoji = isSuccess ? '✅' : '❌';
    const subject = `${statusEmoji} Backup Cafe Mirador - ${status} (${stats.timestamp})`;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${isSuccess ? '#10b981' : '#ef4444'}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .stat { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .stat:last-child { border-bottom: none; }
        .label { color: #6b7280; }
        .value { font-weight: bold; }
        .button { display: inline-block; background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        .footer { margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">${statusEmoji} Backup ${status}</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">${stats.timestamp}</p>
        </div>
        <div class="content">
          <div class="stat">
            <span class="label">Tablas exportadas</span>
            <span class="value">${stats.tablesExported}</span>
          </div>
          <div class="stat">
            <span class="label">Total registros</span>
            <span class="value">${stats.totalRows.toLocaleString()}</span>
          </div>
          <div class="stat">
            <span class="label">Errores</span>
            <span class="value" style="color: ${stats.errors > 0 ? '#ef4444' : '#10b981'};">${stats.errors}</span>
          </div>
          ${
              stats.fileSize
                  ? `
          <div class="stat">
            <span class="label">Tamaño archivo</span>
            <span class="value">${stats.fileSize}</span>
          </div>`
                  : ''
          }
          ${
              stats.driveLink
                  ? `
          <a href="${stats.driveLink}" class="button">Ver en Google Drive</a>`
                  : ''
          }
        </div>
        <div class="footer">
          Sistema de Backup Automatico - Cafe Mirador CRM
        </div>
      </div>
    </body>
    </html>
    `;

    const textContent = `
Backup Cafe Mirador - ${status}
================================
Fecha: ${stats.timestamp}
Tablas exportadas: ${stats.tablesExported}
Total registros: ${stats.totalRows}
Errores: ${stats.errors}
${stats.fileSize ? `Tamaño: ${stats.fileSize}` : ''}
${stats.driveLink ? `Link: ${stats.driveLink}` : ''}
    `.trim();

    try {
        console.log(`Sending notification email to ${recipientEmail}...`);

        const { data, error } = await resend.emails.send({
            from: 'Cafe Mirador <backups@resend.dev>',
            to: [recipientEmail],
            subject,
            html: htmlContent,
            text: textContent,
        });

        if (error) {
            console.error('Email send error:', error);
            return { success: false, error: error.message };
        }

        console.log(`  Email sent successfully: ${data?.id}`);
        return { success: true, messageId: data?.id };
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Email send exception:', errorMessage);
        return { success: false, error: errorMessage };
    }
}

// Run if called directly (for testing)
if (require.main === module) {
    const testStats: BackupStats = {
        timestamp: new Date().toISOString(),
        tablesExported: 20,
        totalRows: 1500,
        errors: 0,
        fileSize: '2.5 MB',
        driveLink: 'https://drive.google.com/file/d/example',
    };

    sendBackupNotification(testStats, true)
        .then((result) => {
            console.log('Notification result:', result);
            if (!result.success) {
                process.exit(1);
            }
        })
        .catch((err) => {
            console.error('Notification failed:', err);
            process.exit(1);
        });
}
