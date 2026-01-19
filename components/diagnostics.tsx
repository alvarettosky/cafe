'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function Diagnostics() {
    const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
    const [message, setMessage] = useState('');
    const [details, setDetails] = useState('');

    useEffect(() => {
        const check = async () => {
            try {
                // 1. Check basic connection
                const { error, count } = await supabase
                    .from('inventory')
                    .select('*', { count: 'exact', head: true });

                if (error) {
                    setStatus('error');
                    setMessage(`Supabase Error: ${error.message}`);
                    setDetails(JSON.stringify(error, null, 2));
                } else {
                    setStatus('ok');
                    setMessage(`Conexión OK. Inventario: ${count} ítems encontrados.`);
                }
            } catch (err: unknown) {
                setStatus('error');
                setMessage(`Client Exception: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
        };

        check();
    }, []);

    if (status === 'ok') return null; // Don't show if everything is fine

    return (
        <div className="fixed bottom-4 right-4 max-w-sm p-4 rounded-lg shadow-2xl bg-zinc-900 border border-red-500 text-white z-50">
            <h3 className="font-bold text-red-500 flex items-center gap-2">
                ⚠️ Diagnóstico del Sistema
            </h3>
            <p className="text-sm mt-1">{message}</p>
            {details && (
                <pre className="mt-2 p-2 bg-black rounded text-xs overflow-auto max-h-32">
                    {details}
                </pre>
            )}
        </div>
    );
}
