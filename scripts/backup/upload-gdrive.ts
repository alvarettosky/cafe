/**
 * Upload backup files to Google Drive
 * Requires Google Cloud service account credentials
 */

import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

interface UploadResult {
    success: boolean;
    fileId?: string;
    fileName: string;
    webViewLink?: string;
    error?: string;
}

interface GoogleDriveCredentials {
    client_email: string;
    private_key: string;
}

function getCredentials(): GoogleDriveCredentials {
    const credentialsJson = process.env.GOOGLE_DRIVE_CREDENTIALS;

    if (!credentialsJson) {
        throw new Error('Missing GOOGLE_DRIVE_CREDENTIALS environment variable');
    }

    // Credentials might be base64 encoded for GitHub secrets
    try {
        const decoded = Buffer.from(credentialsJson, 'base64').toString('utf-8');
        return JSON.parse(decoded);
    } catch {
        // Try parsing directly if not base64
        return JSON.parse(credentialsJson);
    }
}

function getAuth() {
    const credentials = getCredentials();

    return new google.auth.GoogleAuth({
        credentials: {
            client_email: credentials.client_email,
            private_key: credentials.private_key,
        },
        scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
}

export async function uploadToGoogleDrive(
    localPath: string,
    fileName?: string
): Promise<UploadResult> {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!folderId) {
        throw new Error('Missing GOOGLE_DRIVE_FOLDER_ID environment variable');
    }

    const finalFileName = fileName || path.basename(localPath);

    try {
        const auth = getAuth();
        const drive = google.drive({ version: 'v3', auth });

        // Check if it's a directory (backup folder) or single file
        const stats = fs.statSync(localPath);

        if (stats.isDirectory()) {
            // Create a zip file from the directory
            const archiver = await import('archiver');
            const zipPath = `${localPath}.zip`;
            const zipFileName = `${finalFileName}.zip`;

            await new Promise<void>((resolve, reject) => {
                const output = fs.createWriteStream(zipPath);
                const archive = archiver.default('zip', { zlib: { level: 9 } });

                output.on('close', () => resolve());
                archive.on('error', (err: Error) => reject(err));

                archive.pipe(output);
                archive.directory(localPath, false);
                archive.finalize();
            });

            // Upload the zip file
            const result = await uploadFile(drive, zipPath, zipFileName, folderId);

            // Clean up local zip
            fs.unlinkSync(zipPath);

            return result;
        } else {
            return await uploadFile(drive, localPath, finalFileName, folderId);
        }
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        return {
            success: false,
            fileName: finalFileName,
            error: errorMessage,
        };
    }
}

async function uploadFile(
    drive: ReturnType<typeof google.drive>,
    filePath: string,
    fileName: string,
    folderId: string
): Promise<UploadResult> {
    console.log(`Uploading ${fileName} to Google Drive...`);

    const fileMetadata = {
        name: fileName,
        parents: [folderId],
    };

    const media = {
        mimeType: 'application/octet-stream',
        body: fs.createReadStream(filePath),
    };

    const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink',
        supportsAllDrives: true,
    });

    console.log(`  Uploaded: ${response.data.name} (${response.data.id})`);

    return {
        success: true,
        fileId: response.data.id || undefined,
        fileName: response.data.name || fileName,
        webViewLink: response.data.webViewLink || undefined,
    };
}

export async function listBackups(limit: number = 10): Promise<
    {
        id: string;
        name: string;
        createdTime: string;
        size: string;
        webViewLink: string;
    }[]
> {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!folderId) {
        throw new Error('Missing GOOGLE_DRIVE_FOLDER_ID environment variable');
    }

    const auth = getAuth();
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, createdTime, size, webViewLink)',
        orderBy: 'createdTime desc',
        pageSize: limit,
    });

    return (response.data.files || []).map((file) => ({
        id: file.id || '',
        name: file.name || '',
        createdTime: file.createdTime || '',
        size: file.size || '0',
        webViewLink: file.webViewLink || '',
    }));
}

export async function deleteFile(fileId: string): Promise<boolean> {
    try {
        const auth = getAuth();
        const drive = google.drive({ version: 'v3', auth });

        await drive.files.delete({ fileId });
        console.log(`  Deleted file: ${fileId}`);
        return true;
    } catch (err) {
        console.error(`  Failed to delete ${fileId}:`, err);
        return false;
    }
}

// Run if called directly (for testing)
if (require.main === module) {
    const testPath = process.argv[2];
    if (testPath) {
        uploadToGoogleDrive(testPath)
            .then((result) => {
                console.log('Upload result:', result);
                if (!result.success) {
                    process.exit(1);
                }
            })
            .catch((err) => {
                console.error('Upload failed:', err);
                process.exit(1);
            });
    } else {
        // List existing backups
        listBackups()
            .then((files) => {
                console.log('Recent backups:');
                files.forEach((f) => console.log(`  ${f.name} (${f.createdTime})`));
            })
            .catch((err) => {
                console.error('List failed:', err);
                process.exit(1);
            });
    }
}
