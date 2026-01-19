# Café Mirador - Sistema de Gestión Integral

[![Deploy](https://img.shields.io/badge/deploy-vercel-black)](https://cafe-pi-steel.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com)

Sistema completo de gestión para **Mirador Montañero Café Selecto** que incluye:

- 📊 **Dashboard en tiempo real** con KPIs y métricas
- ☕ **Punto de Venta (POS)** con gestión de productos e inventario
- 👥 **CRM con recurrencia inteligente** - Predicción de compras con IA
- 📞 **Sistema de contactos** - Alertas automáticas para clientes recurrentes
- 📈 **Analytics** - Gráficas de ventas, inventario y tendencias
- 🔐 **Sistema de aprobación de usuarios** - Control de acceso por admin

## 🚀 Demo en Vivo

**URL de Producción:** https://cafe-pi-steel.vercel.app

La aplicación está desplegada en Vercel con actualizaciones automáticas en cada push a la rama `main`.

## ✨ Características Destacadas

### 🤖 Sistema de Recurrencia Inteligente

- Predicción automática de patrones de compra por cliente usando IA
- Cálculo de recurrencia típica basado en historial de ventas
- Sugerencias inteligentes al registrar nuevos clientes
- Alertas para clientes que deben ser contactados

### 👥 Gestión Avanzada de Clientes

- **Lista de Clientes** (`/clientes`) - Búsqueda, filtrado y edición completa
- **Lista de Contacto** (`/contactos`) - Clasificación por urgencia (Urgente, Pronto, Planificado)
- Campos completos: nombre, teléfono, email, dirección, recurrencia
- Visualización de última compra y recurrencia típica

### ☕ Punto de Venta Optimizado

- Formulario de venta en **página completa** (`/ventas/nueva`) para mejor experiencia
- Selección rápida de productos y clientes
- Registro de nuevos clientes en el mismo flujo
- Cálculo automático de precios por unidad (libra/media libra)
- Múltiples métodos de pago (Efectivo, Transferencias, Nequi, DaviPlata)

### 🔐 Sistema de Aprobación de Usuarios

- Nuevos usuarios quedan **pendientes** hasta aprobación del admin
- Página de espera (`/pendiente`) para usuarios no aprobados
- Badge en dashboard muestra usuarios pendientes (solo admin)
- Modal de aprobación/rechazo con un click
- RLS actualizado para bloquear acceso a datos sin aprobación

### 📊 Dashboard en Tiempo Real

- KPIs: Total inventario, ventas del día, café tostado, alertas de stock
- Inventario en tiempo real con edición y eliminación
- Ventas recientes con información del cliente
- Navegación rápida a Analytics, Clientes, Contactos
- Badge de usuarios pendientes para administradores

### 📈 Analytics Avanzado

- Gráficas de ventas por período
- Análisis de inventario
- Métricas de rendimiento
- Filtros por rango de fechas

## 🛠 Tecnologías

### Frontend

- **Next.js 16** - Framework React con App Router
- **TypeScript 5** - Type safety
- **TailwindCSS 4** - Utility-first CSS
- **Framer Motion** - Animaciones
- **Radix UI** - Componentes accesibles
- **Recharts** - Gráficas y visualizaciones

### Backend

- **Supabase** - Backend as a Service
  - PostgreSQL con RLS (Row Level Security)
  - Funciones RPC para lógica compleja
  - Autenticación integrada
  - Real-time subscriptions

### Testing

- **Vitest** - Unit & Integration tests
- **Playwright** - E2E tests
- **Testing Library** - Component testing
- **MSW** - API mocking
- **Coverage**: 72% (216 tests pasando)

## Requisitos previos

1. **Node.js**: v20+ (o usar `./setup_env.sh`).
2. **Supabase**: Proyecto configurado (ver `SUPABASE_SETUP.md`).

## Cómo ejecutar localmente (Desarrollo)

1. **Activar Entorno Virtual (IMPORTANTE)**:
   Este proyecto usa una versión específica de Node.js. Ejecuta este comando en cada nueva terminal:

   ```bash
   source setup_env.sh # O añade export PATH=$(pwd)/.node_env/bin:$PATH manualmente
   export PATH=$(pwd)/.node_env/bin:$PATH
   ```

2. **Configurar variables**:
   Asegúrate de tener el archivo `.env.local` en la raíz del proyecto con tus credenciales de Supabase.

3. **Instalar dependencias**:

   ```bash
   npm install
   ```

4. **Iniciar servidor**:

   ```bash
   npm run dev
   ```

5. **Ver en navegador**:
   Abre [http://localhost:3000](http://localhost:3000).

6. **Ejecutar Pruebas**:

   ```bash
   # Unit & Integration Tests
   npm test                    # Ejecutar todos los tests
   npm run test:coverage       # Ver reporte de cobertura
   npm run test:watch          # Modo watch
   npm run test:ui             # Interfaz UI

   # E2E Tests
   npx playwright test         # Tests E2E en todos los navegadores
   npx playwright test --ui    # Modo UI interactivo

   # Advanced Testing
   npm run test:mutation       # Mutation testing (Stryker)
   npm run test:db             # Database integration tests
   npm run test:load           # Load testing (k6)
   ```

## Cómo desplegar en Producción (Vercel)

Este proyecto está optimizado para **Vercel**.

1. Sube este código a un repositorio GitHub.
2. Inicia sesión en [Vercel](https://vercel.com) e importa el proyecto.
3. En la configuración de "Environment Variables", añade:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Despliega.

## Testing

### Coverage Goals

- **Lines**: 80%+
- **Functions**: 80%+
- **Branches**: 80%+
- **Statements**: 80%+

### Testing Strategy

- **Unit Tests**: Component and utility function testing (Vitest + Testing Library)
- **Integration Tests**: Multi-component interactions with API mocking (MSW)
- **E2E Tests**: Full user flows - sales, analytics, inventory (Playwright)
- **Load Tests**: Performance under stress (k6)
- **Mutation Tests**: Test quality verification (Stryker)
- **Database Tests**: RPC functions and data integrity (Vitest + Supabase)

### CI/CD Pipeline

- **Pre-commit**: Lint, format, type-check, related tests (Husky + lint-staged)
- **On Push**: Full CI pipeline (lint, tests, type-check, build)
- **On PR**: Coverage reports and comments
- **Nightly**: Mutation and load tests

Ver documentación completa en `/docs/testing/`

## 📚 Documentación

### Documentos Principales

- **[CLAUDE.md](CLAUDE.md)** - Guía completa del proyecto para IA y desarrolladores
  - Comandos esenciales
  - Arquitectura del sistema
  - Esquema de base de datos
  - Sistema de recurrencia
  - Errores comunes
  - Workflow recomendado

- **[.claude/TODO.md](.claude/TODO.md)** - Lista de tareas y estado del proyecto
  - ✅ Funcionalidades completadas
  - 🔄 Tareas en progreso
  - 📋 Funcionalidades pendientes
  - 🐛 Bugs conocidos

### Deployment y Configuración

- **[VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md)** - Guía de deployment en Vercel
- **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)** - Configuración de Supabase
- **[MIGRATION_NOTES.md](MIGRATION_NOTES.md)** - Notas de migración

### Testing

- **[docs/testing/TESTING_GUIDE.md](docs/testing/TESTING_GUIDE.md)** - Guía completa de testing
- **[docs/testing/CI_CD.md](docs/testing/CI_CD.md)** - Pipeline CI/CD
- **[docs/testing/WRITING_TESTS.md](docs/testing/WRITING_TESTS.md)** - Cómo escribir tests

### Planes de Diseño

- **[docs/plans/](docs/plans/)** - Diseños y arquitectura de features
  - Customer Recurrence and Sales Editing
  - Advanced Metrics Dashboard
  - Testing Ecosystem

## 📂 Estructura del Proyecto

```
cafe-mirador/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Dashboard principal
│   ├── analytics/                # Página de analytics
│   ├── clientes/                 # Gestión de clientes
│   ├── contactos/                # Lista de contacto
│   ├── login/                    # Autenticación
│   ├── pendiente/                # Página de espera (usuarios no aprobados)
│   └── ventas/nueva/             # Formulario de nueva venta
├── components/                   # Componentes React
│   ├── __tests__/                # Tests de componentes
│   ├── ui/                       # Componentes base (shadcn/ui)
│   ├── customer-modal.tsx        # Modal de cliente con recurrencia
│   ├── recurrence-input.tsx      # Input de recurrencia con IA
│   ├── pending-users-modal.tsx   # Modal de aprobación de usuarios
│   └── date-range-selector.tsx   # Selector de rangos de fecha
├── lib/                          # Utilidades
│   └── supabase.ts              # Cliente Supabase
├── types/                        # TypeScript types
│   └── customer-recurrence.ts    # Tipos de recurrencia
├── supabase/                     # Base de datos
│   ├── migrations/               # Migraciones SQL
│   └── seed.sql                  # Datos de prueba
├── docs/                         # Documentación
│   ├── testing/                  # Guías de testing
│   └── plans/                    # Planes de diseño
├── .claude/                      # Configuración Claude Code
│   ├── TODO.md                   # Lista de tareas
│   └── settings.local.json       # Configuración local
├── CLAUDE.md                     # Guía para IA
└── README.md                     # Este archivo
```

## 🗄️ Base de Datos (Supabase)

### Tablas Principales

- **`customers`** - Clientes con recurrencia y dirección
- **`sales`** - Ventas registradas con detalles
- **`inventory`** - Productos e inventario en tiempo real
- **`sale_items`** - Items individuales de cada venta

### Funciones RPC

- **`calculate_customer_recurrence(customer_id)`** - Calcula recurrencia basada en historial
- **`update_customer_recurrence(customer_id, days)`** - Actualiza recurrencia de cliente
- **`process_coffee_sale(...)`** - Procesa venta completa con transacción
- **`get_dashboard_stats()`** - Obtiene KPIs del dashboard
- **`get_customers_to_contact(urgency_days)`** - Lista clientes para contactar
- **`get_pending_users()`** - Lista usuarios pendientes de aprobación (solo admin)
- **`approve_user(user_id)`** - Aprueba un usuario (solo admin)
- **`reject_user(user_id)`** - Rechaza/elimina un usuario (solo admin)

Ver `CLAUDE.md` para esquema completo de la base de datos.

## 🚀 Roadmap

### En Desarrollo

- [ ] Notificaciones push para clientes recurrentes
- [ ] Integración con WhatsApp Business API
- [ ] Exportar listas de contactos a CSV/Excel
- [ ] Dashboard de métricas de recurrencia
- [ ] PWA (Progressive Web App)

### Futuro

- [ ] Sistema de recordatorios automáticos
- [ ] Gráficas de predicción de ventas
- [ ] Multi-tienda / Multi-usuario
- [ ] Reportes avanzados en PDF
- [ ] Integración con facturación electrónica

Ver [.claude/TODO.md](.claude/TODO.md) para lista completa de tareas.

## 🤝 Contribución

Este es un proyecto privado para **Mirador Montañero Café Selecto**. Si tienes sugerencias o encuentras bugs:

1. Crea un issue en GitHub
2. Describe el problema o feature request
3. Incluye screenshots si aplica

## 📄 Licencia

MIT License - Ver [LICENSE](LICENSE) para más detalles.

---

**Desarrollado con ❤️ para Mirador Montañero**

**Stack:** Next.js 16 + TypeScript + Supabase + TailwindCSS
**Deployment:** Vercel
**Última actualización:** 2026-01-19
