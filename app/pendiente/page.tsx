'use client';

import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Clock, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function PendingApprovalPage() {
    const { user, approved, isLoading, signOut } = useAuth();
    const router = useRouter();

    // Si ya está aprobado, redirigir al dashboard
    useEffect(() => {
        if (!isLoading && approved) {
            router.push('/');
        }
    }, [approved, isLoading, router]);

    // Si no hay usuario, redirigir a login
    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login');
        }
    }, [user, isLoading, router]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-950">
                <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
            <div className="w-full max-w-md space-y-8 rounded-2xl bg-zinc-900 p-8 shadow-xl border border-zinc-800 text-center">
                <div className="flex flex-col items-center">
                    <div className="rounded-full bg-amber-500/10 p-4 mb-4">
                        <Clock className="h-12 w-12 text-amber-500" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                        Mirador Montañero
                        <span className="block text-xl text-emerald-400 font-normal mt-1">Café Selecto</span>
                    </h1>
                </div>

                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-white">
                        Tu cuenta está pendiente de aprobación
                    </h2>
                    <p className="text-zinc-400">
                        El administrador revisará tu solicitud pronto.
                        Recibirás acceso una vez que tu cuenta sea aprobada.
                    </p>
                    <p className="text-sm text-zinc-500">
                        Registrado como: <span className="text-zinc-300">{user?.email}</span>
                    </p>
                </div>

                <Button
                    variant="outline"
                    onClick={signOut}
                    className="w-full mt-6"
                >
                    <LogOut className="w-4 h-4 mr-2" />
                    Cerrar sesión
                </Button>
            </div>
        </div>
    );
}
