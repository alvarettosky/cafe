import { google } from 'googleapis';

interface CleanupStats {
  dailyDeleted: number;
  weeklyDeleted: number;
  monthlyDeleted: number;
}

export async function cleanupOldBackups(
  credentialsJson: string,
  dailyFolderId: string,
  weeklyFolderId: string,
  monthlyFolderId: string
): Promise<CleanupStats> {
  const credentials = JSON.parse(credentialsJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });

  const now = new Date();
  const stats: CleanupStats = {
    dailyDeleted: 0,
    weeklyDeleted: 0,
    monthlyDeleted: 0,
  };

  // Cleanup daily backups (keep last 7 days)
  console.log('Limpiando backups diarios...');
  const dailyFiles = await drive.files.list({
    q: `'${dailyFolderId}' in parents and trashed=false`,
    fields: 'files(id,name,createdTime)',
  });

  for (const file of dailyFiles.data.files || []) {
    const createdDate = new Date(file.createdTime!);
    const ageInDays = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

    if (ageInDays > 7) {
      // Move Sunday backups to weekly folder
      if (createdDate.getDay() === 0 && ageInDays <= 30) {
        console.log(`Moviendo ${file.name} a carpeta semanal`);
        await drive.files.update({
          fileId: file.id!,
          addParents: weeklyFolderId,
          removeParents: dailyFolderId,
          fields: 'id',
        });
      } else {
        console.log(`Eliminando backup diario antiguo: ${file.name} (${ageInDays.toFixed(0)} días)`);
        await drive.files.delete({ fileId: file.id! });
        stats.dailyDeleted++;
      }
    }
  }

  // Cleanup weekly backups (keep last 4 weeks)
  console.log('Limpiando backups semanales...');
  const weeklyFiles = await drive.files.list({
    q: `'${weeklyFolderId}' in parents and trashed=false`,
    fields: 'files(id,name,createdTime)',
  });

  for (const file of weeklyFiles.data.files || []) {
    const createdDate = new Date(file.createdTime!);
    const ageInDays = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

    if (ageInDays > 30) {
      // Move last Sunday of month to monthly folder
      const isLastSundayOfMonth =
        createdDate.getDay() === 0 &&
        new Date(createdDate.getFullYear(), createdDate.getMonth() + 1, 0).getDate() -
          createdDate.getDate() <
          7;

      if (isLastSundayOfMonth && ageInDays <= 365) {
        console.log(`Moviendo ${file.name} a carpeta mensual`);
        await drive.files.update({
          fileId: file.id!,
          addParents: monthlyFolderId,
          removeParents: weeklyFolderId,
          fields: 'id',
        });
      } else {
        console.log(`Eliminando backup semanal antiguo: ${file.name}`);
        await drive.files.delete({ fileId: file.id! });
        stats.weeklyDeleted++;
      }
    }
  }

  // Cleanup monthly backups (keep last 12 months)
  console.log('Limpiando backups mensuales...');
  const monthlyFiles = await drive.files.list({
    q: `'${monthlyFolderId}' in parents and trashed=false`,
    fields: 'files(id,name,createdTime)',
  });

  for (const file of monthlyFiles.data.files || []) {
    const createdDate = new Date(file.createdTime!);
    const ageInDays = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

    if (ageInDays > 365) {
      console.log(`Eliminando backup mensual antiguo: ${file.name}`);
      await drive.files.delete({ fileId: file.id! });
      stats.monthlyDeleted++;
    }
  }

  return stats;
}

// CLI execution
if (require.main === module) {
  const credentials = process.env.GOOGLE_DRIVE_CREDENTIALS;
  const dailyId = process.env.GOOGLE_DRIVE_DAILY_FOLDER_ID;
  const weeklyId = process.env.GOOGLE_DRIVE_WEEKLY_FOLDER_ID;
  const monthlyId = process.env.GOOGLE_DRIVE_MONTHLY_FOLDER_ID;

  if (!credentials || !dailyId || !weeklyId || !monthlyId) {
    console.error(
      'Error: GOOGLE_DRIVE_CREDENTIALS, GOOGLE_DRIVE_DAILY_FOLDER_ID, GOOGLE_DRIVE_WEEKLY_FOLDER_ID y GOOGLE_DRIVE_MONTHLY_FOLDER_ID son requeridos'
    );
    process.exit(1);
  }

  cleanupOldBackups(credentials, dailyId, weeklyId, monthlyId)
    .then(stats => {
      console.log('\n=== Limpieza Completa ===');
      console.log(`Diarios eliminados: ${stats.dailyDeleted}`);
      console.log(`Semanales eliminados: ${stats.weeklyDeleted}`);
      console.log(`Mensuales eliminados: ${stats.monthlyDeleted}`);
    })
    .catch(error => {
      console.error('Limpieza falló:', error);
      process.exit(1);
    });
}
