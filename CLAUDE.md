# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Sistema Café Mirador CRM

Sistema completo de gestión para cafetería: inventario, punto de venta (POS), gestión de clientes con recurrencia, y análisis de ventas. Desplegado en producción en Vercel con Supabase como backend.

### Estado de Implementación

| Fase | Nombre                         | Estado        |
| ---- | ------------------------------ | ------------- |
| 1    | Maximizar Recurrencia          | ✅ Completado |
| 2    | Portal de Cliente Self-Service | ✅ Completado |
| 3    | Crecimiento y Escalabilidad    | ✅ Completado |
| 4    | Arquitectura POS Profesional   | ✅ Completado |

**Testing**: 854 tests unitarios + 7 E2E pasando (93%+ cobertura)

## Comandos Esenciales

### Desarrollo Local

**IMPORTANTE**: Este proyecto requiere Node.js v20+ en un entorno virtual local:

```bash
# Activar entorno (NECESARIO en cada terminal nueva)
source setup_env.sh
export PATH=$(pwd)/.node_env/bin:$PATH

# Desarrollo
npm install              # Instalar dependencias
npm run dev             # Servidor desarrollo (localhost:3000)
npm run build           # Build de producción
npm start               # Servidor producción local
```

### Testing

```bash
# Tests Unitarios e Integración (Vitest)
npm test                    # Ejecutar todos los tests
npm run test:coverage       # Con reporte de cobertura
npm run test:watch          # Modo watch
npm run test:ui             # Interfaz UI interactiva

# Tests E2E (Playwright)
npx playwright test         # Todos los navegadores
npx playwright test --ui    # Modo UI interactivo

# Tests Avanzados
npm run test:mutation       # Mutation testing con Stryker
npm run test:db             # Tests de integración con base de datos
npm run test:load           # Load testing con k6
npm run test:spike          # Spike testing
npm run test:soak           # Soak testing

# Cobertura requerida: 80%+ en lines, functions, branches, statements
```

### Linting y Formateo

```bash
npm run lint                # ESLint
npm run format              # Prettier (write)
npm run format:check        # Prettier (check)
```

### Git Hooks

Pre-commit automático (Husky + lint-staged):

- ESLint con auto-fix
- Prettier formatting
- TypeScript type checking
- Tests relacionados con archivos modificados

## Arquitectura del Proyecto

### Stack Tecnológico

- **Frontend**: Next.js 16 (App Router), React 19, TailwindCSS 4, Framer Motion
- **Backend**: Supabase (PostgreSQL, Auth, RLS, RPC Functions)
- **UI Components**: Radix UI (Dialog), Lucide Icons
- **Testing**: Vitest + Testing Library, Playwright, Stryker, k6, MSW
- **Deploy**: Vercel (CI/CD automático)

### Estructura de Rutas (App Router)

```
/               → Dashboard principal (inventario, ventas recientes, KPIs)
/login          → Autenticación con Supabase Auth
/pendiente      → Pantalla de espera para usuarios no aprobados
/analytics      → Dashboard analítico (gráficos de ventas, métricas)
/clientes       → Gestión de clientes con recurrencia (incluye "Nuevo Cliente")
/contactos      → Lista de contactos por recurrencia + Prospectos (integración WhatsApp)
/inventario     → Gestión de inventario con Kardex de movimientos
/precios        → Gestión de listas de precios diferenciados (solo admin)
/backups        → Exportación de datos CSV/XLSX y gestión de backups (solo admin)

# Portal de Cliente (Fase 2)
/portal             → Dashboard del cliente (último pedido, próximo pedido, acciones rápidas)
/portal/auth        → Validación de magic links (autenticación sin contraseña)
/portal/nuevo-pedido → Formulario para crear nuevo pedido
/portal/pedidos     → Historial completo de pedidos del cliente
/portal/perfil      → Edición de datos de contacto (teléfono, email, dirección)
/portal/suscripcion → Gestión de suscripción automática de café
/portal/referidos   → Programa de referidos (generar códigos, ver historial)
```

### Base de Datos (Supabase)

**Tablas Principales:**

