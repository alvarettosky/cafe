# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Sin publicar]

### 🐛 Corregido

#### El gate de carga daba rojo sin que nada estuviera roto

- El nightly falló tres noches seguidas (#104, #105, #106) sobre **el mismo
  commit** que había pasado verde las cinco anteriores. No había regresión: el
  p95 se mantuvo entre 74 y 97 ms contra un umbral de 3.000 ms.
- Causa 1: `check(...) || errorRate.add(1)` en `tests/load/api-stress-test.js`
  registraba solo los fallos, nunca los aciertos, así que el `Rate` valía 100 %
  en cuanto fallaba **un** check. El `rate<0.1` declarado era, de hecho, «cero
  fallos tolerados». Ahora se usa `errorRate.add(!check(...))`.
- Causa 2: el check `'export API responds in <1s'` era un techo sobre el peor
  request de la corrida. La cola de este backend mide 11-16× su p95 de forma
  estable, también en las noches verdes. La latencia pasa a vigilarse con
  `Trend` + percentiles por endpoint; los checks se quedan con la corrección.
- Umbrales calibrados sobre las cuatro noches medidas en CI (`p(95)<300`,
  `p(99)<2000`), no estimados.

### ✨ Mejorado

- Los 401 esperados de `/api/export` dejan de contarse como fallo de red
  (`responseCallback`): `http_req_failed` pasa de 33 % a 0 % en corridas sanas y
  admite umbral propio. El resumen ya no reporta «Failed Requests: 3674» cuando
  todo está bien.
- k6 se instala con `grafana/setup-k6-action` con versión fijada (2.2.0) en vez
  de `apt-get install k6` sin fijar: el gate ya no puede cambiar de
  comportamiento sin un commit, y desaparece la dependencia de un keyserver.
- `k6 run --quiet`: la barra de progreso escribía ~480 líneas por corrida y
  enterraba el motivo del fallo.
- Documentados los umbrales, las dos reglas de escritura de tests de carga y el
  diagnóstico del exit 99 en [`docs/testing/CI_CD.md`](docs/testing/CI_CD.md) y
  [`docs/testing/TESTING_GUIDE.md`](docs/testing/TESTING_GUIDE.md).

### 🔧 Mantenimiento

- Las acciones de GitHub suben del runtime Node 20 (deprecado en los runners) al
  vigente: `checkout@v7`, `setup-node@v7`, `upload-artifact@v7` — 29 ocurrencias
  en 6 workflows. Ojo: `upload-artifact@v5` **sigue siendo Node 20**, el mínimo
  válido es `v6`.
- `codecov/codecov-action` y `grafana/setup-k6-action` quedan fijados por SHA por
  ser de terceros.

## [1.3.0] - 2026-01-23

### 🎉 Agregado

#### Sistema de Backups Automatizados

- Backups diarios automáticos a Supabase Storage (2:00 AM UTC via GitHub Actions)
- Scripts de backup en `scripts/backup/`:
  - `export-tables.ts` - Exporta 20 tablas a JSON
  - `upload-supabase.ts` - Sube backup ZIP a Supabase Storage
  - `cleanup-retention.ts` - Limpieza con política de retención (7d/4w/12m)
  - `send-notification.ts` - Notificación por email via Resend (opcional)
  - `run-backup.ts` - Orquestador principal
- Workflow GitHub Actions `.github/workflows/daily-backup.yml`
- API routes para gestión de backups:
  - `GET /api/backups/list` - Lista backups en Supabase Storage
  - `POST /api/backups/trigger` - Ejecuta backup via GitHub Actions

#### Testing Masivo

- 581 nuevos tests unitarios (de 273 a 854 total)
- Cobertura aumentada de 5% a 93.9%
- Tests para todas las páginas del portal de cliente
- Tests para API routes de exportación y backups
- Tests para páginas principales (dashboard, analytics, clientes, contactos)

### ✨ Mejorado

- Documentación actualizada (README.md, CLAUDE.md)
- Formato de nombre de backup con timestamp único: `cafe-mirador-backup-YYYY-MM-DD_HH-MM-SS.zip`

### 🐛 Corregido

- Migración de Google Drive a Supabase Storage (Google Drive service accounts tienen limitaciones de quota)
- Tests de clientes y contactos con esperas apropiadas para datos asincrónicos

---

## [1.2.0] - 2026-01-18

### 🎉 Agregado

#### Sistema de Recurrencia Inteligente

- Función RPC `calculate_customer_recurrence` para predicción de patrones de compra
- Función RPC `update_customer_recurrence` para actualizar recurrencia
- Campo `typical_recurrence_days` en tabla `customers`
- Componente `RecurrenceInput` con sugerencias de IA
- Integración de recurrencia en `CustomerModal`
- Integración de recurrencia en formulario de nuevos clientes

#### Páginas Nuevas

- `/clientes` - Gestión completa de clientes con búsqueda y filtros
- `/contactos` - Lista de contacto clasificada por urgencia (Urgente, Pronto, Planificado)
- `/ventas/nueva` - Formulario de venta en página completa (antes era modal)

#### Campos de Dirección

- Campo `address` en tabla `customers`
- Input de dirección en formulario de nueva venta
- Input de dirección en modal de cliente
- Visualización de dirección en lista de ventas recientes

#### Navegación

- Botones "Clientes" y "Contactos" en header del dashboard
- Iconos para mejor UX (Users, Phone)

#### Testing

- 12 tests para `customer-modal.test.tsx`
- 15 tests para `recurrence-input.test.tsx`
- Tests corregidos para `date-range-selector.test.tsx`
- Mocks de Supabase RPC implementados
- **Coverage**: 72% (216 tests pasando en v1.2.0)

#### Documentación

- `CLAUDE.md` - Guía completa del proyecto
- `.claude/TODO.md` - Lista de tareas y estado del proyecto
- `README.md` completamente actualizado
- `CHANGELOG.md` - Este archivo

### ✨ Mejorado

#### UX/UI

- Formulario de "Nueva Venta" movido a página completa con mejor espaciado
- Modal de ventas optimizado (reducción de altura, scroll controlado)
- Inputs con altura optimizada (h-9 → h-10 en página completa)
- Total de venta más prominente en nuevo diseño
- Mejor visualización de información del cliente en ventas recientes

#### Performance

- Queries optimizadas con joins de Supabase
- Carga de datos más eficiente en páginas de clientes

### 🐛 Corregido

- Mocks de `supabase.rpc` en tests que causaban errores
- Tests de `date-range-selector` actualizados para nueva API
- React hooks order violations corregidos
- Pre-commit hooks funcionando correctamente

### 🗄️ Base de Datos

#### Nuevas Funciones RPC

```sql
-- Calcula recurrencia basada en historial de compras
calculate_customer_recurrence(p_customer_id UUID)

-- Actualiza recurrencia de cliente
update_customer_recurrence(p_customer_id UUID, p_recurrence_days INTEGER)

-- Obtiene clientes que deben ser contactados
get_customers_to_contact(p_urgency_threshold_days INTEGER)
```

#### Cambios en Tablas

- `customers.typical_recurrence_days` - INTEGER (nullable)
- `customers.address` - TEXT (nullable)

---

## [1.1.0] - 2026-01-17

### Agregado

- Analytics page con gráficas de ventas
- Dashboard con KPIs en tiempo real
- Inventario con edición y eliminación
- Sistema de autenticación con Supabase
- Tests básicos con Vitest

### Mejorado

- UI/UX con TailwindCSS y Radix UI
- Animaciones con Framer Motion
- Responsividad en móviles

---

## [1.0.0] - 2026-01-16

### Agregado

- Versión inicial del proyecto
- CRUD de inventario
- Registro de ventas básico
- Dashboard inicial
- Deployment en Vercel
- Configuración de Supabase

---

## Tipos de Cambios

- `Agregado` - Nueva funcionalidad
- `Mejorado` - Mejoras en funcionalidad existente
- `Obsoleto` - Funcionalidad que será removida
- `Removido` - Funcionalidad removida
- `Corregido` - Corrección de bugs
- `Seguridad` - Cambios relacionados con vulnerabilidades

---

**Última actualización**: 2026-01-23
