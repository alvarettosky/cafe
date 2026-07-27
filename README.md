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
- 🌐 **Portal de Cliente Self-Service** - Clientes pueden ver pedidos y repetir compras
- 🎁 **Sistema de Referidos** - Programa de referidos con códigos y recompensas
- 💰 **Listas de Precios Diferenciadas** - Precios especiales por tipo de cliente
- 🚚 **Zonas de Entrega** - Organización de entregas por zona geográfica
- 📋 **Kardex de Inventario** - Trazabilidad completa de movimientos de stock
- 🏷️ **Productos con Variantes** - SKUs, presentaciones y tipos de molido
- 💾 **Sistema de Backups** - Exportación CSV/XLSX y backups automáticos a Supabase Storage

## 🚀 Demo en Vivo

**URL de Producción:** https://cafe-pi-steel.vercel.app

La aplicación está desplegada en Vercel con actualizaciones automáticas en cada push a la rama `main`.

> ⚠️ **No hay entorno de staging.** Un push a `main` va directo a producción.

## 📚 Documentación

| Documento                                | Qué responde                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md) | **Por qué** el sistema es así: decisiones de arquitectura y los contratos que TypeScript no protege |
| [`docs/ROADMAP.md`](docs/ROADMAP.md)     | **Qué** se entregó, el estado medido y el siguiente paso vigente                                    |
| [`docs/BACKLOG.md`](docs/BACKLOG.md)     | Pendientes clasificados. **§D lista lo ya cerrado con su motivo**                                   |
| [`docs/SYLLABUS.md`](docs/SYLLABUS.md)   | Ruta de lectura en 8 módulos para entrar al proyecto                                                |
| [`CLAUDE.md`](CLAUDE.md)                 | Referencia operativa: comandos, esquema de datos, convenciones                                      |
| [`FICHA_TECNICA.md`](FICHA_TECNICA.md)   | Cuentas, stack y métricas                                                                           |
| [`INSTRUCCIONES.md`](INSTRUCCIONES.md)   | Guía de inicio rápido                                                                               |
| [`docs/testing/`](docs/testing/)         | Guías de testing y CI/CD                                                                            |

## ✨ Características Destacadas

### 🤖 Sistema de Recurrencia Inteligente

- Predicción automática de patrones de compra por cliente usando IA
- Cálculo de recurrencia típica basado en historial de ventas
- Sugerencias inteligentes al registrar nuevos clientes
- Alertas para clientes que deben ser contactados

### 👥 Gestión Avanzada de Clientes

- **Lista de Clientes** (`/clientes`) - Búsqueda, filtrado por segmento y edición completa
- **Segmentación RFM automática** - Champion, Leal, Potencial, Nuevo, En Riesgo, Perdido, Prospecto
- **Lista de Contacto** (`/contactos`) - Clasificación por urgencia (Urgente, Pronto, Planificado)
- **Sección Prospectos** - Clientes potenciales que nunca han comprado
- **Repetir Pedido** - Un click para reordenar la última compra de un cliente
- **WhatsApp Inteligente** - Mensajes contextuales automáticos según estado del cliente
- Campos completos: nombre, teléfono, email, dirección, recurrencia
- Visualización de última compra y recurrencia típica
- Navegación con botón Home desde todas las páginas secundarias

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

### 🌐 Portal de Cliente Self-Service

- **Magic Links** - Acceso sin contraseña vía email/WhatsApp
- **Dashboard del Cliente** - Vista de pedidos, suscripción y referidos
- **Historial de Pedidos** - Consulta de compras anteriores
- **Repetir Pedido** - Un click para reordenar
- **Suscripciones** - Configurar café automático cada X días
- **Programa de Referidos** - Generar código, compartir y ver recompensas
- **Perfil** - Editar datos personales y preferencias

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

### 💾 Sistema de Backups y Exportación

