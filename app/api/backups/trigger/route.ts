import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
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
                { error: 'Solo administradores pueden ejecutar backups' },
                { status: 403 }
            );
        }

        // Check GitHub configuration
        const githubToken = process.env.GITHUB_TOKEN;
        const githubRepo = process.env.GITHUB_REPOSITORY || 'alvarettosky/cafe';

        if (!githubToken) {
            return NextResponse.json(
                {
                    error: 'GitHub no configurado',
                    message: 'Configure GITHUB_TOKEN en las variables de entorno para habilitar backups manuales'
                },
                { status: 400 }
            );
        }

        // Trigger GitHub Actions workflow
        const [owner, repo] = githubRepo.split('/');

        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/actions/workflows/daily-backup.yml/dispatches`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${githubToken}`,
                    Accept: 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ref: 'main',
                    inputs: {
                        debug: 'false',
                    },
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('GitHub API error:', response.status, errorText);
            return NextResponse.json(
                { error: 'Error al ejecutar backup en GitHub' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Backup iniciado. Recibirás una notificación cuando termine.',
        });
    } catch (error) {
        console.error('Trigger backup error:', error);
        return NextResponse.json(
            { error: 'Error al iniciar backup' },
            { status: 500 }
        );
    }
}