- `inventory` - Productos, stock (kg/units), precios, costos
- `sales` - Ventas con customer_id, payment_method, totales, profit, status, notes
- `sale_items` - Items de cada venta (producto, cantidad, precio, profit)
- `customers` - Clientes con recurrencia típica, última compra, dirección
- `customer_contacts` - Historial de contactos con clientes
- `profiles` - Roles de usuario (admin/seller) para RLS
- `whatsapp_templates` - Templates de mensajes WhatsApp para contacto automático
- `customer_auth` - Autenticación de clientes (magic links, sesiones)
- `customer_subscriptions` - Suscripciones automáticas de café
- `subscription_items` - Items de cada suscripción
- `referrals` - Programa de referidos (códigos, estados, recompensas)
- `referral_program_config` - Configuración del programa de referidos
- `price_lists` - Listas de precios diferenciados por tipo de cliente
- `price_list_items` - Precios personalizados por producto en cada lista
- `delivery_zones` - Zonas de entrega con días de reparto
- `deliveries` - Entregas programadas con estado
- `delivery_items` - Items de cada entrega
- `inventory_movements` - Kardex de movimientos de inventario (Fase 4)
- `products` - Catálogo de productos padre (Fase 4)
- `product_variants` - Variantes vendibles con SKU, presentación, tipo de molido (Fase 4)

**Vistas:**

- `customer_segments` - Segmentación RFM automática de clientes (champion, loyal, potential, new, at_risk, lost, prospect)

**RPC Functions Críticas:**

- `process_coffee_sale(customer_id, items, created_at, payment_method, customer_recurrence_days)` - Procesa venta completa con actualización de inventario
- `get_dashboard_stats()` - KPIs del dashboard
- `calculate_customer_recurrence(customer_id)` - Calcula recurrencia basada en últimas 3 compras
- `get_customers_to_contact(days_threshold)` - Lista de clientes a contactar
- `can_edit_sale(sale_id)` - Verifica si venta es editable (< 24 horas)
- `edit_sale(sale_id, customer_id, payment_method, items)` - Edita venta existente
- `get_pending_users()` - Lista usuarios pendientes de aprobación (solo admin)
- `approve_user(p_user_id)` - Aprueba un usuario (solo admin)
- `reject_user(p_user_id)` - Rechaza/elimina un usuario (solo admin)
- `get_last_sale_for_repeat(customer_id)` - Obtiene última venta para repetir pedido
- `generate_whatsapp_message(customer_id, template_key)` - Genera mensaje WhatsApp contextual
- `get_customer_whatsapp_template(customer_id)` - Determina template automático según estado del cliente
- `get_customer_segment_stats()` - Estadísticas de segmentación de clientes
- `get_customers_by_segment(segment)` - Lista clientes por segmento

**Portal de Cliente (Fase 2):**

- `generate_customer_magic_link(p_customer_id)` - Genera enlace mágico con URL de WhatsApp
- `validate_customer_magic_link(p_token)` - Valida token y crea sesión
- `validate_customer_session(p_session_token)` - Verifica validez de sesión
- `invalidate_customer_session(p_session_token)` - Cierra sesión del cliente
- `get_customer_portal_dashboard(p_customer_id)` - Dashboard completo del cliente
- `get_customer_order_history(p_customer_id, p_limit, p_offset)` - Historial de pedidos
- `get_products_for_customer_order()` - Lista productos disponibles
- `create_customer_order(p_customer_id, p_items, p_notes)` - Crea pedido pendiente
- `update_customer_profile(p_customer_id, p_phone, p_email, p_address)` - Actualiza perfil
- `get_pending_customer_orders()` - Lista pedidos pendientes (staff)
- `confirm_customer_order(p_sale_id, p_items_with_prices)` - Confirma pedido con precios
- `reject_customer_order(p_sale_id, p_reason)` - Rechaza pedido
- `get_customer_subscription(p_customer_id)` - Obtiene suscripción activa
- `upsert_customer_subscription(p_customer_id, p_frequency_days, p_items)` - Crea/actualiza suscripción
- `toggle_subscription_status(p_customer_id, p_action)` - Pausa/reanuda/omite/cancela

**Crecimiento y Escalabilidad (Fase 3):**

