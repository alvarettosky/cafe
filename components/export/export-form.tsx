'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase';
import type { ExportableTable, ExportFormat } from '@/lib/export';

interface TableOption {
    id: ExportableTable;
    label: string;
    description: string;
    supportsDateFilter: boolean;
}

const TABLE_OPTIONS: TableOption[] = [
    {
        id: 'inventory',
        label: 'Inventario',
        description: 'Productos, stock y precios',
        supportsDateFilter: false,
    },
    {
        id: 'sales',
        label: 'Ventas',
        description: 'Historial de ventas',
        supportsDateFilter: true,
    },
    {
        id: 'sale_items',
        label: 'Items de Venta',
        description: 'Detalle de productos vendidos',
        supportsDateFilter: true,
    },
    {
        id: 'customers',
        label: 'Clientes',
        description: 'Datos de clientes y recurrencia',
        supportsDateFilter: false,
    },
    {
        id: 'customer_contacts',
        label: 'Contactos',
        description: 'Historial de contactos',
        supportsDateFilter: true,
    },
    {
        id: 'products',
        label: 'Productos (Catálogo)',
        description: 'Catálogo de productos',
        supportsDateFilter: false,
    },
    {
        id: 'product_variants',
        label: 'Variantes',
        description: 'Variantes de productos',
        supportsDateFilter: false,
    },
];

export function ExportForm() {
    const { isAdmin, session } = useAuth();
    const [selectedTables, setSelectedTables] = useState<ExportableTable[]>([]);
    const [format, setFormat] = useState<ExportFormat>('xlsx');
    const [useDateRange, setUseDateRange] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    if (!isAdmin) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                    Solo los administradores pueden exportar datos.
                </CardContent>
            </Card>
        );
    }

    const toggleTable = (tableId: ExportableTable) => {
        setSelectedTables((prev) =>
            prev.includes(tableId) ? prev.filter((t) => t !== tableId) : [...prev, tableId]
        );
    };

    const selectAll = () => {
        setSelectedTables(TABLE_OPTIONS.map((t) => t.id));
    };

    const deselectAll = () => {
        setSelectedTables([]);
    };

    const hasDateFilterableTables = selectedTables.some((t) =>
        TABLE_OPTIONS.find((opt) => opt.id === t)?.supportsDateFilter
    );

    const handleExport = async () => {
        if (selectedTables.length === 0) {
            setError('Selecciona al menos una tabla');
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccess(false);

        try {
            const {
                data: { session: currentSession },
            } = await supabase.auth.getSession();

            if (!currentSession?.access_token) {
                setError('Sesion expirada. Por favor, recarga la pagina.');
                return;
            }

            const body: {
                tables: ExportableTable[];
                format: ExportFormat;
                dateRange?: { start: string; end: string };
            } = {
                tables: selectedTables,
                format,
            };

            if (useDateRange && startDate && endDate) {
                body.dateRange = { start: startDate, end: endDate };
            }

            const response = await fetch('/api/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${currentSession.access_token}`,
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Error ${response.status}`);
            }

            // Download the file
            const contentDisposition = response.headers.get('content-disposition');
            let downloadFileName = `export-${new Date().toISOString().split('T')[0]}.${format}`;

            if (contentDisposition) {
                const match = contentDisposition.match(/filename="(.+?)"/);
                if (match) {
                    downloadFileName = match[1];
                }
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadFileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            console.error('Export error:', err);
            setError(err instanceof Error ? err.message : 'Error al exportar');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Exportar Datos
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    Selecciona las tablas y el formato para exportar tus datos
                </p>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Table Selection */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium">Tablas a exportar</label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={selectAll}
                                className="text-xs text-primary hover:underline"
                            >
                                Seleccionar todas
                            </button>
                            <span className="text-muted-foreground">|</span>
                            <button
                                type="button"
                                onClick={deselectAll}
                                className="text-xs text-primary hover:underline"
                            >
                                Ninguna
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {TABLE_OPTIONS.map((table) => (
                            <label
                                key={table.id}
                                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                    selectedTables.includes(table.id)
                                        ? 'bg-primary/5 border-primary'
                                        : 'hover:bg-muted/50'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedTables.includes(table.id)}
                                    onChange={() => toggleTable(table.id)}
                                    className="mt-1"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm">{table.label}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {table.description}
                                    </div>
                                </div>
                                {table.supportsDateFilter && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                        Filtrable
                                    </span>
                                )}
                            </label>
                        ))}
                    </div>
                </div>

                {/* Format Selection */}
                <div>
                    <label className="text-sm font-medium mb-3 block">Formato</label>
                    <div className="flex gap-4">
                        <label
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors flex-1 ${
                                format === 'xlsx' ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                            }`}
                        >
                            <input
                                type="radio"
                                name="format"
                                value="xlsx"
                                checked={format === 'xlsx'}
                                onChange={() => setFormat('xlsx')}
                            />
                            <FileSpreadsheet className="h-5 w-5 text-green-600" />
                            <div>
                                <div className="font-medium text-sm">Excel (.xlsx)</div>
                                <div className="text-xs text-muted-foreground">
                                    Hojas separadas por tabla
                                </div>
                            </div>
                        </label>
                        <label
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors flex-1 ${
                                format === 'csv' ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                            }`}
                        >
                            <input
                                type="radio"
                                name="format"
                                value="csv"
                                checked={format === 'csv'}
                                onChange={() => setFormat('csv')}
                            />
                            <FileText className="h-5 w-5 text-blue-600" />
                            <div>
                                <div className="font-medium text-sm">CSV (.csv)</div>
                                <div className="text-xs text-muted-foreground">
                                    Compatible con cualquier app
                                </div>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Date Range Filter */}
                {hasDateFilterableTables && (
                    <div>
                        <label className="flex items-center gap-2 mb-3">
                            <input
                                type="checkbox"
                                checked={useDateRange}
                                onChange={(e) => setUseDateRange(e.target.checked)}
                            />
                            <span className="text-sm font-medium">Filtrar por rango de fechas</span>
                        </label>
                        {useDateRange && (
                            <div className="flex gap-4 mt-2">
                                <div className="flex-1">
                                    <label className="text-xs text-muted-foreground block mb-1">
                                        Desde
                                    </label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-md text-sm"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs text-muted-foreground block mb-1">
                                        Hasta
                                    </label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-md text-sm"
                                    />
                                </div>
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                            El filtro aplica a: Ventas, Items de Venta, Contactos
                        </p>
                    </div>
                )}

                {/* Error/Success Messages */}
                {error && (
                    <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="bg-green-50 text-green-700 px-4 py-3 rounded-md text-sm flex items-center gap-2">
                        <Check className="h-4 w-4" />
                        Exportacion completada
                    </div>
                )}

                {/* Export Button */}
                <Button
                    onClick={handleExport}
                    isLoading={isLoading}
                    disabled={selectedTables.length === 0}
                    className="w-full"
                >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar {selectedTables.length > 0 && `(${selectedTables.length} tablas)`}
                </Button>
            </CardContent>
        </Card>
    );
}
