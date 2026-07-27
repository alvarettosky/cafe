/**
 * Tipos de los formularios de venta.
 *
 * Complementa types/customer-recurrence.ts: alli vive `CustomerWithRecurrence`,
 * el cliente completo que consumen /clientes y /contactos. Aqui vive la forma
 * minima que necesita un selector de cliente dentro de una venta.
 */

/**
 * Cliente tal como lo consumen los selectores de NewSaleModal y
 * /ventas/nueva: identidad y recurrencia, sin historial ni contacto.
 *
 * `typical_recurrence_days` es null cuando el cliente aun no tiene tres
 * compras registradas y la recurrencia no se ha calculado.
 */
export interface SaleCustomerOption {
    id: string;
    full_name: string;
    typical_recurrence_days: number | null;
}
