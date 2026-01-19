# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Sistema Café Mirador CRM

Sistema completo de gestión para cafetería: inventario, punto de venta (POS), gestión de clientes con recurrencia, y análisis de ventas. Desplegado en producción en Vercel con Supabase como backend.

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
/clientes       → Gestión de clientes con recurrencia
/contactos      → Lista de contactos por recurrencia (integración WhatsApp)
```

### Base de Datos (Supabase)

**Tablas Principales:**

- `inventory` - Productos, stock (kg/units), precios, costos
- `sales` - Ventas con customer_id, payment_method, totales, profit
- `sale_items` - Items de cada venta (producto, cantidad, precio, profit)
- `customers` - Clientes con recurrencia típica, última compra, dirección
- `customer_contacts` - Historial de contactos con clientes
- `profiles` - Roles de usuario (admin/seller) para RLS

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

Ver `SUPABASE_SETUP.md` para orden completo de ejecución.

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

- `NewSaleModal` - Crear venta (incluye recurrencia)
- `NewCustomerModal` - Crear cliente
- `CustomerModal` - Editar cliente (nombre, teléfono, email, dirección, recurrencia, última compra)
- `ProductModal` - Editar inventario (solo admins)
- `PendingUsersModal` - Aprobar/rechazar usuarios (solo admins)

**Inputs Especializados**:

- `RecurrenceInput` - Input con sugerencia AI para recurrencia
- `DateRangeSelector` - Selector de rango con presets para analytics

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

### CI/CD Pipeline

GitHub Actions:

- `.github/workflows/ci.yml` - Lint, tests, type-check, build en cada push
- `.github/workflows/e2e.yml` - Tests E2E con Playwright
- Pre-commit hook ejecuta lint-staged automáticamente

Deploy:

- Vercel conectado a repo
- Deploy automático en push a `main`
- Environment variables configuradas en Vercel dashboard

## Convenciones de Código

### TypeScript

- Strict mode habilitado
- Tipos definidos en `types/` directory
- Interfaces importantes:
  - `types/customer-recurrence.ts` - CustomerWithRecurrence, CustomerToContact
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
- **Deploy**: `VERCEL_DEPLOYMENT.md` y `DEPLOYMENT_SUMMARY.md`
- **Migraciones**: `MIGRATION_NOTES.md` para contexto histórico
- **Demo en vivo**: https://cafe-pi-steel.vercel.app
- **Repo**: https://github.com/alvarettosky/cafe
