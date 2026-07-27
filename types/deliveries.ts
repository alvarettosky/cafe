/**
 * Tipos de zonas de entrega.
 * Migracion: `022_fase3_crecimiento.sql` (tabla `delivery_zones`).
 *
 * La forma de una zona estaba declarada TRES veces: dos `interface
 * DeliveryZone` con nombre (delivery-zones-manager.tsx, delivery-zone-select.tsx)
 * y una tercera anonima, inline en el `.map()` del manager. Las tres describen
 * la misma consulta —`.from('delivery_zones').select('*')`— y aun asi no
 * coincidian entre si.
 *
 * La discrepancia no es cosmetica: dos de las tres declaraban `delivery_days` y
 * `color` como NO nulos. El esquema dice lo contrario — ambas columnas se
 * crearon sin `NOT NULL` (`022_fase3_crecimiento.sql:106-107`), asi que null es
 * un valor legitimo que la base puede devolver.
 *
 * No se ha caido nada porque los consumidores llevan guardas defensivas que el
 * tipo declaraba imposibles: `zone.color || COLORS[0]`, y un `if (!days)` dentro
 * de un `getDaysLabel(days: string[])`. Es decir, quien escribio el codigo sabia
 * que podian ser null; solo el tipo no se entero. El dia que alguien confie en
 * el tipo y escriba `zone.delivery_days.map(...)`, TypeScript no lo va a parar.
 *
 * Mismo patron que produjo el bug `5ce639e` (ver `types/backups.ts`).
 */
export interface DeliveryZone {
  id: string;
  name: string;
  description: string | null;
  /** Dias de reparto (`['monday', 'thursday']`). null si la zona no tiene ninguno asignado. */
  delivery_days: string[] | null;
  /** Color hex `#RRGGBB` para la UI. null si no se definio: usar un color por defecto. */
  color: string | null;
  sort_order: number;
  is_active: boolean;
}

/**
 * Zona enriquecida con el numero de clientes asignados.
 *
 * `customer_count` NO es una columna de `delivery_zones`: sale del embed
 * `customers:customers(count)` de PostgREST, que llega como
 * `customers: [{ count: n }]`, y se aplana en el cliente. Por eso vive en un
 * tipo aparte y no en `DeliveryZone`: una consulta sin ese embed nunca lo trae.
 */
export interface DeliveryZoneWithCustomerCount extends DeliveryZone {
  customer_count: number;
}
