# 📖 Instrucciones del Proyecto - Café Mirador

> **Guía completa para trabajar con el sistema de gestión de Mirador Montañero Café Selecto**

---

## 🎯 ¿Qué es este proyecto?

Sistema completo de gestión para cafetería que incluye:

- 📊 **Dashboard en tiempo real** - KPIs, inventario, ventas
- ☕ **Punto de Venta (POS)** - Registro rápido de ventas
- 👥 **CRM con IA** - Predicción de compras recurrentes por cliente
- 📞 **Sistema de contactos** - Alertas para contactar clientes
- 📈 **Analytics** - Gráficas y métricas de rendimiento

**Producción**: https://cafe-pi-steel.vercel.app

---

## 🚀 Inicio Rápido

### 1. Requisitos Previos

- **Node.js v20+** (el proyecto incluye entorno virtual)
- **Cuenta Supabase** con proyecto configurado
- **Git** instalado

### 2. Configuración Inicial

```bash
# 1. Clonar repositorio
git clone https://github.com/alvarettosky/cafe.git
cd cafe

# 2. Activar entorno Node.js (IMPORTANTE - hacer en cada terminal)
source setup_env.sh
export PATH=$(pwd)/.node_env/bin:$PATH

# 3. Instalar dependencias
npm install

# 4. Configurar variables de entorno
# Crear archivo .env.local en la raíz con:
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anon-publica

# 5. Configurar base de datos
# Seguir pasos en SUPABASE_SETUP.md para ejecutar migraciones

# 6. Iniciar servidor de desarrollo
npm run dev
# Abrir http://localhost:3000
```

---

## 📋 Comandos Principales

### Desarrollo

```bash
npm run dev              # Servidor desarrollo (localhost:3000)
npm run build            # Build de producción
npm start                # Servidor producción local
```

### Testing

```bash
# Tests Básicos
npm test                 # Todos los tests
npm run test:coverage    # Con reporte de cobertura
npm run test:watch       # Modo watch (desarrollo)
npm run test:ui          # Interfaz UI interactiva

# Tests E2E
npx playwright test      # E2E en todos los navegadores
npx playwright test --ui # Modo UI interactivo
```

### Calidad de Código

```bash
npm run lint             # ESLint (detectar problemas)
npm run format           # Prettier (formatear código)
npm run format:check     # Verificar formato
```

### Git

```bash
git add .
git commit -m "mensaje"  # Pre-commit hook automático se ejecuta
git push origin main     # Deploy automático en Vercel
```

---

## 🏗️ Arquitectura del Sistema

### Stack Tecnológico

**Frontend**

- Next.js 16 (App Router)
- TypeScript 5
- TailwindCSS 4
- Radix UI + Lucide Icons
- Framer Motion (animaciones)
- Recharts (gráficas)

**Backend**

- Supabase (PostgreSQL)
  - Row Level Security (RLS)
  - Funciones RPC
  - Autenticación
  - Real-time

**Testing**

- Vitest (unit/integration)
- Playwright (E2E)
- Testing Library
- MSW (API mocking)

**Deploy**

- Vercel (CI/CD automático)
- GitHub Actions

### Estructura de Carpetas

```
cafe-mirador/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Dashboard principal
│   ├── login/                    # Autenticación
│   ├── analytics/                # Analytics y métricas
│   ├── clientes/                 # Gestión de clientes
│   ├── contactos/                # Lista de contacto
│   └── ventas/nueva/             # Formulario de venta
│
├── components/                   # Componentes React
│   ├── __tests__/                # Tests de componentes
│   ├── ui/                       # Componentes base (Radix)
│   ├── customer-modal.tsx        # Modal edición cliente
│   ├── recurrence-input.tsx      # Input recurrencia con IA
│   └── new-sale-modal.tsx        # Modal nueva venta
│
├── lib/
│   └── supabase.ts              # Cliente Supabase (importar de aquí)
│
├── types/                        # TypeScript types
│   ├── index.ts                  # Types generales
│   └── customer-recurrence.ts    # Types de recurrencia
│
├── supabase/
│   ├── migrations/               # Migraciones SQL (orden numérico)
│   └── seed.sql                  # Datos de prueba
│
├── docs/                         # Documentación
│   ├── testing/                  # Guías de testing
│   └── plans/                    # Planes de diseño
│
├── .claude/
│   ├── TODO.md                   # Lista de tareas
│   └── settings.local.json       # Config Claude Code
│
├── INSTRUCCIONES.md              # Este archivo
├── CLAUDE.md                     # Guía técnica para IA
├── README.md                     # Presentación del proyecto
├── CHANGELOG.md                  # Historial de cambios
└── package.json
```

