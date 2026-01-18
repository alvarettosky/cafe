# TODO - Café Mirador

## ✅ Completado

### Sistema de Recurrencia de Clientes

- [x] Función RPC `calculate_customer_recurrence` para calcular recurrencia basada en historial
- [x] Función RPC `update_customer_recurrence` para actualizar recurrencia de clientes
- [x] Campo `typical_recurrence_days` en tabla customers
- [x] Componente `RecurrenceInput` con sugerencias de IA
- [x] Integración en `CustomerModal` para editar recurrencia
- [x] Integración en `NewSaleModal` para nuevos clientes
- [x] Página `/clientes` para gestión de clientes con recurrencia
- [x] Página `/contactos` para lista de clientes a contactar
- [x] Tests completos para componentes de recurrencia

### Campos de Dirección

- [x] Campo `address` en tabla customers
- [x] Input de dirección en `NewSaleModal` (modo nuevo cliente)
- [x] Input de dirección en `CustomerModal`
- [x] Visualización de dirección en lista de ventas recientes
- [x] Tipos TypeScript actualizados (`CustomerWithRecurrence`)

### UX/UI Mejorada

- [x] Modal de "Nueva Venta" movido a página completa `/ventas/nueva`
- [x] Botones de navegación "Clientes" y "Contactos" en dashboard
- [x] Formulario de ventas con mejor espaciado y visibilidad
- [x] Modal de ventas optimizado (reducción de altura, scroll controlado)

### Testing

- [x] Tests para `customer-modal.test.tsx` (12 tests)
- [x] Tests para `recurrence-input.test.tsx` (15 tests)
- [x] Tests para `date-range-selector.test.tsx` corregidos
- [x] Mocks de Supabase RPC corregidos
- [x] 216 tests pasando (72% pass rate)

### Documentación

- [x] Archivo `CLAUDE.md` con guía completa del proyecto
  - Comandos esenciales
  - Arquitectura del sistema
  - Esquema de base de datos
  - Sistema de recurrencia
  - Errores comunes
  - Workflow recomendado

### Deployment

- [x] Desplegado en Vercel: https://cafe-pi-steel.vercel.app
- [x] Todas las rutas funcionando en producción
  - `/` - Dashboard principal
  - `/analytics` - Analytics
  - `/clientes` - Gestión de clientes
  - `/contactos` - Lista de contacto
  - `/ventas/nueva` - Formulario de venta

---

## 🔄 En Progreso

_No hay tareas en progreso actualmente_

---

## 📋 Pendiente

### Testing

- [ ] Aumentar cobertura de tests al 90%
- [ ] Agregar tests E2E con Playwright
- [ ] Tests para flujo completo de venta
- [ ] Tests para integración de recurrencia en ventas

### Features

- [ ] Notificaciones push para clientes que deben ser contactados
- [ ] Sistema de recordatorios automáticos
- [ ] Dashboard de métricas de recurrencia
- [ ] Exportar lista de contactos a CSV/Excel
- [ ] Integración con WhatsApp Business API
- [ ] Gráficas de predicción de ventas basadas en recurrencia

### Optimizaciones

- [ ] Caché de consultas frecuentes
- [ ] Optimización de imágenes
- [ ] Lazy loading de componentes pesados
- [ ] Service Worker para PWA

### DevOps

- [ ] CI/CD con GitHub Actions
- [ ] Monitoreo de errores con Sentry
- [ ] Analytics con Google Analytics o Plausible
- [ ] Backup automático de base de datos

### UX/UI

- [ ] Modo oscuro/claro toggle
- [ ] Animaciones de transición mejoradas
- [ ] Tour guiado para nuevos usuarios
- [ ] Accesibilidad (ARIA labels, teclado navigation)

---

## 🐛 Bugs Conocidos

- [ ] Warnings de accesibilidad en Dialog components (Missing Description)
- [ ] Tests fallando en worktree `.worktrees/customer-recurrence-sales-editing/`
- [ ] Imagen de fondo `/coffee-bg-dark.jpg` devuelve 404

---

## 📝 Notas

### Worktree Antiguo

El worktree `.worktrees/customer-recurrence-sales-editing/` tiene código desactualizado y tests fallando. Considerar:

- Eliminar worktree si ya no se usa
- Actualizar código en worktree
- Merger branch `feature/customer-recurrence-sales-editing` a main

### Pre-commit Hooks

- Configurado con Husky y lint-staged
- Ejecuta tests relacionados antes de commit
- Deprecation warning de Husky v9 → v10

### Estructura de Base de Datos

Ver `CLAUDE.md` para esquema completo de:

- customers (con recurrencia)
- sales
- inventory
- RPC functions

---

**Última actualización**: 2026-01-18
