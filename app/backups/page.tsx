'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Download,
    ArrowLeft,
    Shield,
    Database,
    Info,
    Cloud,
    Clock,
    CheckCircle,
    AlertCircle,
    RefreshCw,
    ExternalLink,
    Play,
} from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { ExportForm } from '@/components/export';
import { supabase } from '@/lib/supabase';

interface BackupFile {
    id: string;
    name: string;
    createdTime: string;
    size: string;
    webViewLink: string;
}

export default function BackupsPage() {
    const router = useRouter();
    const { isAdmin, isLoading: authLoading, session } = useAuth();
    const [backups, setBackups] = useState<BackupFile[]>([]);
    const [backupsLoading, setBackupsLoading] = useState(true);
    const [configured, setConfigured] = useState(false);
    const [triggerLoading, setTriggerLoading] = useState(false);
    const [triggerMessage, setTriggerMessage] = useState<{
        type: 'success' | 'error';
        text: string;
    } | null>(null);

    // Redirect if not admin
    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/');
        }
    }, [isAdmin, authLoading, router]);

    // Load backup history
    useEffect(() => {
        if (isAdmin && session?.access_token) {
            loadBackups();
        }
    }, [isAdmin, session]);

    const loadBackups = async () => {
        setBackupsLoading(true);
        try {
            const {
                data: { session: currentSession },
            } = await supabase.auth.getSession();

            if (!currentSession?.access_token) return;

            const response = await fetch('/api/backups/list', {
                headers: {
                    Authorization: `Bearer ${currentSession.access_token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setBackups(data.backups || []);
                setConfigured(data.configured);
            }
        } catch (error) {
            console.error('Error loading backups:', error);
        } finally {
            setBackupsLoading(false);
        }
    };

    const triggerBackup = async () => {
        setTriggerLoading(true);
        setTriggerMessage(null);

        try {
            const {
                data: { session: currentSession },
            } = await supabase.auth.getSession();

            if (!currentSession?.access_token) {
                setTriggerMessage({ type: 'error', text: 'Sesion expirada' });
                return;
            }

            const response = await fetch('/api/backups/trigger', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${currentSession.access_token}`,
                },
            });

            const data = await response.json();

            if (response.ok) {
                setTriggerMessage({ type: 'success', text: data.message });
            } else {
                setTriggerMessage({
                    type: 'error',
                    text: data.error || 'Error al ejecutar backup',
                });
            }
        } catch (error) {
            setTriggerMessage({ type: 'error', text: 'Error de conexion' });
        } finally {
            setTriggerLoading(false);
        }
    };

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                <Shield className="h-16 w-16 text-muted-foreground" />
                <h1 className="text-2xl font-bold">Acceso Restringido</h1>
                <p className="text-muted-foreground">
                    Solo administradores pueden acceder a esta seccion.
                </p>
                <Button onClick={() => router.push('/')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver al Dashboard
                </Button>
            </div>
        );
    }

    const lastBackup = backups[0];
    const nextBackupTime = getNextBackupTime();

    return (
        <div className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-background via-background to-primary/5">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-3">
                                <Database className="h-8 w-8 text-primary" />
                                Backups y Exportacion
                            </h1>
                            <p className="text-muted-foreground mt-1">
                                Gestiona backups automaticos y exporta datos manualmente
                            </p>
                        </div>
                    </div>
                </div>

                {/* Backup Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {/* Last Backup Card */}
                    <div className="p-4 border rounded-lg bg-card">
                        <div className="flex items-center gap-3 mb-3">
                            <div
                                className={`p-2 rounded-full ${
                                    lastBackup
                                        ? 'bg-green-100 dark:bg-green-900/30'
                                        : 'bg-yellow-100 dark:bg-yellow-900/30'
                                }`}
                            >
                                {lastBackup ? (
                                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                                ) : (
                                    <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                                )}
                            </div>
                            <div>
                                <h3 className="font-medium">Ultimo Backup</h3>
                                {lastBackup ? (
                                    <p className="text-sm text-muted-foreground">
                                        {formatDate(lastBackup.createdTime)}
                                    </p>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Sin backups</p>
                                )}
                            </div>
                        </div>
                        {lastBackup && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{lastBackup.size}</span>
                                {lastBackup.webViewLink && (
                                    <a
                                        href={lastBackup.webViewLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline flex items-center gap-1"
                                    >
                                        Ver en Drive <ExternalLink className="h-3 w-3" />
                                    </a>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Next Backup Card */}
                    <div className="p-4 border rounded-lg bg-card">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h3 className="font-medium">Proximo Backup</h3>
                                <p className="text-sm text-muted-foreground">{nextBackupTime}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={triggerBackup}
                                disabled={triggerLoading || !configured}
                            >
                                {triggerLoading ? (
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Play className="h-4 w-4 mr-2" />
                                )}
                                Ejecutar Ahora
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={loadBackups}
                                disabled={backupsLoading}
                            >
                                <RefreshCw
                                    className={`h-4 w-4 ${backupsLoading ? 'animate-spin' : ''}`}
                                />
                            </Button>
                        </div>
                        {triggerMessage && (
                            <p
                                className={`text-sm mt-2 ${
                                    triggerMessage.type === 'success'
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                }`}
                            >
                                {triggerMessage.text}
                            </p>
                        )}
                    </div>
                </div>

                {/* Backup History */}
                {configured && (
                    <div className="mb-8">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Cloud className="h-5 w-5" />
                            Historial de Backups en Google Drive
                        </h2>
                        {backupsLoading ? (
                            <div className="p-8 border rounded-lg flex items-center justify-center">
                                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : backups.length === 0 ? (
                            <div className="p-8 border rounded-lg text-center text-muted-foreground">
                                No hay backups almacenados en Google Drive
                            </div>
                        ) : (
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="text-left p-3 text-sm font-medium">
                                                Nombre
                                            </th>
                                            <th className="text-left p-3 text-sm font-medium">
                                                Fecha
                                            </th>
                                            <th className="text-left p-3 text-sm font-medium">
                                                Tamano
                                            </th>
                                            <th className="text-right p-3 text-sm font-medium">
                                                Acciones
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {backups.map((backup) => (
                                            <tr key={backup.id} className="hover:bg-muted/30">
                                                <td className="p-3 text-sm">{backup.name}</td>
                                                <td className="p-3 text-sm text-muted-foreground">
                                                    {formatDate(backup.createdTime)}
                                                </td>
                                                <td className="p-3 text-sm text-muted-foreground">
                                                    {backup.size}
                                                </td>
                                                <td className="p-3 text-right">
                                                    {backup.webViewLink && (
                                                        <a
                                                            href={backup.webViewLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                                                        >
                                                            <ExternalLink className="h-4 w-4" />
                                                            Abrir
                                                        </a>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Configuration Notice */}
                {!configured && !backupsLoading && (
                    <div className="mb-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                            <div>
                                <h3 className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">
                                    Backups Automaticos No Configurados
                                </h3>
                                <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-2">
                                    Para habilitar backups automaticos a Google Drive, configura:
                                </p>
                                <ul className="text-sm text-yellow-700 dark:text-yellow-400 list-disc list-inside space-y-1">
                                    <li>GOOGLE_DRIVE_CREDENTIALS (Service account JSON)</li>
                                    <li>GOOGLE_DRIVE_FOLDER_ID (ID de carpeta destino)</li>
                                    <li>RESEND_API_KEY (Opcional, para notificaciones)</li>
                                    <li>NOTIFICATION_EMAIL (Opcional, email destino)</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* Info Box */}
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                        <div>
                            <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
                                Exportacion Manual de Datos
                            </h3>
                            <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                                <li>Selecciona las tablas que deseas exportar.</li>
                                <li>
                                    El formato Excel (.xlsx) crea una hoja por cada tabla seleccionada.
                                </li>
                                <li>Puedes filtrar ventas y contactos por rango de fechas.</li>
                                <li>
                                    Limite: 10,000 registros por tabla para evitar archivos muy grandes.
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Export Form */}
                <ExportForm />

                {/* Quick Export Buttons */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <QuickExportCard
                        title="Inventario Completo"
                        description="Stock actual de todos los productos"
                        tables={['inventory']}
                    />
                    <QuickExportCard
                        title="Clientes"
                        description="Datos de clientes con recurrencia"
                        tables={['customers', 'customer_contacts']}
                    />
                    <QuickExportCard
                        title="Reporte de Ventas"
                        description="Ventas con detalle de items"
                        tables={['sales', 'sale_items']}
                    />
                </div>
            </motion.div>
        </div>
    );
}

interface QuickExportCardProps {
    title: string;
    description: string;
    tables: string[];
}

function QuickExportCard({ title, description, tables }: QuickExportCardProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleQuickExport = async () => {
        setIsLoading(true);
        try {
            const {
                data: { session: currentSession },
            } = await supabase.auth.getSession();

            if (!currentSession?.access_token) {
                return;
            }

            const response = await fetch('/api/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${currentSession.access_token}`,
                },
                body: JSON.stringify({
                    tables,
                    format: 'xlsx',
                }),
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }
        } catch (error) {
            console.error('Quick export error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 border rounded-lg hover:border-primary/50 transition-colors">
            <h3 className="font-medium mb-1">{title}</h3>
            <p className="text-sm text-muted-foreground mb-3">{description}</p>
            <Button
                variant="outline"
                size="sm"
                onClick={handleQuickExport}
                disabled={isLoading}
                className="w-full"
            >
                {isLoading ? (
                    <span className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                ) : (
                    <Download className="h-4 w-4 mr-2" />
                )}
                Exportar
            </Button>
        </div>
    );
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getNextBackupTime(): string {
    const now = new Date();
    const next = new Date(now);

    // Next run is at 2:00 AM UTC
    next.setUTCHours(2, 0, 0, 0);

    // If it's already past 2 AM UTC today, move to tomorrow
    if (now >= next) {
        next.setDate(next.getDate() + 1);
    }

    return next.toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
    });
}
