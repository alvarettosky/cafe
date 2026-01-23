'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    ArrowDownCircle,
    ArrowUpCircle,
    History,
    Plus,
    Minus,
    Package,
    AlertTriangle,
    RefreshCw,
    Loader2
} from 'lucide-react';
import {
    InventoryMovement,
    MovementType,
    movementTypeLabels,
    movementTypeColors,
    formatGrams,
    isEntryMovement
} from '@/types/inventory';

interface InventoryMovementsProps {
    isOpen: boolean;
    onClose: () => void;
    product: {
        product_id: string;
        product_name: string;
        total_grams_available: number;
    } | null;
    onMovementAdded?: () => void;
}

export function InventoryMovements({
    isOpen,
    onClose,
    product,
    onMovementAdded
}: InventoryMovementsProps) {
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [loading, setLoading] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [addingMovement, setAddingMovement] = useState(false);

    // Form state for new movement
    const [movementType, setMovementType] = useState<'restock' | 'loss' | 'adjustment'>('restock');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [unitCost, setUnitCost] = useState('');
    const [batchNumber, setBatchNumber] = useState('');

    const fetchMovements = useCallback(async () => {
        if (!product) return;

        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_inventory_movements', {
                p_product_id: product.product_id,
                p_limit: 50,
                p_offset: 0
            });

            if (error) throw error;
            setMovements(data || []);
        } catch (err) {
            console.error('Error fetching movements:', err);
        } finally {
            setLoading(false);
        }
    }, [product]);

    useEffect(() => {
        if (isOpen && product) {
            fetchMovements();
        }
    }, [isOpen, product, fetchMovements]);

    const handleAddMovement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!product) return;

        setAddingMovement(true);
        try {
            const quantityGrams = parseInt(quantity) || 0;

            if (quantityGrams <= 0) {
                alert('La cantidad debe ser mayor a 0');
                return;
            }

            if (movementType === 'restock') {
                const { error } = await supabase.rpc('restock_inventory', {
                    p_product_id: product.product_id,
                    p_quantity_grams: quantityGrams,
                    p_unit_cost: unitCost ? parseFloat(unitCost) : null,
                    p_batch_number: batchNumber || null,
                    p_reason: reason || 'Reposición de inventario'
                });
                if (error) throw error;
            } else if (movementType === 'loss') {
                if (!reason) {
                    alert('Se requiere una razón para registrar merma');
                    return;
                }
                const { error } = await supabase.rpc('register_inventory_loss', {
                    p_product_id: product.product_id,
                    p_quantity_grams: quantityGrams,
                    p_reason: reason
                });
                if (error) throw error;
            } else if (movementType === 'adjustment') {
                const { error } = await supabase.rpc('register_inventory_movement', {
                    p_product_id: product.product_id,
                    p_movement_type: 'adjustment',
                    p_quantity_grams: quantityGrams,
                    p_reason: reason || 'Ajuste de inventario'
                });
                if (error) throw error;
            }

            // Reset form and refresh
            setQuantity('');
            setReason('');
            setUnitCost('');
            setBatchNumber('');
            setShowAddForm(false);
            fetchMovements();
            onMovementAdded?.();
        } catch (err) {
            alert('Error: ' + (err instanceof Error ? err.message : 'Error desconocido'));
        } finally {
            setAddingMovement(false);
        }
    };

    const getMovementIcon = (type: MovementType) => {
        if (isEntryMovement(type)) {
            return <ArrowUpCircle className="w-4 h-4 text-green-600" />;
        }
        return <ArrowDownCircle className="w-4 h-4 text-red-600" />;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-CO', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (!product) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <History className="w-5 h-5" />
                        Historial de Movimientos - {product.product_name}
                    </DialogTitle>
                </DialogHeader>

                {/* Stock actual */}
                <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-gray-600" />
                        <span className="text-sm text-gray-600">Stock Actual:</span>
                        <span className="font-semibold">
                            {formatGrams(product.total_grams_available)}
                        </span>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddForm(!showAddForm)}
                    >
                        {showAddForm ? 'Cancelar' : (
                            <>
                                <Plus className="w-4 h-4 mr-1" />
                                Nuevo Movimiento
                            </>
                        )}
                    </Button>
                </div>

                {/* Formulario para nuevo movimiento */}
                {showAddForm && (
                    <form onSubmit={handleAddMovement} className="bg-blue-50 rounded-lg p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-sm">Tipo de Movimiento</Label>
                                <select
                                    value={movementType}
                                    onChange={(e) => setMovementType(e.target.value as 'restock' | 'loss' | 'adjustment')}
                                    className="w-full px-3 py-2 border rounded-md text-sm"
                                >
                                    <option value="restock">Reposición (+)</option>
                                    <option value="loss">Merma (-)</option>
                                    <option value="adjustment">Ajuste (+/-)</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-sm">
                                    Cantidad (gramos)
                                    {movementType === 'adjustment' && (
                                        <span className="text-xs text-gray-500 ml-1">
                                            (negativo para restar)
                                        </span>
                                    )}
                                </Label>
                                <Input
                                    type="number"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    placeholder="Ej: 500"
                                    required
                                />
                            </div>
                        </div>

                        {movementType === 'restock' && (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-sm">Costo por gramo (opcional)</Label>
                                    <Input
                                        type="number"
                                        step="0.0001"
                                        value={unitCost}
                                        onChange={(e) => setUnitCost(e.target.value)}
                                        placeholder="Ej: 0.02"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-sm">Número de lote (opcional)</Label>
                                    <Input
                                        value={batchNumber}
                                        onChange={(e) => setBatchNumber(e.target.value)}
                                        placeholder="Ej: LOTE-2026-001"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1">
                            <Label className="text-sm">
                                Razón / Notas
                                {movementType === 'loss' && (
                                    <span className="text-red-500 ml-1">*</span>
                                )}
                            </Label>
                            <Input
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder={
                                    movementType === 'loss'
                                        ? 'Ej: Café vencido, derrame, etc.'
                                        : 'Ej: Compra a proveedor X'
                                }
                                required={movementType === 'loss'}
                            />
                        </div>

                        <Button type="submit" className="w-full" disabled={addingMovement}>
                            {addingMovement ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                <>
                                    {movementType === 'restock' ? (
                                        <Plus className="w-4 h-4 mr-2" />
                                    ) : movementType === 'loss' ? (
                                        <Minus className="w-4 h-4 mr-2" />
                                    ) : (
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                    )}
                                    Registrar Movimiento
                                </>
                            )}
                        </Button>
                    </form>
                )}

                {/* Lista de movimientos */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                    ) : movements.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <History className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                            <p>No hay movimientos registrados</p>
                            <p className="text-sm">Los movimientos se registrarán automáticamente con cada venta</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {movements.map((movement) => (
                                <div
                                    key={movement.id}
                                    className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3">
                                            {getMovementIcon(movement.movement_type)}
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${movementTypeColors[movement.movement_type]}`}>
                                                        {movementTypeLabels[movement.movement_type]}
                                                    </span>
                                                    <span className={`font-semibold ${movement.quantity_grams >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {movement.quantity_grams >= 0 ? '+' : ''}{formatGrams(movement.quantity_grams)}
                                                    </span>
                                                </div>
                                                {movement.reason && (
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        {movement.reason}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                                                    <span>
                                                        {formatGrams(movement.stock_before)} → {formatGrams(movement.stock_after)}
                                                    </span>
                                                    {movement.batch_number && (
                                                        <span>Lote: {movement.batch_number}</span>
                                                    )}
                                                    {movement.performer_email && (
                                                        <span>Por: {movement.performer_email.split('@')[0]}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-400 text-right whitespace-nowrap">
                                            {formatDate(movement.created_at)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Leyenda */}
                <div className="border-t pt-3 mt-3">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Los movimientos de venta se registran automáticamente al procesar cada venta.</span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
