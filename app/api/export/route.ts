'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateCSV, generateXLSX, createZipArchive } from '@/lib/export-utils';

const ALLOWED_TABLES = [
  'inventory',
  'sales',
  'sale_items',
  'customers',
  'customer_contacts',
  'profiles',
] as const;

const MAX_ROWS = 10000;

// Create server-side supabase client with service role for bypassing RLS if needed
function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabase();

    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      await supabase.auth.setSession({ access_token: token, refresh_token: '' });
    }

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Acceso denegado - Solo admins' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { tables, format, dateRange } = body;

    // Validate tables
    if (!Array.isArray(tables) || tables.length === 0) {
      return NextResponse.json({ error: 'Parámetro tables inválido' }, { status: 400 });
    }

    for (const table of tables) {
      if (!ALLOWED_TABLES.includes(table as (typeof ALLOWED_TABLES)[number])) {
        return NextResponse.json({ error: `Tabla inválida: ${table}` }, { status: 400 });
      }
    }

    // Validate format
    if (format !== 'csv' && format !== 'xlsx') {
      return NextResponse.json({ error: 'Formato inválido. Use "csv" o "xlsx"' }, { status: 400 });
    }

    // Export each table
    const files: { name: string; content: Buffer | string }[] = [];
    let totalRows = 0;
    let totalSize = 0;

    for (const tableName of tables) {
      let query = supabase.from(tableName).select('*');

      // Apply date range filter if provided
      if (dateRange?.start && dateRange?.end) {
        // Determine date column based on table
        const dateColumn =
          tableName === 'sales'
            ? 'created_at'
            : tableName === 'customers'
              ? 'last_purchase_date'
              : tableName === 'customer_contacts'
                ? 'contacted_at'
                : 'created_at';

        query = query.gte(dateColumn, dateRange.start).lte(dateColumn, dateRange.end);
      }

      // Limit rows
      query = query.limit(MAX_ROWS);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Error obteniendo ${tableName}: ${error.message}`);
      }

      if (!data || data.length === 0) {
        continue; // Skip empty tables
      }

      totalRows += data.length;

      // Generate file
      let content: Buffer | string;
      let fileName: string;

      if (format === 'csv') {
        content = await generateCSV(data);
        fileName = `${tableName}.csv`;
        totalSize += Buffer.byteLength(content);
      } else {
        content = await generateXLSX(data, tableName);
        fileName = `${tableName}.xlsx`;
        totalSize += content.length;
      }

      files.push({ name: fileName, content });
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No hay datos para exportar' }, { status: 404 });
    }

    // Log to audit table (best effort)
    try {
      await supabase.from('backup_audit_log').insert({
        user_id: user.id,
        action: 'manual_export',
        tables,
        format,
        success: true,
        file_size_bytes: totalSize,
        row_count: totalRows,
      });
    } catch {
      // Ignore audit log errors
    }

    // Return single file or zip
    if (files.length === 1) {
      const file = files[0];
      const headers = new Headers();
      headers.set(
        'Content-Type',
        format === 'csv'
          ? 'text/csv; charset=utf-8'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      headers.set('Content-Disposition', `attachment; filename="${file.name}"`);

      return new NextResponse(file.content, { headers });
    } else {
      // Multiple tables - create zip
      const zipBuffer = await createZipArchive(files);
      const timestamp = new Date().toISOString().split('T')[0];
      const zipName = `cafe-mirador-export-${timestamp}.zip`;

      const headers = new Headers();
      headers.set('Content-Type', 'application/zip');
      headers.set('Content-Disposition', `attachment; filename="${zipName}"`);

      return new NextResponse(zipBuffer, { headers });
    }
  } catch (error) {
    console.error('Error de exportación:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Exportación falló' },
      { status: 500 }
    );
  }
}