- `generate_referral_code(p_customer_id)` - Genera código de referido único
- `apply_referral_code(p_code, p_new_customer_phone)` - Aplica código de referido
- `complete_referral_on_purchase(p_referral_id)` - Completa referido tras compra
- `get_referral_stats()` - Estadísticas del programa de referidos
- `get_my_referrals(p_customer_id)` - Lista referidos de un cliente
- `get_product_price_for_customer(p_customer_id, p_product_id)` - Precio según tipo de cliente
- `get_deliveries_for_date(p_date)` - Entregas programadas para una fecha
- `get_customers_without_zone()` - Clientes sin zona asignada

**Arquitectura POS Profesional (Fase 4):**

- `get_inventory_movements(p_product_id, p_limit, p_offset, p_movement_type, p_date_from, p_date_to)` - Historial de movimientos de inventario (Kardex)
- `add_inventory_movement(p_product_id, p_movement_type, p_quantity_grams, p_reason, p_unit_cost, p_batch_number)` - Registra movimiento manual de inventario
- `get_products_with_variants()` - Lista productos con sus variantes
- `get_variants_for_sale()` - Variantes disponibles para venta con stock

**Row Level Security (RLS):**

- Solo usuarios **aprobados** (`approved = true`) pueden acceder a datos sensibles
- Solo **admins** pueden editar inventario
- Todos los aprobados pueden crear ventas y clientes
- El rol se define en `profiles.role` ('admin' o 'seller')
- La aprobación se define en `profiles.approved` (boolean)

### Flujo de Ventas

1. Usuario abre modal de Nueva Venta (`NewSaleModal`)
2. Selecciona cliente existente o crea nuevo (con recurrencia opcional)
3. Sistema sugiere recurrencia basada en últimas 3 compras (RPC)
4. Selecciona producto, cantidad (libra/media libra), precio
5. Define método de pago y fecha (opcional, default: ahora)
6. Al confirmar: llama RPC `process_coffee_sale` que:
   - Crea registro en `sales`
   - Crea items en `sale_items`
   - Actualiza inventario (descuenta stock)
   - Actualiza `customers.last_purchase_date`
   - Calcula profit/margen automáticamente

### Sistema de Recurrencia de Clientes

**Concepto**: Predecir cuándo un cliente volverá a comprar basado en historial.

**Flujo**:

1. Cada venta actualiza `customers.last_purchase_date` (trigger)
2. Con ≥3 compras, `calculate_customer_recurrence` calcula promedio de días entre compras
3. En nueva venta, sistema sugiere recurrencia si no está configurada
4. Usuario puede aceptar sugerencia o definir manualmente
5. Página `/contactos` muestra clientes que deberían ser contactados según:
   - `days_until_expected = typical_recurrence_days - days_since_last_purchase`
   - Urgencia: alta (≤-7d), media (≤0d), baja (≤3d)
6. Integración WhatsApp: genera mensaje automático con nombre y días de atraso
7. Sección **Prospectos**: clientes con `last_purchase_date = NULL` (nunca han comprado)

**Componentes Clave**:

- `RecurrenceInput` - Input de recurrencia con sugerencia AI
- `CustomerModal` - Edición completa de cliente (incluye recurrencia)
- `app/clientes/page.tsx` - Lista de todos los clientes con estado
- `app/contactos/page.tsx` - Lista priorizada para contacto

### Gestión de Inventario

- Productos tienen `stock_kg` y `stock_units` separados
- `min_stock_threshold` para alertas de stock bajo
- Ventas en "libra" (453.6g) o "media libra" (226.8g) descuentan de `stock_kg`
- Solo admins pueden editar inventario (`ProductModal`)
- Dashboard muestra alertas de stock bajo

### Analytics

Página `/analytics` con:

- Selector de rango de fechas (presets: hoy, semana, mes, año)
- Gráficos de ventas por tiempo (Recharts)
- Top productos
- Métricas de profit/margen
- Análisis de métodos de pago

RPCs para analytics:

- `get_advanced_metrics(start_date, end_date)`
- `get_time_series_data(start_date, end_date, interval)` (intervals: day/week/month)

### Sistema de Exportación

Página `/backups` (solo admins) permite exportar datos a CSV o Excel:

**Tablas exportables:**