- **Exportación Manual** - CSV y Excel con selección de tablas
- **Backups Automáticos** - Diarios a Supabase Storage (2:00 AM UTC)
- **Política de Retención** - 7 días diarios, 4 semanas, 12 meses
- **Notificaciones** - Email via Resend al completar backup (opcional)
- **Historial** - Ver y descargar backups desde la UI

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
- **Coverage**: 93%+ (854 unit tests + 7 E2E tests pasando)

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
  - **Roadmap de Mejoras Competitivas** - Plan maestro en 3 fases
  - Fase 1: Maximizar Sistema de Recurrencia
  - Fase 2: Portal Cliente Self-Service
  - Fase 3: Crecimiento y Escalabilidad
  - Customer Recurrence and Sales Editing
  - Advanced Metrics Dashboard

## 📂 Estructura del Proyecto

```
cafe-mirador/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Dashboard principal
│   ├── analytics/                # Página de analytics
│   ├── clientes/                 # Gestión de clientes
│   ├── contactos/                # Lista de contacto
│   ├── login/                    # Autenticación staff
│   ├── pendiente/                # Página de espera (usuarios no aprobados)
│   ├── ventas/nueva/             # Formulario de nueva venta
│   ├── precios/                  # Gestión de listas de precios (admin)
│   ├── backups/                  # Exportación y backups (admin)
│   └── portal/                   # Portal de Cliente Self-Service
│       ├── page.tsx              # Dashboard del cliente
│       ├── auth/                 # Magic links (sin contraseña)
│       ├── pedidos/              # Historial de pedidos
│       ├── nuevo-pedido/         # Crear nuevo pedido
│       ├── perfil/               # Perfil del cliente
│       ├── suscripcion/          # Gestión de suscripción
│       └── referidos/            # Programa de referidos
├── components/                   # Componentes React
│   ├── __tests__/                # Tests de componentes
│   ├── ui/                       # Componentes base (shadcn/ui)
│   ├── charts/                   # Gráficas (Recharts)
│   ├── customer-modal.tsx        # Modal de cliente con recurrencia
│   ├── recurrence-input.tsx      # Input de recurrencia con IA
│   ├── pending-users-modal.tsx   # Modal de aprobación de usuarios
│   ├── date-range-selector.tsx   # Selector de rangos de fecha
│   ├── repeat-sale-button.tsx    # Botón para repetir última compra
│   ├── smart-whatsapp-button.tsx # WhatsApp con mensaje contextual
│   └── customer-segment-badge.tsx # Badge de segmentación RFM
├── lib/                          # Utilidades
│   └── supabase.ts              # Cliente Supabase
├── types/                        # TypeScript types
│   ├── index.ts                  # Tipos principales
│   ├── analytics.ts              # Tipos de analytics
│   └── customer-recurrence.ts    # Tipos de recurrencia
├── supabase/                     # Base de datos
│   ├── migrations/               # Migraciones SQL
│   └── seed.sql                  # Datos de prueba
├── docs/                         # Documentación
│   ├── testing/                  # Guías de testing
│   └── plans/                    # Planes de diseño
├── tests/                        # Tests adicionales
│   └── database/                 # Tests de integración DB
├── e2e/                          # Tests E2E (Playwright)
├── .claude/                      # Configuración Claude Code
├── CLAUDE.md                     # Guía para IA
└── README.md                     # Este archivo
```

## 🗄️ Base de Datos (Supabase)

### Tablas Principales

- **`customers`** - Clientes con recurrencia, tipo y zona de entrega
- **`sales`** - Ventas registradas con detalles
- **`inventory`** - Productos e inventario en tiempo real
- **`sale_items`** - Items individuales de cada venta
- **`customer_tokens`** - Magic links para portal de clientes
- **`subscriptions`** - Suscripciones de café recurrente
- **`referrals`** - Programa de referidos
- **`referral_program_config`** - Configuración del programa de referidos
- **`price_lists`** - Listas de precios diferenciadas
- **`price_list_items`** - Precios por producto en cada lista
- **`delivery_zones`** - Zonas de entrega
- **`deliveries`** - Entregas programadas
- **`delivery_items`** - Items de cada entrega
- **`inventory_movements`** - Kardex de movimientos de inventario
- **`products`** - Catálogo de productos padre
- **`product_variants`** - Variantes vendibles (SKU, presentación, molido)

### Funciones RPC

**Core:**

