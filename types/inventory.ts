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
 * Gramos que pesa UNA libra en este negocio.
 *
 * ⚠️ 500, no 453,592. Café Mirador vende la **libra comercial de 500 g**, que
 * es lo que descuenta `process_coffee_sale` del inventario en cada venta
 * (`v_grams_per_unit := 500`, y 250 la media libra). Las dos funciones de abajo
 * usaban la libra **avoirdupois** de 453,592 g: nadie las llamaba todavía, así
 * que no habían hecho daño, pero la primera pantalla que las usara habría
 * mostrado 11,02 libras donde el inventario cuenta 10 — un 10 % de diferencia
 * sobre la unidad central del negocio, y sin forma de saber cuál de los dos
 * números creerse.
 *
 * Es el mismo error que `CLAUDE.md`, `BLUEPRINT §1` y el manual afirmaron
 * durante meses. Se corrigió en los tres documentos el 2026-07-27; aquí, en el
 * código, seguía vivo hasta el 2026-08-09.
 */
export const GRAMOS_POR_LIBRA = 500;

/**
 * Convierte gramos a libras (para display)
 */
export function gramsToLbs(grams: number): number {
  return grams / GRAMOS_POR_LIBRA;
}

/**
 * Convierte libras a gramos
 */
export function lbsToGrams(lbs: number): number {
  return lbs * GRAMOS_POR_LIBRA;
}

/**
 * Producto de inventario en su forma minima: lo que necesitan las listas y
 * los selectores de stock. Es el subconjunto de InventoryItemWithMovements
 * que consumen inventory-list y product-modal.
 *
 * Ya no hay con qué confundirlo: `types/products.ts` y las tablas
 * `products`/`product_variants` se retiraron en la migracion 036. `inventory`
 * es el unico catalogo.
 */
export interface InventoryProductSummary {
  product_id: string;
  product_name: string;
  total_grams_available: number;
  /** Precio de venta de la libra (500 g) en COP. `null` = sin precio declarado. */
  price_per_lb?: number | null;
  /** Precio de media libra (250 g). NO es la mitad del anterior: es propio. */
  price_per_half_lb?: number | null;
}

/**
 * Producto tal como lo ven los formularios de venta: solo identidad, sin
 * stock. Derivado de InventoryProductSummary para que no puedan divergir.
 */
export type SaleProductOption = Pick<InventoryProductSummary, 'product_id' | 'product_name'>;
