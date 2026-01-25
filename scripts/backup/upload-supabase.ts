/**
 * Upload backup files to Supabase Storage
 * Uses existing Supabase configuration - no additional setup required
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

interface UploadResult {
    success: boolean;
    path?: string;
    fileName: string;
    publicUrl?: string;
    error?: string;
}

const BUCKET_NAME = 'backups';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdmin = SupabaseClient<any, 'public', any>;

function getSupabaseAdmin(): SupabaseAdmin {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

async function ensureBucketExists(supabase: SupabaseAdmin) {
    const { data: buckets } = await supabase.storage.listBuckets();

    const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

    if (!bucketExists) {
        console.log(`Creating bucket '${BUCKET_NAME}'...`);
        const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
            public: false,
            fileSizeLimit: 52428800, // 50MB
        });

        if (error) {
            throw new Error(`Failed to create bucket: ${error.message}`);
        }
        console.log(`  Bucket '${BUCKET_NAME}' created`);
    }
}

export async function uploadToSupabaseStorage(
    localPath: string,
    fileName?: string
): Promise<UploadResult> {
    const finalFileName = fileName || path.basename(localPath);

    try {
        const supabase = getSupabaseAdmin();

        // Ensure bucket exists
        await ensureBucketExists(supabase);

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
            const result = await uploadFile(supabase, zipPath, zipFileName);

            // Clean up local zip
            fs.unlinkSync(zipPath);

            return result;
        } else {
            return await uploadFile(supabase, localPath, finalFileName);
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
    supabase: SupabaseAdmin,
    filePath: string,
    fileName: string
): Promise<UploadResult> {
    console.log(`Uploading ${fileName} to Supabase Storage...`);

    const fileBuffer = fs.readFileSync(filePath);

    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, fileBuffer, {
            contentType: 'application/zip',
            upsert: false,
        });

    if (error) {
        return {
            success: false,
            fileName,
            error: error.message,
        };
    }

    console.log(`  Uploaded: ${data.path}`);

    // Get signed URL (valid for 7 days)
    const { data: urlData } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(data.path, 60 * 60 * 24 * 7);

    return {
        success: true,
        path: data.path,
        fileName,
        publicUrl: urlData?.signedUrl,
    };
}

export async function listBackups(limit: number = 10): Promise<
    {
        name: string;
        createdAt: string;
        size: number;
        signedUrl: string;
    }[]
> {
    const supabase = getSupabaseAdmin();

    const { data: files, error } = await supabase.storage.from(BUCKET_NAME).list('', {
        limit,
        sortBy: { column: 'created_at', order: 'desc' },
    });

    if (error) {
        throw new Error(`Failed to list backups: ${error.message}`);
    }

    const results = [];
    for (const file of files || []) {
        if (file.name) {
            const { data: urlData } = await supabase.storage
                .from(BUCKET_NAME)
                .createSignedUrl(file.name, 60 * 60); // 1 hour

            results.push({
                name: file.name,
                createdAt: file.created_at || '',
                size: file.metadata?.size || 0,
                signedUrl: urlData?.signedUrl || '',
            });
        }
    }

    return results;
}

export async function deleteBackup(fileName: string): Promise<boolean> {
    try {
        const supabase = getSupabaseAdmin();

        const { error } = await supabase.storage.from(BUCKET_NAME).remove([fileName]);

        if (error) {
            console.error(`  Failed to delete ${fileName}:`, error);
            return false;
        }

        console.log(`  Deleted: ${fileName}`);
        return true;
    } catch (err) {
        console.error(`  Failed to delete ${fileName}:`, err);
        return false;
    }
}

// Run if called directly (for testing)
if (require.main === module) {
    const testPath = process.argv[2];
    if (testPath) {
        uploadToSupabaseStorage(testPath)
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
                files.forEach((f) => console.log(`  ${f.name} (${f.createdAt})`));
            })
            .catch((err) => {
                console.error('List failed:', err);
                process.exit(1);
            });
    }
}