- `inventory` - Productos y stock
- `sales` - Historial de ventas (filtrable por fecha)
- `sale_items` - Detalle de items vendidos (filtrable por fecha)
- `customers` - Datos de clientes
- `customer_contacts` - Historial de contactos (filtrable por fecha)
- `products` - Catálogo de productos
- `product_variants` - Variantes de productos

**Funcionalidades:**

- Selección múltiple de tablas
- Formato CSV o XLSX (Excel con hojas separadas por tabla)
- Filtro por rango de fechas (para tablas con timestamp)
- Límite de 10,000 registros por tabla
- Botones de exportación rápida en Dashboard, Analytics y Clientes

**API Route:** `POST /api/export`

```typescript
// Request body
{
  tables: ['inventory', 'sales'],
  format: 'xlsx',
  dateRange?: { start: '2026-01-01', end: '2026-01-31' }
}
```

### Variables de Entorno

Archivo `.env.local` requerido:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anon-publica
```

El cliente Supabase se inicializa en `lib/supabase.ts` con fallbacks para build-time.

### Migraciones SQL

Directorio `supabase/migrations/` contiene migración secuencial:

- `000_inventory_table.sql` - Tabla inventario
- `001_process_coffee_sale.sql` - RPC principal de ventas
- `002_sales_tables.sql` - Tablas sales y sale_items
- `005_customers.sql` - Tabla customers
- `010_security_rls.sql` - RLS en todas las tablas
- `011_roles_and_permissions.sql` - Sistema de roles

**Nuevas features con recurrencia:**

- `migrations/phase1_migration_clean.sql` - Recurrencia y edición de ventas
- `migrations/update_process_coffee_sale_with_recurrence.sql` - Actualiza RPC con parámetro recurrencia
- `migrations/021_fase1_recurrencia.sql` - Fase 1: Repetir pedido, WhatsApp inteligente, segmentación RFM
- `migrations/022_fase2_portal_cliente.sql` - Fase 2: Portal de cliente, magic links, suscripciones
- `migrations/022_fase3_crecimiento.sql` - Fase 3: Referidos, listas de precios, zonas de entrega
- `migrations/023_inventory_kardex.sql` - Fase 4: Kardex de inventario (inventory_movements)
- `migrations/024_product_variants.sql` - Fase 4: Productos con variantes (products, product_variants)
- `migrations/025_migrate_inventory_to_variants.sql` - Fase 4: Migración de datos a variantes
- `migrations/026_fix_kardex_types.sql` - Fase 4: Corrección de tipos en RPC kardex

Ver `SUPABASE_SETUP.md` para orden completo de ejecución.

### Portal de Cliente (Fase 2)

Sistema self-service para clientes. Autenticación sin contraseña mediante magic links enviados por WhatsApp.

**Flujo de acceso:**

1. Staff genera enlace desde `/clientes` (botón con icono de llave)
2. RPC `generate_customer_magic_link` crea token de 24h y URL de WhatsApp
3. Cliente recibe enlace y accede a `/portal/auth?token=xxx`
4. Token se valida y se crea sesión de 30 días
5. Cliente accede al portal con funcionalidades completas

**Contexto de autenticación:**

- `context/customer-portal-context.tsx` - Provider con `useCustomerPortal()` hook
- Almacena `session_token` en localStorage
- Valida sesión automáticamente al cargar

**Funcionalidades del portal:**

- **Dashboard** (`/portal`): Último pedido, próximo pedido estimado, acciones rápidas
- **Nuevo pedido** (`/portal/nuevo-pedido`): Selección de productos, notas, envío
- **Historial** (`/portal/pedidos`): Todos los pedidos con detalles expandibles
- **Perfil** (`/portal/perfil`): Editar teléfono, email, dirección
- **Suscripción** (`/portal/suscripcion`): Crear/gestionar pedido automático

**Sistema de suscripciones:**

- Cliente configura productos y frecuencia (7-45 días)
- Puede pausar, omitir próxima entrega, o cancelar
- Staff recibe pedidos automáticos para confirmar y entregar

### Autenticación

- `components/auth-provider.tsx` - Context provider con `useAuth()` hook
- Todas las páginas (excepto `/login` y `/pendiente`) requieren autenticación Y aprobación
- Redirección automática a `/login` si no autenticado
- Redirección automática a `/pendiente` si autenticado pero no aprobado
- `app/login/page.tsx` - Email/password con Supabase Auth

### Sistema de Aprobación de Usuarios

**Flujo:**

1. Usuario se registra → `profiles.approved = false` automáticamente
2. Usuario ve pantalla de espera (`/pendiente`)
3. Admin ve badge "Pendientes" en dashboard con cantidad
4. Admin abre modal y aprueba/rechaza usuarios
5. Usuario aprobado puede acceder normalmente

**Componentes:**

- `app/pendiente/page.tsx` - Pantalla de espera
- `components/pending-users-modal.tsx` - Modal de aprobación (admin)
- `components/auth-provider.tsx` - Expone `approved` en contexto

**RPCs:**

- `get_pending_users()` - Lista pendientes
- `approve_user(p_user_id)` - Aprueba
- `reject_user(p_user_id)` - Elimina usuario

### Componentes Reutilizables

**Modales**:

- `NewSaleModal` - Crear venta (incluye recurrencia). Soporta `initialData` para repetir ventas.
- `NewCustomerModal` - Crear cliente
- `CustomerModal` - Editar cliente (nombre, teléfono, email, dirección, recurrencia, última compra, tipo de cliente, zona de entrega). Modal con scroll interno (max-h-[85vh]).
- `ProductModal` - Editar inventario (solo admins)
- `PendingUsersModal` - Aprobar/rechazar usuarios (solo admins)

**Inputs Especializados**:

- `RecurrenceInput` - Input con sugerencia AI para recurrencia
- `DateRangeSelector` - Selector de rango con presets para analytics

**Fase 1 - Maximizar Recurrencia**:

- `RepeatSaleButton` - Botón para repetir última compra de un cliente. Usa RPC `get_last_sale_for_repeat`.
- `SmartWhatsAppButton` - Botón WhatsApp con mensaje contextual automático según estado del cliente.
- `CustomerSegmentBadge` - Badge que muestra segmento RFM del cliente (champion, loyal, at_risk, etc.)
- `CustomerSegmentStats` - Card con estadísticas de segmentación de clientes.

**Fase 2 - Portal de Cliente**:

- `GeneratePortalAccessButton` - Botón para generar magic link de acceso al portal. Muestra diálogo con enlace y opciones de copiar/enviar por WhatsApp.
- `context/customer-portal-context.tsx` - Provider de autenticación para el portal de clientes.

**Fase 3 - Crecimiento y Escalabilidad**:

- `AdminReferralsDashboard` - Panel de administración de referidos con estadísticas y lista de códigos.
- `CustomerTypeSelect` - Selector de tipo de cliente (retail, mayorista pequeño/grande, cafetería, personalizado).
- `DeliveryZoneSelect` - Selector de zona de entrega con colores y días de reparto.
- `PriceListManager` - Gestor de listas de precios diferenciados por tipo de cliente.
- `DeliveryZonesManager` - Gestor de zonas de entrega con días de reparto.
- `DeliveriesDashboard` - Panel de entregas diarias agrupadas por zona con estados.
- `app/portal/referidos/page.tsx` - Portal de referidos para clientes (generar códigos, compartir, historial).

**Fase 4 - Arquitectura POS Profesional**:

- `InventoryMovements` - Modal de historial de movimientos (Kardex) por producto. Tipos soportados: reposición, devolución, merma, ajuste. Trazabilidad completa con razón obligatoria para mermas y devoluciones.
- `ProductVariantSelector` - Selector de producto con variantes agrupadas por producto padre. Muestra SKU, presentación, tipo de molido y stock disponible.
- `ProductVariantSelectCompact` - Versión compacta del selector de variantes para formularios.
- `app/precios/page.tsx` - Página de gestión de listas de precios (solo admin). Integra `PriceListManager`.

**Sistema de Exportación (CSV/XLSX)**:

- `DownloadButton` - Botón reutilizable para exportar datos. Props: `tables`, `format`, `dateRange`, `label`. Solo visible para admins.
- `ExportForm` - Formulario completo de exportación con selección de tablas, formato y filtro de fechas.
- `app/backups/page.tsx` - Página de exportación de datos (solo admin). Incluye exportaciones rápidas predefinidas.
- `app/api/export/route.ts` - API route que genera archivos CSV/XLSX con autenticación y validación.
- `lib/export.ts` - Utilidades para generación de CSV (papaparse) y XLSX (exceljs).

**UI Base**:

- `components/ui/` - Componentes Radix UI styled con Tailwind

### Git Worktrees

Proyecto usa worktrees para desarrollo aislado de features:

```bash
# Los worktrees se crean en .worktrees/ (en .gitignore)
git worktree add .worktrees/nombre-feature nombre-branch
cd .worktrees/nombre-feature
npm install  # Instalar deps en worktree
```

Después de completar feature, copiar archivos al main y hacer merge.

**Exclusiones importantes:** El directorio `.worktrees/` está excluido de:

- `.gitignore` - No se commitean los worktrees
- `.eslintignore` - No se lintean (evita errores con builds `.next/`)
- `vitest.config.mts` - No se ejecutan tests duplicados

### CI/CD Pipeline

GitHub Actions:

- `.github/workflows/ci.yml` - Lint, tests, type-check, build en cada push
- `.github/workflows/e2e.yml` - Tests E2E con Playwright
- `.github/workflows/daily-backup.yml` - Backup diario automatizado (2:00 AM UTC)
- Pre-commit hook ejecuta lint-staged automáticamente

Deploy:

- Vercel conectado a repo
- Deploy automático en push a `main`
- Environment variables configuradas en Vercel dashboard

### Sistema de Backups Automatizados

**Exportación Manual (CSV/XLSX):**

- Página `/backups` permite exportar datos en CSV o Excel
- Tablas disponibles: inventory, sales, sale_items, customers, customer_contacts, products, product_variants
- Filtro por rango de fechas para tablas con timestamps
- Límite de 10,000 registros por tabla

**Backup Automático a Supabase Storage:**

El sistema ejecuta backups diarios a las 2:00 AM UTC con las siguientes características:

- **Almacenamiento**: Supabase Storage (bucket `backups`)
- **Formato**: ZIP con JSON por cada tabla (20 tablas)
- **Notificaciones**: Email via Resend (opcional)
- **Retención automática**:
  - Diarios: últimos 7 días
  - Semanales: últimos 4 domingos
  - Mensuales: últimos 12 primeros de mes
- **Trigger manual**: GitHub Actions UI o CLI (`gh workflow run daily-backup.yml`)

**Scripts de Backup:**

```
scripts/backup/
├── export-tables.ts      # Exporta 20 tablas a JSON
├── upload-supabase.ts    # Sube backup ZIP a Supabase Storage
├── cleanup-retention.ts  # Limpia backups según política de retención
├── send-notification.ts  # Envía notificación por email (opcional)
└── run-backup.ts         # Orquestador principal
```

**Tablas Respaldadas (20):**

```
profiles, products, product_variants, inventory, customers,
customer_contacts, customer_auth, price_lists, price_list_items,
delivery_zones, sales, sale_items, deliveries, delivery_items,
customer_subscriptions, subscription_items, referral_program_config,
referrals, inventory_movements, whatsapp_templates
```

**Variables de Entorno Requeridas (GitHub Secrets):**

| Secreto                     | Propósito                         | Requerido   |
| --------------------------- | --------------------------------- | ----------- |
| `SUPABASE_SERVICE_ROLE_KEY` | Autenticación admin para Supabase | ✅ Sí       |
| `NEXT_PUBLIC_SUPABASE_URL`  | URL del proyecto Supabase         | ✅ Sí       |
| `RESEND_API_KEY`            | Notificaciones por email          | ❌ Opcional |
| `NOTIFICATION_EMAIL`        | Destinatario de notificaciones    | ❌ Opcional |

**Ejecutar backup manualmente:**

```bash
# Desde GitHub CLI
gh workflow run daily-backup.yml

