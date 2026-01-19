'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { X, Check, Trash2, Loader2, Users } from 'lucide-react';

interface PendingUser {
    id: string;
    email: string;
    created_at: string;
}

interface PendingUsersModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void;
}

export function PendingUsersModal({ isOpen, onClose, onUpdate }: PendingUsersModalProps) {
    const [users, setUsers] = useState<PendingUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchPendingUsers();
        }
    }, [isOpen]);

    async function fetchPendingUsers() {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_pending_users');
            if (error) throw error;
            setUsers(data || []);
        } catch (err) {
            console.error('Error fetching pending users:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleApprove(userId: string) {
        setActionLoading(userId);
        try {
            const { error } = await supabase.rpc('approve_user', { p_user_id: userId });
            if (error) throw error;
            await fetchPendingUsers();
            onUpdate();
        } catch (err) {
            console.error('Error approving user:', err);
            alert('Error al aprobar usuario');
        } finally {
            setActionLoading(null);
        }
    }

    async function handleReject(userId: string) {
        if (!confirm('¿Estás seguro de rechazar este usuario? Se eliminará permanentemente.')) {
            return;
        }

        setActionLoading(userId);
        try {
            const { error } = await supabase.rpc('reject_user', { p_user_id: userId });
            if (error) throw error;
            await fetchPendingUsers();
            onUpdate();
        } catch (err) {
            console.error('Error rejecting user:', err);
            alert('Error al rechazar usuario');
        } finally {
            setActionLoading(null);
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-zinc-900 rounded-xl border border-zinc-800 shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-amber-500" />
                        <h2 className="text-lg font-semibold text-white">Usuarios Pendientes</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-zinc-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-zinc-400">No hay usuarios pendientes</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {users.map((user) => (
                                <div
                                    key={user.id}
                                    className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">
                                            {user.email}
                                        </p>
                                        <p className="text-xs text-zinc-500">
                                            {new Date(user.created_at).toLocaleDateString('es-CO', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                    <div className="flex gap-2 ml-3">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 w-8 p-0 border-emerald-600 hover:bg-emerald-600"
                                            onClick={() => handleApprove(user.id)}
                                            disabled={actionLoading === user.id}
                                        >
                                            {actionLoading === user.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Check className="w-4 h-4 text-emerald-500" />
                                            )}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 w-8 p-0 border-red-600 hover:bg-red-600"
                                            onClick={() => handleReject(user.id)}
                                            disabled={actionLoading === user.id}
                                        >
                                            {actionLoading === user.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
