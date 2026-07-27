/**
 * Tipos del Portal de Cliente (Fase 2).
 *
 * El portal habla con RPCs distintas a las del CRM de staff y recibe los
 * productos ya filtrados por disponibilidad, con `id`/`name` en vez de
 * `product_id`/`product_name`. Por eso NO reutiliza los tipos de
 * types/inventory.ts: es otra forma, no una variante de la misma.
 */

/**
 * Producto tal como lo devuelve `get_products_for_customer_order()` al
 * portal: identidad y disponibilidad, sin stock ni precios.
 *
 * Lo consumen /portal/nuevo-pedido y /portal/suscripcion.
 */
export interface PortalProductOption {
    id: string;
    name: string;
    available: boolean;
}
