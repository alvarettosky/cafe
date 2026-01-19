import { google } from 'googleapis';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';

interface UploadResult {
  fileId: string;
  fileName: string;
  size: number;
  webViewLink: string;
}

export async function uploadToGoogleDrive(
  credentialsJson: string,
  folderId: string,
  localPath: string,
  remoteName?: string
): Promise<UploadResult> {
  // Parse credentials
  const credentials = JSON.parse(credentialsJson);

  // Authenticate with service account
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  const drive = google.drive({ version: 'v3', auth });

  // Get file stats
  const stats = await fs.stat(localPath);
  const fileName = remoteName || path.basename(localPath);

  console.log(`Subiendo ${fileName} (${stats.size} bytes) a Google Drive...`);

  // Upload file
  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      body: createReadStream(localPath),
    },
    fields: 'id,name,size,webViewLink',
  });

  console.log(`✓ Subido: ${response.data.name} (ID: ${response.data.id})`);

  return {
    fileId: response.data.id!,
    fileName: response.data.name!,
    size: parseInt(response.data.size || '0'),
    webViewLink: response.data.webViewLink || '',
  };
}

export async function uploadDirectory(
  credentialsJson: string,
  folderId: string,
  localDir: string
): Promise<UploadResult[]> {
  const files = await fs.readdir(localDir);
  const results: UploadResult[] = [];

  for (const file of files) {
    const localPath = path.join(localDir, file);
    const stat = await fs.stat(localPath);

    if (stat.isFile()) {
      const result = await uploadToGoogleDrive(credentialsJson, folderId, localPath);
      results.push(result);
    }
  }

  return results;
}

// CLI execution
if (require.main === module) {
  const credentials = process.env.GOOGLE_DRIVE_CREDENTIALS;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const localPath = process.argv[2];

  if (!credentials || !folderId) {
    console.error('Error: GOOGLE_DRIVE_CREDENTIALS y GOOGLE_DRIVE_FOLDER_ID son requeridos');
    process.exit(1);
  }

  if (!localPath) {
    console.error('Uso: npx tsx upload-to-gdrive.ts <archivo-o-directorio>');
    process.exit(1);
  }

  fs.stat(localPath)
    .then(async stats => {
      if (stats.isDirectory()) {
        const results = await uploadDirectory(credentials, folderId, localPath);
        console.log(`\n✓ Subidos ${results.length} archivo(s)`);
        results.forEach(r => console.log(`  - ${r.fileName}: ${r.size} bytes`));
      } else {
        await uploadToGoogleDrive(credentials, folderId, localPath);
      }
    })
    .catch(error => {
      console.error('Subida falló:', error);
      process.exit(1);
    });
}
