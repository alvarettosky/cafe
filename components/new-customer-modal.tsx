"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { UserPlus, Loader2 } from "lucide-react";

export function NewCustomerModal({ onCustomerAdded }: { onCustomerAdded?: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [address, setAddress] = useState("");

    const handleCreate = async () => {
        if (!fullName) {
            setError("El nombre es obligatorio");
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const { error: insertError } = await supabase
                .from('customers')
                .insert([{
                    full_name: fullName,
                    phone: phone || null,
                    email: email || null,
                    address: address || null
                }]);

            if (insertError) throw insertError;

            setSuccess("Cliente registrado exitosamente");
            setFullName("");
            setPhone("");
            setEmail("");
            setAddress("");

            if (onCustomerAdded) onCustomerAdded();

            // Close after delay
            setTimeout(() => {
                setIsOpen(false);
                setSuccess(null);
            }, 1000);

        } catch (err: any) {
            setError(err.message || "Error al crear cliente");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="icon" title="Nuevo Cliente">
                    <UserPlus className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-card glass border-white/10">
                <DialogHeader>
                    <DialogTitle>Registrar Nuevo Cliente</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium">Nombre Completo *</label>
                        <input
                            placeholder="Ej. Juan Pérez"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-black dark:text-white"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium">Teléfono</label>
                        <input
                            placeholder="Ej. 300 123 4567"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-black dark:text-white"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium">Email (Opcional)</label>
                        <input
                            type="email"
                            placeholder="juan@ejemplo.com"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-black dark:text-white"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium">Dirección (Opcional)</label>
                        <input
                            placeholder="Ej. Calle 123 #45-67"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-black dark:text-white"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                        />
                    </div>

                    {error && (
                        <div className="p-3 text-sm text-red-500 bg-red-500/10 rounded-md">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-3 text-sm text-green-500 bg-green-500/10 rounded-md">
                            {success}
                        </div>
                    )}
                </div>
                <div className="flex justify-end">
                    <Button onClick={handleCreate} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Guardar Cliente
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
