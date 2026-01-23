'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Package, Coffee, AlertTriangle, Loader2 } from 'lucide-react';
import {
    VariantForSale,
    grindTypeShortLabels,
    presentationLabels,
    getStockLevelColor,
    stockInUnits
} from '@/types/products';

interface ProductVariantSelectorProps {
    value?: string; // variant_id seleccionado
    onChange: (variant: VariantForSale | null) => void;
    disabled?: boolean;
    showStock?: boolean;
    className?: string;
}

export function ProductVariantSelector({
    value,
    onChange,
    disabled = false,
    showStock = true,
    className = ''
}: ProductVariantSelectorProps) {
    const [variants, setVariants] = useState<VariantForSale[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Agrupar variantes por producto
    const [groupedVariants, setGroupedVariants] = useState<Map<string, VariantForSale[]>>(new Map());

    const fetchVariants = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase.rpc('get_variants_for_sale');

            if (fetchError) {
                // Si la función no existe (aún no se migró), usar inventory directamente
                if (fetchError.message.includes('does not exist')) {
                    console.log('Usando inventory legacy...');
                    const { data: invData, error: invError } = await supabase
                        .from('inventory')
                        .select('product_id, product_name, total_grams_available');

                    if (invError) throw invError;

                    // Convertir inventory a formato de variantes
                    const legacyVariants: VariantForSale[] = (invData || []).map(inv => ({
                        variant_id: inv.product_id,
                        product_id: inv.product_id,
                        product_name: inv.product_name,
                        variant_display_name: inv.product_name,
                        presentation: 'libra' as const,
                        grind_type: 'grano' as const,
                        weight_grams: 500,
                        base_price: 10.00,
                        stock_grams: inv.total_grams_available,
                        has_stock: inv.total_grams_available >= 500
                    }));

                    setVariants(legacyVariants);
                    return;
                }
                throw fetchError;
            }

            setVariants(data || []);
        } catch (err) {
            console.error('Error fetching variants:', err);
            setError('Error cargando productos');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchVariants();
    }, [fetchVariants]);

    // Agrupar variantes por producto
    useEffect(() => {
        const grouped = new Map<string, VariantForSale[]>();

        variants.forEach(variant => {
            const existing = grouped.get(variant.product_id) || [];
            grouped.set(variant.product_id, [...existing, variant]);
        });

        setGroupedVariants(grouped);
    }, [variants]);

    const handleChange = (variantId: string) => {
        if (!variantId) {
            onChange(null);
            return;
        }

        const selected = variants.find(v => v.variant_id === variantId);
        onChange(selected || null);
    };

    const selectedVariant = variants.find(v => v.variant_id === value);

    if (loading) {
        return (
            <div className={`flex items-center gap-2 p-2 text-muted-foreground ${className}`}>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Cargando productos...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`flex items-center gap-2 p-2 text-red-500 ${className}`}>
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
            </div>
        );
    }

    return (
        <div className={`space-y-2 ${className}`}>
            <select
                value={value || ''}
                onChange={(e) => handleChange(e.target.value)}
                disabled={disabled}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
            >
                <option value="">Seleccionar Producto...</option>

                {/* Agrupar por producto */}
                {Array.from(groupedVariants.entries()).map(([productId, productVariants]) => {
                    // Nombre del producto (del primer variant)
                    const productName = productVariants[0]?.product_name || 'Producto';

                    return (
                        <optgroup key={productId} label={productName}>
                            {productVariants.map(variant => {
                                const presLabel = presentationLabels[variant.presentation] || variant.presentation;
                                const grindLabel = grindTypeShortLabels[variant.grind_type as keyof typeof grindTypeShortLabels] || variant.grind_type;
                                const unitsAvailable = stockInUnits(variant.stock_grams, variant.weight_grams);
                                const stockText = showStock
                                    ? ` [${unitsAvailable} disponibles]`
                                    : '';

                                return (
                                    <option
                                        key={variant.variant_id}
                                        value={variant.variant_id}
                                        disabled={!variant.has_stock && showStock}
                                    >
                                        {presLabel} ({grindLabel}) - ${variant.base_price.toFixed(2)}{stockText}
                                    </option>
                                );
                            })}
                        </optgroup>
                    );
                })}
            </select>

            {/* Info del producto seleccionado */}
            {selectedVariant && (
                <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md text-sm">
                    <div className="flex items-center gap-2">
                        <Coffee className="w-4 h-4 text-primary" />
                        <span className="font-medium">{selectedVariant.product_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {selectedVariant.sku && (
                            <span className="text-xs text-muted-foreground">
                                SKU: {selectedVariant.sku}
                            </span>
                        )}
                        {showStock && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStockLevelColor(selectedVariant.stock_grams, selectedVariant.weight_grams * 5)}`}>
                                <Package className="w-3 h-3 inline mr-1" />
                                {stockInUnits(selectedVariant.stock_grams, selectedVariant.weight_grams)} unidades
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Versión compacta del selector para uso en formularios simples
 */
export function ProductVariantSelectCompact({
    value,
    onChange,
    disabled = false,
    className = ''
}: Omit<ProductVariantSelectorProps, 'showStock'>) {
    const [variants, setVariants] = useState<VariantForSale[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchVariants = async () => {
            try {
                const { data, error } = await supabase.rpc('get_variants_for_sale');
                if (error) {
                    // Fallback a inventory
                    const { data: invData } = await supabase
                        .from('inventory')
                        .select('product_id, product_name');

                    setVariants((invData || []).map(inv => ({
                        variant_id: inv.product_id,
                        product_id: inv.product_id,
                        product_name: inv.product_name,
                        variant_display_name: inv.product_name,
                        presentation: 'libra' as const,
                        grind_type: 'grano' as const,
                        weight_grams: 500,
                        base_price: 10.00,
                        stock_grams: 0,
                        has_stock: true
                    })));
                } else {
                    setVariants(data || []);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchVariants();
    }, []);

    return (
        <select
            value={value || ''}
            onChange={(e) => {
                const selected = variants.find(v => v.variant_id === e.target.value);
                onChange(selected || null);
            }}
            disabled={disabled || loading}
            className={`flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ${className}`}
        >
            <option value="">
                {loading ? 'Cargando...' : 'Seleccionar...'}
            </option>
            {variants.map(v => (
                <option key={v.variant_id} value={v.variant_id}>
                    {v.variant_display_name}
                </option>
            ))}
        </select>
    );
}
