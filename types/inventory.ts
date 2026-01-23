/**
 * Tipos para el sistema Kardex de inventario
 * Migración: 023_inventory_kardex.sql
 */

/**
 * Tipos de movimiento de inventario
 * - sale: Venta (descuento automático)
 * - restock: Reposición/compra
 * - adjustment: Ajuste manual (conteo físico)
 * - loss: Merma/pérdida
 * - return: Devolución de cliente
 * - production: Entrada por tostión
 * - transfer_out: Salida por transferencia
 * - transfer_in: Entrada por transferencia
 */
export type MovementType =
    | 'sale'
    | 'restock'
    | 'adjustment'
    | 'loss'
    | 'return'
    | 'production'
    | 'transfer_out'
    | 'transfer_in';

/**
 * Etiquetas legibles para tipos de movimiento
 */
export const movementTypeLabels: Record<MovementType, string> = {
    sale: 'Venta',
    restock: 'Reposición',
    adjustment: 'Ajuste',
    loss: 'Merma',
    return: 'Devolución',
    production: 'Producción',
    transfer_out: 'Transferencia (salida)',
    transfer_in: 'Transferencia (entrada)',
};

/**
 * Colores para badges de tipo de movimiento
 */
export const movementTypeColors: Record<MovementType, string> = {
    sale: 'bg-blue-100 text-blue-800',
    restock: 'bg-green-100 text-green-800',
    adjustment: 'bg-yellow-100 text-yellow-800',
    loss: 'bg-red-100 text-red-800',
    return: 'bg-purple-100 text-purple-800',
    production: 'bg-emerald-100 text-emerald-800',
    transfer_out: 'bg-orange-100 text-orange-800',
    transfer_in: 'bg-cyan-100 text-cyan-800',
};

/**
 * Registro de movimiento de inventario
 */
export interface InventoryMovement {
    id: string;
    product_id: string;
    movement_type: MovementType;
    quantity_grams: number; // Positivo = entrada, Negativo = salida
    stock_before: number;
    stock_after: number;
    reference_id?: string;
    reference_type?: string;
    reason?: string;
    unit_cost?: number;
    batch_number?: string;
    performed_by?: string;
    performer_email?: string; // Incluido en la consulta con JOIN
    created_at: string;
}

/**
 * Producto de inventario con movimientos recientes
 */
export interface InventoryItemWithMovements {
    product_id: string;
    product_name: string;
    total_grams_available: number;
    last_updated: string;
    cost_per_gram?: number;
    supplier?: string;
    reorder_point?: number;
    last_restock_date?: string;
    notes?: string;
    recent_movements?: InventoryMovement[];
}

/**
 * Resumen de movimientos por tipo para un producto
 */
export interface MovementSummary {
    product_id: string;
    product_name: string;
    movement_type: MovementType;
    movement_count: number;
    total_grams: number;
    first_movement: string;
    last_movement: string;
}

/**
 * Parámetros para registrar un movimiento
 */
export interface RegisterMovementParams {
    product_id: string;
    movement_type: MovementType;
    quantity_grams: number;
    reference_id?: string;
    reference_type?: string;
    reason?: string;
    unit_cost?: number;
    batch_number?: string;
}

/**
 * Parámetros para consultar historial de movimientos
 */
export interface GetMovementsParams {
    product_id: string;
    limit?: number;
    offset?: number;
    movement_type?: MovementType;
    date_from?: string;
    date_to?: string;
}

/**
 * Tipos de referencia para movimientos
 */
export type ReferenceType =
    | 'sale'
    | 'purchase_order'
    | 'manual'
    | 'production_batch'
    | 'return_order';

/**
 * Helper para determinar si un movimiento es entrada o salida
 */
export function isEntryMovement(type: MovementType): boolean {
    return ['restock', 'return', 'production', 'transfer_in'].includes(type);
}

/**
 * Helper para determinar si un movimiento es salida
 */
export function isExitMovement(type: MovementType): boolean {
    return ['sale', 'loss', 'transfer_out'].includes(type);
}

/**
 * Formatea gramos a una representación legible
 */
export function formatGrams(grams: number): string {
    if (Math.abs(grams) >= 1000) {
        return `${(grams / 1000).toFixed(2)} kg`;
    }
    return `${grams} g`;
}

/**
 * Convierte gramos a libras (para display)
 */
export function gramsToLbs(grams: number): number {
    return grams / 453.592;
}

/**
 * Convierte libras a gramos
 */
export function lbsToGrams(lbs: number): number {
    return lbs * 453.592;
}
