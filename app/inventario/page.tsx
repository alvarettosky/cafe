'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Package, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { InventoryList } from '@/components/inventory-list';
import { Loader2 } from 'lucide-react';

export default function InventarioPage() {
    const router = useRouter();
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-950">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) return null; // AuthProvider handles redirect

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
                                <Package className="h-8 w-8 text-primary" />
                                Inventario
                            </h1>
                            <p className="text-muted-foreground mt-1">
                                Gestión de productos y stock
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="grid gap-4">
                    <InventoryList />
                </div>
            </motion.div>
        </div>
    );
}