# Localmente (requiere SUPABASE_SERVICE_ROLE_KEY en .env.local)
npm run backup
```

**Formato del nombre de archivo:**

```
cafe-mirador-backup-YYYY-MM-DD_HH-MM-SS.zip
```

**API Routes:**

- `GET /api/backups/list` - Lista backups en Supabase Storage (solo admin)
- `POST /api/backups/trigger` - Ejecuta backup via GitHub Actions (solo admin)
- `POST /api/export` - Exporta tablas seleccionadas a CSV/XLSX (solo admin)

## Convenciones de Código

### TypeScript

- Strict mode habilitado
- Tipos definidos en `types/` directory
- Interfaces importantes:
  - `types/customer-recurrence.ts` - CustomerWithRecurrence, CustomerToContact
  - `types/inventory.ts` - InventoryMovement, MovementType (sale, restock, adjustment, loss, return)
  - `types/products.ts` - Product, ProductVariant, VariantForSale
  - `types/index.ts` - DashboardStats, Sales, Products

### Componentes React

- Todos los componentes de página/features son "use client"
- Hooks de React siempre antes de returns condicionales (evitar hooks order violation)
- Usar `supabase` importado de `@/lib/supabase` (no crear clientes nuevos)

### Supabase Queries

- Usar `.select('*')` o especificar columnas
- Siempre manejar `error` en destructuring
- RPCs se llaman con `.rpc('nombre_funcion', { params })`
- Ejemplo proceso venta:

```typescript
const { data, error } = await supabase.rpc('process_coffee_sale', {
  p_customer_id: customerId,
  p_items: items,
  p_created_at: saleDate || new Date().toISOString(),
  p_payment_method: paymentMethod,
  p_customer_recurrence_days: recurrenceDays,
});
```

### Errores Comunes a Evitar

1. **React Hooks Order**: Nunca poner `useEffect`/`useState` después de returns condicionales
2. **Supabase Client**: Importar de `@/lib/supabase`, no de `@/lib/supabase/client`
3. **Columnas inexistentes**: Verificar schema antes de hacer UPDATE (ej: `updated_at` no existe en `customers`)
4. **UUIDs**: Customer "Venta Rápida" usa UUID especial: `00000000-0000-0000-0000-000000000000`
5. **Dates**: Usar `.toISOString()` para fechas antes de enviar a Supabase
6. **RLS**: Recordar que solo admins pueden editar inventario (verificar rol en client si necesario)

## Flujo de Trabajo Recomendado

### Para Nuevas Features

1. Crear worktree si es feature grande: `git worktree add .worktrees/nombre-feature`
2. Si requiere cambios DB: crear migración SQL en `supabase/migrations/`
3. Actualizar tipos TypeScript en `types/`
4. Implementar componentes/páginas
5. Escribir tests (unit + integration si aplica)
6. Verificar build: `npm run build`
7. Copiar archivos a main (si en worktree) y hacer merge
8. Push activa CI/CD

### Para Bug Fixes

1. Reproducir error localmente con `npm run dev`
2. Verificar console del navegador y terminal
3. Revisar errores de Supabase (RLS, columnas, RPCs)
4. Verificar orden de hooks en componentes React
5. Fix, test, commit con mensaje descriptivo

### Para Cambios de DB

1. Crear archivo SQL en `supabase/migrations/`
2. Ejecutar en Supabase SQL Editor (dashboard)
3. Actualizar `SUPABASE_SETUP.md` si es migración nueva
4. Actualizar tipos TypeScript correspondientes
5. Si es RPC nueva: documentar parámetros y return type

## Recursos Adicionales

- **Documentación completa**: `/docs/testing/` para guías de testing
- **Roadmap de Mejoras**: `/docs/plans/2026-01-19-roadmap-mejoras-competitivas.md`
  - Fase 1: `/docs/plans/2026-01-19-fase1-maximizar-recurrencia.md`
  - Fase 2: `/docs/plans/2026-01-19-fase2-portal-cliente-self-service.md`
  - Fase 3: `/docs/plans/2026-01-19-fase3-crecimiento.md`
- **Deploy**: `VERCEL_DEPLOYMENT.md` y `DEPLOYMENT_SUMMARY.md`
- **Migraciones**: `MIGRATION_NOTES.md` para contexto histórico
- **Demo en vivo**: https://cafe-pi-steel.vercel.app
- **Repo**: https://github.com/alvarettosky/cafe
