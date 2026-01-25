import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    ExportFormat,
    ExportableTable,
    generateCSV,
    generateXLSX,
    getTableColumns,
    getDateColumn,
    getPrimaryKeyColumn,
    TableData,
} from '@/lib/export';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Valid tables for export (whitelist for security)
const VALID_TABLES: ExportableTable[] = [
    'inventory',
    'sales',
    'sale_items',
    'customers',
    'customer_contacts',
    'products',
    'product_variants',
];

export async function POST(request: NextRequest) {
    try {
        // Get auth token from header
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const token = authHeader.substring(7);
        const supabase = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });

        // Verify user and get role
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        // Check admin role
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role, approved')
            .eq('id', user.id)
            .single();

        if (profileError || !profile?.approved) {
            return NextResponse.json({ error: 'Usuario no aprobado' }, { status: 403 });
        }

        if (profile.role !== 'admin') {
            return NextResponse.json(
                { error: 'Solo administradores pueden exportar datos' },
                { status: 403 }
            );
        }

        // Parse request body
        const body = await request.json();
        const { tables, format, dateRange } = body as {
            tables: string[];
            format: ExportFormat;
            dateRange?: { start: string; end: string };
        };

        // Validate input
        if (!tables || !Array.isArray(tables) || tables.length === 0) {
            return NextResponse.json({ error: 'Debe seleccionar al menos una tabla' }, { status: 400 });
        }

        if (!format || !['csv', 'xlsx'].includes(format)) {
            return NextResponse.json({ error: 'Formato inválido. Use csv o xlsx' }, { status: 400 });
        }

        // Validate tables against whitelist
        const invalidTables = tables.filter((t) => !VALID_TABLES.includes(t as ExportableTable));
        if (invalidTables.length > 0) {
            return NextResponse.json(
                { error: `Tablas inválidas: ${invalidTables.join(', ')}` },
                { status: 400 }
            );
        }

        // Validate date range if provided
        if (dateRange) {
            const startDate = new Date(dateRange.start);
            const endDate = new Date(dateRange.end);
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                return NextResponse.json({ error: 'Rango de fechas inválido' }, { status: 400 });
            }
            if (endDate < startDate) {
                return NextResponse.json(
                    { error: 'La fecha de fin debe ser posterior a la de inicio' },
                    { status: 400 }
                );
            }
        }

        // Fetch data from each table
        const tableDataList: TableData[] = [];
        const MAX_ROWS = 10000; // Limit per table

        for (const tableName of tables as ExportableTable[]) {
            let query = supabase.from(tableName).select('*').limit(MAX_ROWS);

            // Apply date filter if applicable
            const dateColumn = getDateColumn(tableName);
            if (dateRange && dateColumn) {
                query = query.gte(dateColumn, dateRange.start).lte(dateColumn, dateRange.end);
            }

            // Order by created_at or primary key
            if (dateColumn) {
                query = query.order(dateColumn, { ascending: false });
            } else {
                const pkColumn = getPrimaryKeyColumn(tableName);
                query = query.order(pkColumn, { ascending: true });
            }

            const { data, error } = await query;

            if (error) {
                console.error(`Error fetching ${tableName}:`, error);
                return NextResponse.json(
                    { error: `Error al obtener datos de ${tableName}: ${error.message}` },
                    { status: 500 }
                );
            }

            const columns = getTableColumns(tableName);
            // Filter data to only include expected columns
            const filteredData = (data || []).map((row) => {
                const filtered: Record<string, unknown> = {};
                for (const col of columns) {
                    if (col in row) {
                        filtered[col] = row[col];
                    }
                }
                return filtered;
            });

            tableDataList.push({
                name: tableName,
                data: filteredData,
                columns,
            });
        }

        // Generate file based on format
        const timestamp = new Date().toISOString().split('T')[0];

        if (format === 'csv') {
            // For CSV with multiple tables, combine with separators
            if (tables.length === 1) {
                const csvContent = generateCSV(tableDataList[0].data);
                return new NextResponse(csvContent, {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/csv; charset=utf-8',
                        'Content-Disposition': `attachment; filename="${tables[0]}-${timestamp}.csv"`,
                    },
                });
            } else {
                // Multiple tables: combine into single CSV with headers
                let combinedCSV = '';
                for (const table of tableDataList) {
                    combinedCSV += `\n=== ${table.name.toUpperCase()} ===\n`;
                    combinedCSV += generateCSV(table.data);
                    combinedCSV += '\n';
                }
                return new NextResponse(combinedCSV, {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/csv; charset=utf-8',
                        'Content-Disposition': `attachment; filename="export-${timestamp}.csv"`,
                    },
                });
            }
        } else {
            // XLSX format - each table gets its own sheet
            const xlsxBuffer = await generateXLSX(tableDataList);
            const filename = tables.length === 1 ? `${tables[0]}-${timestamp}.xlsx` : `export-${timestamp}.xlsx`;

            // Convert Buffer to Uint8Array for NextResponse compatibility
            const uint8Array = new Uint8Array(xlsxBuffer);

            return new NextResponse(uint8Array, {
                status: 200,
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                },
            });
        }
    } catch (error) {
        console.error('Export error:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

// GET method for simple single-table exports with query params
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const table = searchParams.get('table');
    const format = (searchParams.get('format') || 'xlsx') as ExportFormat;

    if (!table) {
        return NextResponse.json({ error: 'Parámetro table requerido' }, { status: 400 });
    }

    // Redirect to POST with body
    const body = {
        tables: [table],
        format,
        dateRange: searchParams.get('start') && searchParams.get('end')
            ? { start: searchParams.get('start')!, end: searchParams.get('end')! }
            : undefined,
    };

    // Create a new request with the body
    const newRequest = new NextRequest(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(body),
    });

    return POST(newRequest);
}
