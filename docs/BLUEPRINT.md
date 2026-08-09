# BLUEPRINT — Café Mirador CRM

Arquitectura y decisiones de diseño. Responde **por qué** el sistema es como es;
el **qué** está en [`../CLAUDE.md`](../CLAUDE.md) y el **cuándo** en
[`ROADMAP.md`](ROADMAP.md).

- **Última verificación contra el código:** 2026-08-09
- **Documentos hermanos:** [ROADMAP](ROADMAP.md) · [BACKLOG](BACKLOG.md) · [SYLLABUS](SYLLABUS.md) · [README](../README.md) · [CLAUDE.md](../CLAUDE.md)

---

## 1. Qué es este sistema

Un CRM para un negocio de café de origen en Salento (Colombia) que vende libra
(**500 g**) y media libra (**250 g**) directo al consumidor. **No es una cafetería.**

> **Sobre el gramaje.** Este documento decía 453,6 g y 226,8 g —la libra
> avoirdupois— hasta el 2026-07-27. Es falso: `process_coffee_sale` usa
> `v_grams_per_unit := 500` y `:= 250`, que es lo que realmente descuenta del
> inventario. El negocio vende en **libra comercial de 500 g**. La cifra
> equivocada llevaba propagándose a `CLAUDE.md` y al manual de usuario, y el
> comentario de `004_dashboard_stats.sql` llegó a contradecir a su propio código
> (decía `/453.59` mientras dividía por `500.0`). Corregido en los cuatro sitios.

Tiene **dos superficies sobre una sola app Next.js**:

| Superficie        | Ruta base | Usuarios           | Autenticación                                               |
| ----------------- | --------- | ------------------ | ----------------------------------------------------------- |
| CRM de staff      | `/`       | Dueño y vendedores | Supabase Auth (email + contraseña) + aprobación manual      |
| Portal de cliente | `/portal` | Clientes finales   | Magic link de 24 h enviado por WhatsApp → sesión de 30 días |

Que compartan app es deliberado: el mismo modelo de datos sirve a las dos, y
duplicarlo en dos despliegues obligaría a sincronizar esquemas a mano.

## 2. Decisiones de arquitectura

### D1 — La lógica de negocio vive en la base de datos, no en el cliente

Las operaciones que tocan varias tablas se ejecutan como **RPC de PostgreSQL**
(`process_coffee_sale`, `edit_sale`, `generate_customer_magic_link`…), no como
secuencias de llamadas desde el navegador.

**Por qué:** una venta escribe en `sales`, `sale_items`, descuenta `inventory` y
actualiza `customers.last_purchase_date`. Hacerlo desde el cliente significa
cuatro round-trips sin transacción: una caída a mitad deja stock descontado sin
venta registrada. Dentro de una RPC es atómico.

**Consecuencia:** el contrato crítico del sistema es el de las RPC, no el de
ningún módulo de TypeScript. Cambiar una firma en `supabase/migrations/` rompe
el frontend sin que `tsc` lo note.

### D2 — La autorización se aplica con RLS, no en el frontend

`profiles.role` (`admin` | `seller`) y `profiles.approved` gobiernan el acceso
mediante Row Level Security. El frontend **también** oculta botones, pero eso es
comodidad, no seguridad: la puerta está en la base de datos.

**Por qué:** el bundle de Next.js es público. Cualquier control que viva solo en
React es sugerencia.

### D3 — Aprobación manual de usuarios

Registrarse no da acceso: `profiles.approved` arranca en `false` y un admin
aprueba desde el dashboard. El usuario en espera ve `/pendiente`.

**Por qué:** el registro es abierto (Supabase Auth), pero los datos son de un
negocio real con clientes identificables.

### D4 — Portal sin contraseña

Los clientes no tienen cuenta: reciben un magic link por WhatsApp. Token de 24 h
→ sesión de 30 días en `localStorage`.

**Por qué:** el canal real con estos clientes ya es WhatsApp. Pedirles crear y
recordar una contraseña para pedir café es fricción que no van a pagar.

### D5 — Recurrencia calculada, no declarada

