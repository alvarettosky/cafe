'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase';
import type { ExportableTable, ExportFormat } from '@/lib/export';

interface DownloadButtonProps {
    /** Table(s) to export */
    tables: ExportableTable | ExportableTable[];
    /** Export format */
    format?: ExportFormat;
    /** Custom filename (without extension) */
    fileName?: string;
    /** Button label */
    label?: string;
    /** Date range filter */
    dateRange?: {
        start: string;
        end: string;
    };
    /** Button variant */
    variant?: 'default' | 'outline' | 'ghost';
    /** Button size */
    size?: 'default' | 'sm' | 'lg' | 'icon';
    /** Additional class names */
    className?: string;
    /** Show icon only (for compact layouts) */
    iconOnly?: boolean;
}

export function DownloadButton({
    tables,
    format = 'xlsx',
    fileName,
    label,
    dateRange,
    variant = 'outline',
    size = 'sm',
    className,
    iconOnly = false,
}: DownloadButtonProps) {
    const { isAdmin, session } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Only admins can export
    if (!isAdmin) {
        return null;
    }

    const tableList = Array.isArray(tables) ? tables : [tables];
    const Icon = format === 'csv' ? FileText : FileSpreadsheet;
    const defaultLabel = format === 'csv' ? 'Exportar CSV' : 'Exportar Excel';

    const handleExport = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Get fresh session token
            const {
                data: { session: currentSession },
            } = await supabase.auth.getSession();

            if (!currentSession?.access_token) {
                setError('Sesion expirada. Por favor, recarga la pagina.');
                return;
            }

            const response = await fetch('/api/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${currentSession.access_token}`,
                },
                body: JSON.stringify({
                    tables: tableList,
                    format,
                    dateRange,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Error ${response.status}`);
            }

            // Get filename from content-disposition or generate one
            const contentDisposition = response.headers.get('content-disposition');
            let downloadFileName = fileName
                ? `${fileName}.${format}`
                : `export-${new Date().toISOString().split('T')[0]}.${format}`;

            if (contentDisposition) {
                const match = contentDisposition.match(/filename="(.+?)"/);
                if (match) {
                    downloadFileName = match[1];
                }
            }

            // Download the file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadFileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error('Export error:', err);
            setError(err instanceof Error ? err.message : 'Error al exportar');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="inline-flex flex-col items-start gap-1">
            <Button
                variant={variant}
                size={size}
                onClick={handleExport}
                isLoading={isLoading}
                className={className}
                title={iconOnly ? label || defaultLabel : undefined}
            >
                {!isLoading && <Icon className={iconOnly ? 'h-4 w-4' : 'h-4 w-4 mr-2'} />}
                {!iconOnly && (label || defaultLabel)}
            </Button>
            {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
    );
}
