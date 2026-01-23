'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { DollarSign, ArrowLeft, Shield } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { PriceListManager } from '@/components/price-list-manager';

export default function PreciosPage() {
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
                <p className="text-muted-foreground">Solo administradores pueden acceder a esta sección.</p>
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
                className="max-w-7xl mx-auto"
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
                                <DollarSign className="h-8 w-8 text-primary" />
                                Listas de Precios
                            </h1>
                            <p className="text-muted-foreground mt-1">
                                Gestiona precios diferenciados por tipo de cliente
                            </p>
                        </div>
                    </div>
                </div>

                {/* Información sobre el sistema de precios */}
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
                        Sistema de Precios Diferenciados
                    </h3>
                    <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                        <li>Los precios se aplican automáticamente según el tipo de cliente al crear una venta.</li>
                        <li>Tipos de cliente: Retail, Mayorista Pequeño, Mayorista Grande, Cafetería, Personalizado.</li>
                        <li>Puedes crear listas de precios con descuentos globales o precios específicos por producto.</li>
                    </ul>
                </div>

                {/* Componente de gestión de listas de precios */}
                <PriceListManager />
            </motion.div>
        </div>
    );
}