`calculate_customer_recurrence` promedia los días entre las **últimas tres**
compras. Con menos de tres, la recurrencia es `null` y el sistema no adivina.

**Por qué:** un promedio sobre dos puntos no es una tendencia. Sugerir un valor
falso es peor que no sugerir: el vendedor contacta al cliente cuando no toca y
deja de confiar en la señal.

### D6 — Dark mode canónico

`<html className="dark">` por defecto, primario café (`#8B4513` claro /
`#A0522D` oscuro) sobre neutros casi negros. Ver
[design system](../../project/README.md).

### D7 — Un solo catálogo, y es `inventory`

Hubo dos modelos de producto conviviendo: `inventory` (product_id, gramos,
costo) y el par `products`/`product_variants` de la Fase 4 (SKU, presentación,
tipo de molido). Este documento y el ROADMAP daban por hecho que el segundo era
el vivo y que faltaba migrar el portal a él.

**Al preguntárselo a la base, era al revés:** 28 funciones trabajaban sobre
`inventory` —`process_coffee_sale`, `get_dashboard_stats`, `get_advanced_metrics`,
`edit_sale` y todo el portal— y solo 5 sobre las variantes, de las que **una
sola** se invocaba desde el código, y desde un componente que ninguna página
renderizaba. El modelo «nuevo» no llegó nunca a usarse; su único efecto visible
eran cinco nombres de producto rotos («Café», «Café en»), residuo de la regex de
`025` al quitarles el tipo de molido.

[`036`](../supabase/migrations/036_catalogo_unico_sobre_inventory.sql) retira
`products`, `product_variants` y sus siete funciones, fusiona las filas
duplicadas de `inventory` y añade un índice único sobre el nombre para que no
vuelvan. El precio de venta pasa a vivir en `inventory` (`price_per_lb`,
`price_per_half_lb`), que es donde `get_product_price_for_customer` llevaba
buscándolo desde siempre — y por eso fallaba en cada venta.

**La lección no es cuál de los dos modelos era mejor**, sino que la documentación
afirmaba lo contrario de lo que hacía el código y nadie lo había contrastado.

### D8 — El stock puede ser negativo, y eso es información

Aquí **primero se vende y después se registra**: el café se entrega en mano y la
venta entra al CRM horas o días más tarde. Con un inventario que va por detrás de
la realidad, rechazar la venta con «Stock insuficiente» no protege nada — impide
registrar algo que **ya ocurrió**, y esa venta perdida no descuenta inventario,
no cuenta en las métricas, no actualiza `last_purchase_date` ni entra en la
cartera. El sistema no evitaba el descuadre: lo escondía.

Desde [`041`](../supabase/migrations/041_permitir_stock_negativo.sql) y
[`042`](../supabase/migrations/042_el_stock_negativo_tambien_estaba_prohibido_en_la_tabla.sql),
un stock negativo es un estado **válido y con significado**: «se vendió café que
el sistema no sabía que existía; falta registrar la entrada».

Lo que **sigue** rechazándose: vender un producto que no existe en `inventory`,
porque no hay a qué imputar la venta ni de dónde sacar el costo.

