'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

interface DownloadButtonProps {
  tableName: string | string[];
  dateRange?: {
    start: string;
    end: string;
  };
  format?: 'csv' | 'xlsx';
  label?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function DownloadButton({
  tableName,
  dateRange,
  format = 'xlsx',
  label,
  variant = 'outline',
  size = 'md',
  className = '',
}: DownloadButtonProps) {
  const { role, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Only show to admins
  if (authLoading || role !== 'admin') {
    return null;
  }

  const handleDownload = async () => {
    setIsLoading(true);

    try {
      const tables = Array.isArray(tableName) ? tableName : [tableName];

      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tables,
          format,
          dateRange,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Exportación falló');
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `export-${Date.now()}.${format}`;

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error de descarga:', error);
      alert(error instanceof Error ? error.message : 'Error al descargar exportación');
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  };

  const variantClasses = {
    default: 'bg-blue-600 text-white hover:bg-blue-700',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800',
    ghost: 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800',
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isLoading}
      className={`
        inline-flex items-center gap-2 rounded-md font-medium
        transition-colors disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      <span>{isLoading ? 'Exportando...' : label || 'Exportar'}</span>
    </button>
  );
}
