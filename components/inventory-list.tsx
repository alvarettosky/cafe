'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Plus, Package } from 'lucide-react';
import { ProductModal } from './product-modal';

interface Product {
    product_id: string;
    product_name: string;
    total_grams_available: number;
}

export function InventoryList() {
    const { isAdmin } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    const fetchInventory = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('inventory')
            .select('*')
            .order('product_name');

        if (data) setProducts(data);
        setLoading(false);
    };

    useEffect(() => {
        // Initial data fetch on mount - fetchInventory is reused by handleDelete
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchInventory();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este producto?')) return;

        const { error } = await supabase.from('inventory').delete().eq('product_id', id);
        if (!error) fetchInventory();
        else alert('Error al eliminar: ' + error.message);
    };

    return (
        <Card className="col-span-4 lg:col-span-5 hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Inventario en Tiempo Real
                </CardTitle>
                {isAdmin && (
                    <Button size="sm" onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> Nuevo Producto
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="text-center py-4">Cargando inventario...</div>
                ) : (
                    <div className="space-y-2">
                        {products.map((product) => (
                            <div key={product.product_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                                <div>
                                    <p className="font-medium">{product.product_name}</p>
                                    <p className="text-xs text-muted-foreground">Stock: {product.total_grams_available} g</p>
                                </div>
                                {isAdmin && (
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => { setEditingProduct(product); setIsModalOpen(true); }}>
                                            <Pencil className="h-4 w-4 text-amber-500" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(product.product_id)}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {products.length === 0 && (
                            <p className="text-center text-muted-foreground py-4">No hay productos registrados.</p>
                        )}
                    </div>
                )}
            </CardContent>

            <ProductModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchInventory}
                productToEdit={editingProduct}
            />
        </Card>
    );
}