⚠️ **`create_customer_order` conserva la validación**, y es la única. Ahí quien
pide no es el dueño sino un cliente desde el portal: el aviso no bloquea un
registro, evita prometer un café que no se podrá entregar. Convertirlo en pedido
por encargo es una decisión de producto — [BACKLOG C8](BACKLOG.md#c--requiere-juicio-humano).

### D9 — El precio de la media libra no es la mitad

La libra vale **$45.000** y la media **$25.000**, no $22.500. Es un precio
comercial propio, no una división.

Eso choca con el modelo: `inventory.cost_per_gram` es **un solo número por
producto** y el costo de una venta se calcula multiplicándolo por los gramos. Con
los márgenes reales del negocio —libra $19.000, media libra $11.500— salen **dos
costos por gramo distintos**: $52 y $54. No cuadran, y es correcto que no
cuadren: la media libra lleva el mismo empaque y el mismo trabajo para la mitad
de café.

Se eligió **$52**, el que cuadra la libra, porque es lo que se vende (las 133
ventas del histórico fueron por libras). La media libra muestra $12.000 en vez de
$11.500, y esa desviación está **medida y aceptada**, no ignorada. Separar el
costo del empaque del costo del café es [BACKLOG A26](BACKLOG.md#a--automatizable-ahora);
recalibrar el $52 hasta que salga bonito **no** es la salida, porque entonces
dejaría de cuadrar la libra.

## 3. Contratos que TypeScript no protege

Esta es la clase de fallo más cara del proyecto, y ya se materializó una vez.

| Contrato                         | Productor                       | Consumidor             | Protección                                           |
| -------------------------------- | ------------------------------- | ---------------------- | ---------------------------------------------------- |
| Respuesta de `/api/backups/list` | `app/api/backups/list/route.ts` | `app/backups/page.tsx` | ✅ `types/backups.ts`, tipo único compartido         |
| Firma de las RPC                 | `supabase/migrations/*.sql`     | Todo el frontend       | ❌ **sin protección** — ver [BACKLOG](BACKLOG.md) B4 |
| Datos de MSW                     | `__mocks__/handlers.ts`         | La suite entera        | ✅ parcial: los mocks de backups ya están tipados    |

**Precedente (commit `5ce639e`):** `interface BackupFile` estaba declarado dos
veces. El productor emitía `downloadUrl`, el consumidor leía `webViewLink`. Los
enlaces de descarga nunca se renderizaron en producción, y los 865 tests pasaban
en verde porque el mock replicaba el error del consumidor.

**Regla que sale de ahí:** _un tipo que cruza una frontera de proceso (HTTP, RPC,
Storage) se declara una sola vez y lo importan los dos lados. Y el mock se tipa
con ese mismo tipo_ — si el mock puede mentir, la suite deja de ser evidencia.

## 4. Estructura de tipos

```
types/
├── index.ts              Dashboard, ítems de venta (re-exporta analytics)
├── analytics.ts          Métricas y series temporales
├── customer-recurrence.ts  Cliente completo con recurrencia
├── inventory.ts          Kardex + InventoryProductSummary + SaleProductOption
├── products.ts           Catálogo padre/variantes (Fase 4)
├── portal.ts             PortalProductOption
├── sales.ts              SaleCustomerOption
├── referrals.ts          Referidos: Admin* (toda la tabla) vs Portal* (un cliente)
├── deliveries.ts         Zonas de entrega, con la nulabilidad real del esquema
└── backups.ts            Contrato de la API de backups
```

**Convención de nombres:** cuando dos superficies necesitan «lo mismo» con
distinta forma, cada forma lleva nombre propio (`PortalProductOption` vs
`InventoryProductSummary`). Nunca dos `interface Product` distintas.

El prefijo indica **el universo del dato**, no el archivo que lo consume:
`Admin*` es lo que agrega sobre toda la tabla, `Portal*` lo que una RPC recorta
al cliente que consulta. Por eso `AdminReferralStats` y `PortalReferralStats`
son tipos separados aunque «cuenten lo mismo»: sus campos ni siquiera se llaman
igual (`total_referrals` vs `total`).

**Sobre los alias de importación.** Se usan cuando el nombre local sigue siendo
inequívoco en su archivo (`PortalProductOption as Product`). No se usan cuando
el nombre corto es precisamente el ambiguo: importar `AdminReferralStats as
ReferralStats` reintroduce en el punto de lectura la ambigüedad que separar los
tipos venía a eliminar.

## 5. Estado de despliegue

| Pieza       | Dónde                                                                            |
| ----------- | -------------------------------------------------------------------------------- |
| App         | Vercel · <https://cafe-pi-steel.vercel.app> · deploy automático al push a `main` |
| Datos       | Supabase (PostgreSQL + Auth + Storage)                                           |
| Backups     | Supabase Storage, diarios 02:00 UTC vía GitHub Actions                           |
| Repositorio | <https://github.com/alvarettosky/cafe> — **público**                             |

⚠️ **El repositorio es público.** Ningún dato de clientes reales entra aquí. El
histórico de ventas con nombres vive en el repositorio privado
`alvaretto/proyectos-varios`.