- **`process_coffee_sale(...)`** - Procesa venta completa con transacción
- **`get_dashboard_stats()`** - Obtiene KPIs del dashboard
- **`calculate_customer_recurrence(customer_id)`** - Calcula recurrencia basada en historial

**Clientes y Recurrencia:**

- **`get_customers_to_contact(urgency_days)`** - Lista clientes para contactar
- **`get_last_sale_for_repeat(customer_id)`** - Obtiene última venta para repetir pedido
- **`generate_whatsapp_message(customer_id, template_key)`** - Genera mensaje WhatsApp contextual
- **`get_customer_whatsapp_template(customer_id)`** - Determina template según estado del cliente
- **`get_customer_segment_stats()`** - Estadísticas de segmentación de clientes

**Portal de Clientes:**

- **`create_customer_token(customer_id)`** - Genera magic link para acceso
- **`verify_customer_token(token)`** - Valida token de acceso
- **`get_customer_portal_data(customer_id)`** - Datos del portal del cliente
- **`create_subscription(customer_id, product_id, frequency_days)`** - Crea suscripción

**Referidos:**

- **`generate_referral_code(customer_id)`** - Genera código de referido único
- **`apply_referral_code(code, phone, email)`** - Aplica código de referido
- **`complete_referral_on_purchase(customer_id, sale_id)`** - Completa referido al comprar

**Precios:**

- **`get_product_price_for_customer(product_id, customer_id)`** - Precio según tipo de cliente

**Entregas:**

- **`get_deliveries_for_date(date)`** - Entregas del día agrupadas por zona
- **`get_customers_without_zone()`** - Clientes sin zona asignada

**Inventario (Kardex):**

- **`get_inventory_movements(product_id, ...)`** - Historial de movimientos de un producto
- **`add_inventory_movement(...)`** - Registra movimiento manual (reposición, merma, ajuste)

**Admin:**

- **`get_pending_users()`** - Lista usuarios pendientes de aprobación
- **`approve_user(user_id)`** - Aprueba un usuario
- **`reject_user(user_id)`** - Rechaza/elimina un usuario

### Vistas

- **`customer_segments`** - Segmentación RFM automática de clientes

Ver `CLAUDE.md` para esquema completo de la base de datos.

## 🚀 Roadmap

### ✅ Fase 1 - Maximizar Recurrencia (Completado)

- [x] Repetir última compra con un click
- [x] WhatsApp inteligente con mensajes contextuales
- [x] Segmentación RFM automática de clientes
- [x] Templates de WhatsApp personalizables
- [x] Filtrado por segmento en lista de clientes

### ✅ Fase 2 - Portal de Auto-servicio (Completado)

- [x] Magic links para clientes (sin contraseña)
- [x] Portal de cliente para ver historial y repetir pedidos
- [x] Sistema de suscripciones (café cada X días)
- [x] Perfil de cliente editable
- [x] Nuevo pedido desde portal

### ✅ Fase 3 - Crecimiento y Escalabilidad (Completado)

- [x] Sistema de referidos (cliente trae cliente)
- [x] Códigos de referido con recompensas configurables
- [x] Listas de precios diferenciadas por tipo de cliente
- [x] Zonas de entrega con días asignados
- [x] Gestión de entregas agrupadas por zona

### ✅ Fase 4 - Arquitectura POS Profesional (Completado)

- [x] Kardex de inventario con trazabilidad completa
- [x] Productos con variantes (SKU, presentación, tipo de molido)
- [x] Página de gestión de listas de precios (/precios)
- [x] Movimientos automáticos al procesar ventas
- [x] Historial de movimientos por producto

### ✅ Fase 5 - Backups y Exportación (Completado)

- [x] Exportación de datos a CSV/Excel
- [x] Backups automáticos diarios a Supabase Storage
- [x] Política de retención configurable (7d/4w/12m)
- [x] Notificaciones por email via Resend (opcional)
- [x] UI para gestión de backups

### 📋 Mejoras Futuras

- [ ] PWA (Progressive Web App)
- [ ] Mapa visual de clientes por zona
- [ ] Integración con pasarelas de pago
- [ ] Notificaciones push

Ver [docs/plans/](docs/plans/) para documentación detallada de cada fase.

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
**Última actualización:** 2026-01-23