---

## 🗄️ Base de Datos (Supabase)

### Tablas Principales

| Tabla        | Descripción              | Campos Clave                                                                                     |
| ------------ | ------------------------ | ------------------------------------------------------------------------------------------------ |
| `customers`  | Clientes con recurrencia | `id`, `full_name`, `phone`, `email`, `address`, `typical_recurrence_days`, `last_purchase_date`  |
| `sales`      | Ventas registradas       | `id`, `customer_id`, `total_amount`, `payment_method`, `created_at`, `profit`                    |
| `sale_items` | Items de cada venta      | `sale_id`, `product_id`, `quantity`, `unit_price`, `profit`                                      |
| `inventory`  | Productos e inventario   | `product_id`, `product_name`, `stock_kg`, `stock_units`, `price_per_unit`, `min_stock_threshold` |
| `profiles`   | Roles de usuario (RLS)   | `id`, `role` (`admin` o `seller`)                                                                |

### Funciones RPC Principales

#### Ventas

```typescript
// Procesar venta completa
await supabase.rpc('process_coffee_sale', {
  p_customer_id: UUID,
  p_items: Array<{product_id, unit, quantity, price}>,
  p_created_at: ISO_DATE,           // opcional
  p_payment_method: string,
  p_customer_recurrence_days: number // opcional
});

// Editar venta (solo < 24h)
await supabase.rpc('edit_sale', {
  p_sale_id: UUID,
  p_customer_id: UUID,
  p_payment_method: string,
  p_items: Array<{...}>
});

// Verificar si venta es editable
await supabase.rpc('can_edit_sale', { p_sale_id: UUID });
```

#### Recurrencia de Clientes

```typescript
// Calcular recurrencia (promedio últimas 3 compras)
await supabase.rpc('calculate_customer_recurrence', {
  p_customer_id: UUID,
}); // Retorna: number | null

// Actualizar recurrencia manualmente
await supabase.rpc('update_customer_recurrence', {
  p_customer_id: UUID,
  p_recurrence_days: number,
});

// Obtener clientes para contactar
await supabase.rpc('get_customers_to_contact', {
  p_urgency_threshold_days: 7, // días de umbral
});
```

#### Dashboard

```typescript
// KPIs del dashboard
await supabase.rpc('get_dashboard_stats');
// Retorna: { total_inventory_grams, sales_today, roasted_coffee_grams, low_stock_items }

// Analytics por período
await supabase.rpc('get_advanced_metrics', {
  p_start_date: ISO_DATE,
  p_end_date: ISO_DATE,
});

// Series de tiempo
await supabase.rpc('get_time_series_data', {
  p_start_date: ISO_DATE,
  p_end_date: ISO_DATE,
  p_interval: 'day' | 'week' | 'month',
});
```

### Seguridad (RLS)

- **Lectura**: Todos los usuarios autenticados
- **Escritura**:
  - Ventas y clientes: Todos
  - Inventario: Solo `admin`
- **Rol**: Se define en `profiles.role`

---

## 🤖 Sistema de Recurrencia Inteligente

### ¿Cómo Funciona?

1. **Registro de Compras**: Cada venta actualiza `customers.last_purchase_date`

2. **Cálculo Automático**: Con ≥3 compras, el sistema calcula:

   ```
   recurrencia = promedio(días entre últimas 3 compras)
   ```

3. **Sugerencia al Vender**: Si cliente no tiene recurrencia, sistema sugiere valor calculado

4. **Lista de Contacto**: Página `/contactos` muestra clientes que deben ser contactados:

   ```
   días_hasta_esperado = typical_recurrence_days - días_desde_última_compra

   Urgencia:
   - Alta: ≤ -7 días (muy atrasado)
   - Media: ≤ 0 días (ya debió comprar)
   - Baja: ≤ 3 días (pronto)
   ```

### Componentes Clave

- `RecurrenceInput` - Input con sugerencia IA
- `CustomerModal` - Editar recurrencia de cliente
- `/clientes` - Ver todos los clientes con estado
- `/contactos` - Lista priorizada para contactar

