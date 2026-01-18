# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

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
- **Coverage**: 72% (216 tests pasando)

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

**Última actualización**: 2026-01-18
