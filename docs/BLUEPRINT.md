# BLUEPRINT — Café Mirador CRM

Arquitectura y decisiones de diseño. Responde **por qué** el sistema es como es;
el **qué** está en [`../CLAUDE.md`](../CLAUDE.md) y el **cuándo** en
[`ROADMAP.md`](ROADMAP.md).

- **Última verificación contra el código:** 2026-07-27
- **Documentos hermanos:** [ROADMAP](ROADMAP.md) · [BACKLOG](BACKLOG.md) · [SYLLABUS](SYLLABUS.md) · [README](../README.md) · [CLAUDE.md](../CLAUDE.md)

---

## 1. Qué es este sistema

Un CRM para un negocio de café de origen en Salento (Colombia) que vende libra
(453,6 g) y media libra (226,8 g) directo al consumidor. **No es una cafetería.**

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
