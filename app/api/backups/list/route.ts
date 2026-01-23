import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BUCKET_NAME = 'backups';

interface BackupFile {
    id: string;
    name: string;
    createdTime: string;
    size: string;
    downloadUrl: string;
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

        // Check if service role key is available
        if (!serviceRoleKey) {
            return NextResponse.json({
                backups: [],
                configured: false,
                message: 'Supabase Storage no configurado (falta service role key)',
            });
        }

        // Create admin client for storage operations
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        // List backups from Supabase Storage
        const { data: files, error: listError } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .list('', {
                limit: 20,
                sortBy: { column: 'created_at', order: 'desc' },
            });

        if (listError) {
            // Bucket might not exist yet
            if (listError.message.includes('not found')) {
                return NextResponse.json({
                    backups: [],
                    configured: true,
                    message: 'No hay backups aún',
                });
            }
            throw listError;
        }

        // Get signed URLs for each file
        const backups: BackupFile[] = [];
        for (const file of files || []) {
            if (file.name) {
                const { data: urlData } = await supabaseAdmin.storage
                    .from(BUCKET_NAME)
                    .createSignedUrl(file.name, 60 * 60); // 1 hour

                backups.push({
                    id: file.id || file.name,
                    name: file.name,
                    createdTime: file.created_at || '',
                    size: formatBytes(file.metadata?.size || 0),
                    downloadUrl: urlData?.signedUrl || '',
                });
            }
        }

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
