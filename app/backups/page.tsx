'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Download, ArrowLeft, Shield, Database, Info } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { ExportForm } from '@/components/export';

export default function BackupsPage() {
    const router = useRouter();
    const { isAdmin, isLoading } = useAuth();

    // Redirigir si no es admin
    useEffect(() => {
        if (!isLoading && !isAdmin) {
            router.push('/');
        }
    }, [isAdmin, isLoading, router]);

    if (isLoading) {
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
                <p className="text-muted-foreground">Solo administradores pueden acceder a esta seccion.</p>
                <Button onClick={() => router.push('/')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver al Dashboard
                </Button>
            </div>
        );
    }

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
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push('/')}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-3">
                                <Database className="h-8 w-8 text-primary" />
                                Backups y Exportacion
                            </h1>
                            <p className="text-muted-foreground mt-1">
                                Exporta los datos de tu negocio en CSV o Excel
                            </p>
                        </div>
                    </div>
                </div>

                {/* Info Box */}
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                        <div>
                            <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
                                Exportacion de Datos
                            </h3>
                            <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                                <li>Selecciona las tablas que deseas exportar.</li>
                                <li>El formato Excel (.xlsx) crea una hoja por cada tabla seleccionada.</li>
                                <li>Puedes filtrar ventas y contactos por rango de fechas.</li>
                                <li>Limite: 10,000 registros por tabla para evitar archivos muy grandes.</li>
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
    const { session } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const handleQuickExport = async () => {
        setIsLoading(true);
        try {
            const { data: { session: currentSession } } = await (await import('@/lib/supabase')).supabase.auth.getSession();

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
