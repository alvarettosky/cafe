'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import type { InventoryProductSummary as Product } from '@/types/inventory';
interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  productToEdit: Product | null;
}

export function ProductModal({ isOpen, onClose, onSuccess, productToEdit }: ProductModalProps) {
  const [name, setName] = useState('');
  const [grams, setGrams] = useState('');
  const [pricePerLb, setPricePerLb] = useState('');
  const [pricePerHalfLb, setPricePerHalfLb] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.product_name);
      setGrams(productToEdit.total_grams_available.toString());
      setPricePerLb(productToEdit.price_per_lb?.toString() ?? '');
      setPricePerHalfLb(productToEdit.price_per_half_lb?.toString() ?? '');
    } else {
      setName('');
      setGrams('');
      setPricePerLb('');
      setPricePerHalfLb('');
    }
  }, [productToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Los precios van vacíos como null, no como 0: un producto sin precio
      // declarado no es un producto que valga cero. `get_product_price_for_customer`
      // distingue los dos casos.
      const payload = {
        product_name: name,
        total_grams_available: parseInt(grams) || 0,
        price_per_lb: pricePerLb === '' ? null : Number(pricePerLb),
        price_per_half_lb: pricePerHalfLb === '' ? null : Number(pricePerHalfLb),
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
        const res = await supabase.from('inventory').insert([payload]);
        error = res.error;
      }

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
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
              onChange={e => setName(e.target.value)}
              placeholder="Ej. Café Tostado"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Stock Inicial (gramos)</Label>
            <Input
              type="number"
              value={grams}
              onChange={e => setGrams(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Precio libra (500 g)</Label>
              <Input
                type="number"
                min="0"
                step="500"
                value={pricePerLb}
                onChange={e => setPricePerLb(e.target.value)}
                placeholder="45000"
              />
            </div>
            <div className="space-y-2">
              <Label>Precio media libra (250 g)</Label>
              <Input
                type="number"
                min="0"
                step="500"
                value={pricePerHalfLb}
                onChange={e => setPricePerHalfLb(e.target.value)}
                placeholder="25000"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            La media libra no tiene por qué ser la mitad: es un precio propio. Estos precios son los
            que el sistema sugiere al vender.
          </p>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
