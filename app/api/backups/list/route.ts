import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface BackupFile {
    id: string;
    name: string;
    createdTime: string;
    size: string;
    webViewLink: string;
}

function getGoogleAuth() {
    const credentialsJson = process.env.GOOGLE_DRIVE_CREDENTIALS;

    if (!credentialsJson) {
        return null;
    }

    try {
        let credentials;
        try {
            const decoded = Buffer.from(credentialsJson, 'base64').toString('utf-8');
            credentials = JSON.parse(decoded);
        } catch {
            credentials = JSON.parse(credentialsJson);
        }

        return new google.auth.GoogleAuth({
            credentials: {
                client_email: credentials.client_email,
                private_key: credentials.private_key,
            },
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
    } catch {
        return null;
    }
}

export async function GET(request: NextRequest) {
    try {
        // Verify authentication
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const token = authHeader.substring(7);
        const supabase = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });

        // Verify user and admin role
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role, approved')
            .eq('id', user.id)
            .single();

        if (!profile?.approved || profile.role !== 'admin') {
            return NextResponse.json(
                { error: 'Solo administradores pueden ver backups' },
                { status: 403 }
            );
        }

        // Check if Google Drive is configured
        const auth = getGoogleAuth();
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

        if (!auth || !folderId) {
            return NextResponse.json({
                backups: [],
                configured: false,
                message: 'Google Drive no configurado',
            });
        }

        // List backups from Google Drive
        const drive = google.drive({ version: 'v3', auth });

        const response = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name, createdTime, size, webViewLink)',
            orderBy: 'createdTime desc',
            pageSize: 20,
        });

        const backups: BackupFile[] = (response.data.files || []).map((file) => ({
            id: file.id || '',
            name: file.name || '',
            createdTime: file.createdTime || '',
            size: formatBytes(parseInt(file.size || '0', 10)),
            webViewLink: file.webViewLink || '',
        }));

        return NextResponse.json({
            backups,
            configured: true,
        });
    } catch (error) {
        console.error('List backups error:', error);
        return NextResponse.json(
            { error: 'Error al listar backups' },
            { status: 500 }
        );
    }
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