### Ejemplo de Uso

```typescript
// En nueva venta, obtener sugerencia
const { data: suggestedDays } = await supabase.rpc(
  'calculate_customer_recurrence',
  { p_customer_id: customerId }
);

// Mostrar en RecurrenceInput
<RecurrenceInput
  value={customerRecurrence}
  onChange={setCustomerRecurrence}
  suggestedValue={suggestedDays}
  showSuggestion={true}
/>

// Al guardar venta, incluir recurrencia
await supabase.rpc('process_coffee_sale', {
  // ... otros parámetros
  p_customer_recurrence_days: customerRecurrence
});
```

---

## 📱 Páginas y Funcionalidades

### `/` - Dashboard Principal

- KPIs en tiempo real (inventario, ventas hoy, alertas)
- Lista de inventario con edición/eliminación
- Ventas recientes con info del cliente
- Botones de navegación rápida

### `/ventas/nueva` - Formulario de Venta

- Selección de cliente existente o crear nuevo
- Sugerencia de recurrencia para nuevos clientes
- Selección de producto, cantidad (libra/media libra)
- Precio editable por unidad
- Múltiples métodos de pago
- Fecha opcional (default: ahora)

### `/clientes` - Gestión de Clientes

- Búsqueda por nombre, teléfono, email
- Estadísticas: total, con recurrencia, activos
- Edición completa de cliente (modal)
- Campos: nombre, teléfono, email, dirección, recurrencia

### `/contactos` - Lista de Contacto

- Clasificación por urgencia (Urgente, Pronto, Planificado, Sin datos)
- Información de última compra y recurrencia
- Integración WhatsApp (mensaje pre-generado)
- Umbral de urgencia configurable (3, 7, 14, 30 días)

### `/analytics` - Analytics y Métricas

- Selector de rango de fechas (presets: hoy, semana, mes, trimestre, año)
- Gráficas de ventas por tiempo
- Top productos
- Métricas de profit/margen
- Análisis de métodos de pago

### `/login` - Autenticación

- Email + contraseña
- Supabase Auth
- Redirección a dashboard

---

## ⚠️ Errores Comunes y Soluciones

### 1. React Hooks Order Violation

❌ **Incorrecto**:

```typescript
if (!user) return null;  // Early return
useEffect(() => {...});   // Hook después de return
```

✅ **Correcto**:

```typescript
useEffect(() => {...});   // Hooks primero
if (!user) return null;   // Returns después
```

### 2. Cliente Supabase Incorrecto

❌ **Incorrecto**:

```typescript
import { supabase } from '@/lib/supabase/client';
```

✅ **Correcto**:

```typescript
import { supabase } from '@/lib/supabase';
```

### 3. UUID del Cliente "Venta Rápida"

UUID especial para ventas anónimas:

```typescript
const GUEST_CUSTOMER_ID = '00000000-0000-0000-0000-000000000000';
```

### 4. Fechas en Supabase

Siempre usar `.toISOString()`:

```typescript
const date = new Date().toISOString();
await supabase.rpc('process_coffee_sale', {
  p_created_at: date, // ✅ ISO format
});
```

### 5. Columnas Inexistentes

Antes de UPDATE, verificar que columna existe:

```typescript
// ❌ 'updated_at' no existe en 'customers'
await supabase.from('customers').update({ updated_at: new Date() });

// ✅ Solo campos existentes
await supabase.from('customers').update({ last_purchase_date: new Date().toISOString() });
```

### 6. RLS - Permisos Insuficientes

Solo admins pueden editar inventario:

```typescript
// En cliente, verificar rol si necesario
const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

if (profile.role !== 'admin') {
  // No mostrar botón editar inventario
}
```

---

## 🔄 Flujo de Trabajo

### Para Nueva Funcionalidad

1. **Planificar**
   - ¿Requiere cambios en DB? → Crear migración SQL
   - ¿Requiere nuevos tipos? → Actualizar `types/`
   - ¿Es grande? → Considerar worktree

2. **Implementar**

   ```bash
   # Si usas worktree
   git worktree add .worktrees/nombre-feature nombre-branch
   cd .worktrees/nombre-feature
   npm install

   # Desarrollo normal
   npm run dev
   ```

3. **Testing**
   - Escribir tests (unit + integration)
   - Ejecutar `npm test`
   - Verificar `npm run build`

