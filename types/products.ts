/**
 * Tipos para el sistema de Productos con Variantes
 * Migraciones: 024_product_variants.sql, 025_migrate_inventory_to_variants.sql
 */

/**
 * Tipos de presentación disponibles
 */
export type Presentation = 'libra' | 'media_libra' | '250g' | '500g' | '1kg' | string;

/**
 * Tipos de molienda disponibles
 */
export type GrindType = 'grano' | 'molido_fino' | 'molido_medio' | 'molido_grueso';

/**
 * Etiquetas legibles para tipos de molienda
 */
export const grindTypeLabels: Record<GrindType, string> = {
    grano: 'Grano Entero',
    molido_fino: 'Molido Fino',
    molido_medio: 'Molido Medio',
    molido_grueso: 'Molido Grueso',
};

/**
 * Etiquetas cortas para tipos de molienda (badges)
 */
export const grindTypeShortLabels: Record<GrindType, string> = {
    grano: 'Grano',
    molido_fino: 'Fino',
    molido_medio: 'Medio',
    molido_grueso: 'Grueso',
};

/**
 * Etiquetas para presentaciones
 */
export const presentationLabels: Record<string, string> = {
    libra: 'Libra (500g)',
    media_libra: 'Media Libra (250g)',
    '250g': '250 gramos',
    '500g': '500 gramos',
    '1kg': '1 Kilogramo',
};

/**
 * Producto padre - información general del café
 */
export interface Product {
    id: string;
    name: string;
    description?: string;

    // Información del café
    origin?: string;
    variety?: string;
    process?: string;
    altitude?: string;
    tasting_notes?: string;
    roast_level?: string;

    // Categorización
    category: string;
    tags?: string[];

    // Estado
    is_active: boolean;
    sort_order: number;

    // Multimedia
    image_url?: string;

    // Auditoría
    created_at: string;
    updated_at: string;
    created_by?: string;

    // Variantes (cuando se incluyen)
    variants?: ProductVariant[];
}

/**
 * Variante de producto (SKU) - entidad vendible
 */
export interface ProductVariant {
    id: string;
    product_id: string;

    // Identificación
    sku?: string;
    barcode?: string;

    // Características
    presentation: Presentation;
    grind_type: GrindType;
    weight_grams: number;

    // Precios
    base_price: number;
    cost?: number;
    compare_at_price?: number;

    // Inventario
    stock_grams: number;
    min_stock: number;
    track_inventory: boolean;
    allow_backorder: boolean;

    // Estado
    is_active: boolean;
    is_default: boolean;
    sort_order: number;

    // Auditoría
    created_at: string;
    updated_at: string;
}

/**
 * Producto con variantes (para catálogo)
 */
export interface ProductWithVariants extends Product {
    variants: ProductVariant[];
}

/**
 * Variante para selector de venta (incluye nombre del producto)
 */
export interface VariantForSale {
    variant_id: string;
    product_id: string;
    product_name: string;
    variant_display_name: string;
    sku?: string;
    presentation: Presentation;
    grind_type: GrindType;
    weight_grams: number;
    base_price: number;
    stock_grams: number;
    has_stock: boolean;
}

/**
 * Resumen de producto para catálogo
 */
export interface ProductCatalogItem {
    product_id: string;
    product_name: string;
    origin?: string;
    tasting_notes?: string;
    default_variant_id?: string;
    default_price?: number;
    min_price?: number;
    max_price?: number;
    total_stock: number;
    variant_count: number;
}

/**
 * Resultado de migración de inventario
 */
export interface MigrationResult {
    status: 'migrated' | 'already_migrated' | 'error';
    inventory_id?: string;
    product_id?: string;
    product_name?: string;
    variant_id?: string;
    sku?: string;
    grind_type?: string;
    error?: string;
}

/**
 * Opciones para crear una variante
 */
export interface CreateVariantOptions {
    product_id: string;
    presentation: Presentation;
    grind_type: GrindType;
    weight_grams: number;
    base_price: number;
    cost?: number;
    stock_grams?: number;
    min_stock?: number;
    is_default?: boolean;
}

/**
 * Helper: Verificar si hay stock suficiente para una cantidad
 */
export function hasStockForQuantity(
    variant: ProductVariant | VariantForSale,
    quantity: number
): boolean {
    const stockGrams = 'stock_grams' in variant ? variant.stock_grams : 0;
    const weightGrams = 'weight_grams' in variant ? variant.weight_grams : 500;
    return stockGrams >= weightGrams * quantity;
}

/**
 * Helper: Formatear nombre de variante
 */
export function formatVariantName(
    productName: string,
    presentation: Presentation,
    grindType: GrindType
): string {
    const presLabel = presentationLabels[presentation] || presentation;
    const grindLabel = grindTypeShortLabels[grindType] || grindType;
    return `${productName} - ${presLabel} (${grindLabel})`;
}

/**
 * Helper: Calcular stock en unidades vendibles
 */
export function stockInUnits(stockGrams: number, unitGrams: number): number {
    return Math.floor(stockGrams / unitGrams);
}

/**
 * Helper: Obtener color de badge según nivel de stock
 */
export function getStockLevelColor(stockGrams: number, minStock: number): string {
    if (stockGrams <= 0) return 'bg-red-100 text-red-800';
    if (stockGrams < minStock) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
}
