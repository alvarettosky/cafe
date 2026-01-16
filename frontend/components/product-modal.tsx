'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Product {
    product_id: string;
    product_name: string;
    total_grams_available: number;
}

interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    productToEdit: Product | null;
}

export function ProductModal({ isOpen, onClose, onSuccess, productToEdit }: ProductModalProps) {
    const [name, setName] = useState('');
    const [grams, setGrams] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (productToEdit) {
            setName(productToEdit.product_name);
            setGrams(productToEdit.total_grams_available.toString());
        } else {
            setName('');
            setGrams('');
        }
    }, [productToEdit, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                product_name: name,
                total_grams_available: parseInt(grams) || 0,
            };

            let error;

            if (productToEdit) {
                // Update
                const res = await supabase
                    .from('inventory')
                    .update(payload)
                    .eq('product_id', productToEdit.product_id);
                error = res.error;
            } else {
                // Create
                const res = await supabase
                    .from('inventory')
                    .insert([payload]);
                error = res.error;
            }

            if (error) throw error;

            onSuccess();
            onClose();
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{productToEdit ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Nombre del Producto</Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ej. Café Tostado"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Stock Inicial (gramos)</Label>
                        <Input
                            type="number"
                            value={grams}
                            onChange={(e) => setGrams(e.target.value)}
                            placeholder="0"
                        />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? 'Guardando...' : 'Guardar'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