4. **Commit & Deploy**
   ```bash
   git add .
   git commit -m "feat: descripción del cambio"  # Pre-commit hook se ejecuta
   git push origin main  # Deploy automático en Vercel
   ```

### Para Bug Fix

1. **Reproducir** el error en `npm run dev`
2. **Verificar**:
   - Console del navegador (F12)
   - Terminal de Next.js
   - Errores de Supabase (RLS, RPCs)
   - Orden de hooks en componentes
3. **Fix** → Test → Commit
   ```bash
   git commit -m "fix: descripción del bug corregido"
   ```

### Para Cambios de Base de Datos

1. Crear archivo SQL en `supabase/migrations/XXX_nombre.sql`
2. Ejecutar en Supabase SQL Editor (dashboard)
3. Actualizar `SUPABASE_SETUP.md`
4. Actualizar tipos TypeScript si cambiaron tablas
5. Documentar RPCs nuevas con parámetros y returns

---

## 🧪 Testing

### Cobertura Objetivo

- **Lines**: 80%+
- **Functions**: 80%+
- **Branches**: 80%+
- **Statements**: 80%+

### Estrategia

1. **Unit Tests** (Vitest)
   - Componentes individuales
   - Funciones utilitarias
   - Mocking de Supabase con MSW

2. **Integration Tests** (Vitest)
   - Flujos multi-componente
   - Interacciones con API

3. **E2E Tests** (Playwright)
   - Flujos completos de usuario
   - Ventas, analytics, inventario

### Ejemplo de Test

```typescript
// components/__tests__/customer-modal.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CustomerModal } from '../customer-modal';
import { supabase } from '@/lib/supabase';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: mockCustomer,
            error: null
          }))
        }))
      }))
    })),
    rpc: vi.fn(() => Promise.resolve({ data: 7, error: null }))
  }
}));

describe('CustomerModal', () => {
  it('should display customer information', async () => {
    render(
      <CustomerModal
        isOpen={true}
        onClose={vi.fn()}
        customerId="123"
        onCustomerUpdated={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Juan Pérez')).toBeInTheDocument();
    });
  });
});
```

---

## 🚀 Deploy a Producción

### Vercel (Automático)

1. **Conectar Repositorio**
   - Importar desde GitHub en Vercel dashboard
   - Vercel detecta Next.js automáticamente

2. **Variables de Entorno**
   - En Vercel Dashboard → Settings → Environment Variables
   - Agregar:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. **Deploy**
   - Push a `main` → Deploy automático
   - Preview deployments en PRs

### Rollback

Si hay error en producción:

```bash
# En Vercel Dashboard → Deployments
# Click en deployment anterior → "Promote to Production"
```

---

## 📚 Recursos Adicionales

### Documentación del Proyecto

- `CLAUDE.md` - Guía técnica completa
- `README.md` - Overview y quick start
- `CHANGELOG.md` - Historial de cambios
- `.claude/TODO.md` - Estado del proyecto y tareas
- `docs/testing/` - Guías de testing detalladas

### Configuración

- `SUPABASE_SETUP.md` - Setup completo de base de datos
- `VERCEL_DEPLOYMENT.md` - Guía de deployment
- `MIGRATION_NOTES.md` - Notas de migraciones

### Enlaces

- **Producción**: https://cafe-pi-steel.vercel.app
- **Repositorio**: https://github.com/alvarettosky/cafe
- **Supabase**: https://supabase.com/dashboard

---

## 🆘 Ayuda y Soporte

### Problemas Comunes

**"Module not found"**

```bash
rm -rf node_modules package-lock.json
npm install
```

**"Supabase client error"**

- Verificar `.env.local` existe y tiene las variables correctas
- Verificar que importas de `@/lib/supabase`

**"RLS policy violation"**

- Verificar que usuario está autenticado
- Verificar rol en `profiles` table
- Solo admins pueden editar inventario

**Tests fallando en pre-commit**

```bash
# Ejecutar tests manualmente
npm test

# Si es urgente, saltarse hook (NO RECOMENDADO)
git commit --no-verify -m "mensaje"
```

### Contacto

Para bugs o sugerencias:

1. Crear issue en GitHub
2. Incluir screenshots si aplica
3. Describir pasos para reproducir

---

**Última actualización**: 2026-01-18

**Desarrollado con ❤️ para Mirador Montañero Café Selecto**
