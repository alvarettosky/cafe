# Diseño: Recurrencia de Clientes y Edición de Ventas

**Fecha**: 2026-01-17
**Estado**: Aprobado
**Estimación**: 9 días de desarrollo

## Resumen Ejecutivo

Este diseño implementa tres funcionalidades principales para el sistema POS de café:

1. **Edición de ventas** - Permite corregir errores en ventas recientes (últimas 24 horas)
2. **Recurrencia de clientes** - Sistema predictivo para sugerir cuándo contactar clientes basado en historial
3. **Lista de clientes por contactar** - Dashboard para gestionar seguimiento de clientes

El sistema aprende de los patrones de compra de cada cliente y sugiere automáticamente la próxima fecha de contacto.

## Objetivos

- Permitir corrección de errores en ventas sin comprometer integridad de datos
- Automatizar seguimiento de clientes basado en comportamiento real
- Mejorar retención de clientes con contacto proactivo
- Mantener historial completo de interacciones

## Arquitectura de Base de Datos

### Modificaciones a Tablas Existentes

**Tabla `customers` - Nuevos campos:**

```sql
ALTER TABLE customers ADD COLUMN typical_purchase_frequency_days INTEGER;
ALTER TABLE customers ADD COLUMN notes TEXT;
```

- `typical_purchase_frequency_days`: Frecuencia manual (7, 15, 30, 60, 90 días)
- `notes`: Notas sobre preferencias del cliente

**Tabla `sales` - Nuevos campos:**

```sql
ALTER TABLE sales ADD COLUMN next_contact_days INTEGER;
ALTER TABLE sales ADD COLUMN edited_at TIMESTAMPTZ;
ALTER TABLE sales ADD COLUMN edited_by UUID REFERENCES auth.users(id);
```

- `next_contact_days`: Días hasta próximo contacto (definido en la venta)
- `edited_at`: Timestamp de última edición
- `edited_by`: Usuario que editó

### Nueva Tabla `customer_contacts`

```sql
CREATE TABLE customer_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    contact_date DATE NOT NULL,
    contacted_at TIMESTAMPTZ,
    contacted_by UUID REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_status CHECK (status IN ('pending', 'contacted', 'sale_made', 'not_interested', 'postponed'))
);

CREATE INDEX idx_customer_contacts_date ON customer_contacts(contact_date);
CREATE INDEX idx_customer_contacts_status ON customer_contacts(status);
CREATE INDEX idx_customer_contacts_customer ON customer_contacts(customer_id);
```

**Propósito**: Rastrea todos los contactos programados y realizados con clientes.

## Funciones RPC

### 1. `calculate_suggested_recurrence(customer_id UUID)`

**Retorna**: `INTEGER` (días sugeridos) o `NULL`

**Lógica**:

```sql
1. Obtiene últimas 3 ventas del cliente (ORDER BY created_at DESC LIMIT 3)
2. Si tiene 3+ ventas:
   - Calcula días entre cada par consecutivo de ventas
   - Retorna promedio redondeado
3. Si tiene < 3 ventas:
   - Retorna customers.typical_purchase_frequency_days
4. Si no tiene nada:
   - Retorna NULL
```

**Ejemplo**:

- Venta 1: 1 enero
- Venta 2: 16 enero (+15 días)
- Venta 3: 29 enero (+13 días)
- Sugerencia: (15 + 13) / 2 = 14 días

### 2. `get_pending_contacts(filter TEXT DEFAULT 'all')`

**Retorna**: `TABLE` con datos de contactos pendientes

**Filtros válidos**: 'overdue', 'today', 'this_week', 'all'

**Columnas retornadas**:

- customer_id, full_name, phone
- last_purchase_date
- usual_product_name, usual_unit (producto más comprado)
- contact_date (fecha programada)
- days_until_contact (negativo si atrasado)
- contact_status

**Ordenamiento**:

1. Atrasados primero (días negativos)
2. Por fecha más cercana

**Lógica para "producto usual"**:

```sql
SELECT product_id, COUNT(*) as frequency
FROM sale_items si
JOIN sales s ON si.sale_id = s.id
WHERE s.customer_id = [customer_id]
GROUP BY product_id
ORDER BY frequency DESC
LIMIT 1
```

### 3. `get_customer_statistics(customer_id UUID)`

**Retorna**: `JSONB`

**Estructura**:

```json
{
  "total_purchases": 15,
  "total_spent": 450000,
  "avg_days_between_purchases": 14,
  "favorite_product": "Café Tropical Tostión Media",
  "favorite_unit": "1 libra",
  "last_purchase_date": "2026-01-10",
  "purchase_history": [
    {
      "date": "2026-01-10",
      "product": "Café Tropical",
      "amount": 30000
    }
  ]
}
```

### 4. `edit_sale_with_inventory_adjustment(sale_id UUID, new_data JSONB)`

**Retorna**: `BOOLEAN`

**Transacción atómica**:

```sql
BEGIN;
  -- 1. Verificar que venta < 24 horas
  IF (NOW() - created_at) > INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'Cannot edit sale older than 24 hours';
  END IF;

  -- 2. Obtener sale_items originales
  -- 3. Revertir inventario (sumar cantidades)
  -- 4. Actualizar sales y sale_items con nuevos datos
  -- 5. Aplicar nuevo descuento de inventario
  -- 6. Actualizar sales.edited_at = NOW(), sales.edited_by = auth.uid()
  -- 7. Si next_contact_days cambió, actualizar customer_contacts.contact_date
COMMIT;
```

**Rollback automático** si falla cualquier paso.

### 5. `mark_contact_as_completed(contact_id UUID, status TEXT, notes TEXT)`

**Retorna**: `BOOLEAN`

**Actualizaciones**:

```sql
UPDATE customer_contacts SET
  status = [status],
  contacted_at = NOW(),
  contacted_by = auth.uid(),
  notes = [notes]
WHERE id = contact_id;

-- Si status = 'postponed', crear nuevo contacto futuro
```

## Componentes de UI

### Componentes Nuevos

**1. `RecurrenceInput` (components/recurrence-input.tsx)**

Componente reutilizable para seleccionar días de recurrencia.

Props:

```typescript
{
  suggestedDays?: number;
  value: number;
  onChange: (days: number) => void;
  showPresets?: boolean;
}
```

UI:

```
┌─────────────────────────────────────┐
│ ✨ Sugerido: 15 días (1 feb 2026)  │
│                                     │
│ Días: [15] días                     │
│ Presets: [7] [15] [30] [60]       │
└─────────────────────────────────────┘
```

**2. `EditSaleModal` (components/edit-sale-modal.tsx)**

Modal para editar ventas existentes.

Características:

- Solo permite editar ventas < 24 horas
- Muestra advertencia sobre ajuste de inventario
- Precarga todos los datos de la venta
- Validación de inventario disponible
- Confirmación antes de guardar

Validaciones:

- Verificar edad de la venta
- Verificar disponibilidad de inventario
- Mostrar errores específicos si falla

**3. `CustomerModal` (components/customer-modal.tsx)**

Modal para crear/editar clientes.

Campos:

- Nombre completo (requerido)
- Teléfono
- Email
- Frecuencia de compra típica (dropdown: 7, 15, 30, 60, 90 días)
- Notas

Modo edición adicional:

- Muestra historial de compras (readonly)
- Link a estadísticas completas

**4. `ContactActionDialog` (components/contact-action-dialog.tsx)**

Diálogo para marcar contacto como completado.

Opciones:

- ✅ Contactado exitosamente
- 🛒 Venta realizada (redirige a NewSaleModal)
- ⏸️ Posponer (selecciona nueva fecha)
- ❌ No interesado

Incluye campo de notas para cada opción.

**5. `CustomerStatsCard` (components/customer-stats-card.tsx)**

Card que muestra estadísticas del cliente.

Datos:

- Total de compras
- Gasto total
- Promedio días entre compras
- Producto favorito
- Última compra

### Componentes Especializados

**6. `CustomerTable` (components/customers/customer-table.tsx)**

Tabla completa de clientes con:

- Búsqueda por nombre/teléfono
- Columnas: Nombre, Teléfono, Última Compra, Frecuencia, Acciones
- Acciones: Editar (✏️), Ver estadísticas (📊)

**7. `ContactList` (components/customers/contact-list.tsx)**

Lista de contactos pendientes con:

- Código de colores por urgencia
- Filtrado por estado
- Acciones rápidas por contacto

**8. `ContactFilters` (components/customers/contact-filters.tsx)**

Filtros superiores:

- Atrasados (badge con contador)
- Hoy (badge con contador)
- Esta semana (badge con contador)
- Todos

### Modificaciones a Componentes Existentes

**`NewSaleModal` (components/new-sale-modal.tsx)**

Agregar sección al final, antes de "Registrar Venta":

```tsx
<div className="border-t pt-4">
  <h3>📅 Próximo Contacto</h3>
  <RecurrenceInput
    suggestedDays={suggestedRecurrence}
    value={nextContactDays}
    onChange={setNextContactDays}
    showPresets={true}
  />
  {suggestedRecurrence && <p className="text-sm text-gray-500">ⓘ Basado en compras anteriores</p>}
</div>
```

Lógica adicional:

1. Al seleccionar cliente, llamar a `calculate_suggested_recurrence(customer_id)`
2. Mostrar sugerencia si existe
3. Al registrar venta, crear registro en `customer_contacts` si `next_contact_days` tiene valor

**Historial de ventas (app/page.tsx)**

Agregar botón de edición:

```tsx
{
  sale.created_at > Date.now() - 24 * 60 * 60 * 1000 && (
    <button onClick={() => openEditModal(sale.id)}>✏️ Editar</button>
  );
}
```

## Páginas Nuevas

### `/clientes` - Gestión de Clientes

**Layout**:

```
┌─────────────────────────────────────────────────────┐
│ Clientes                          [+ Nuevo Cliente] │
├──────────┬───────────┬─────────────┬────────┬───────┤
│ Nombre   │ Teléfono  │ Últ. Compra │ Frecu. │ Acc.  │
├──────────┼───────────┼─────────────┼────────┼───────┤
│ Juan P.  │ 300-1234  │ Hace 5 días │ 15 d.  │ ✏️ 📊 │
│ María L. │ 311-9876  │ Hace 12 d.  │ 7 d.   │ ✏️ 📊 │
└──────────┴───────────┴─────────────┴────────┴───────┘
```

**Funcionalidades**:

- Tabla completa de clientes
- Búsqueda en tiempo real
- Crear nuevo cliente
- Editar cliente existente
- Ver estadísticas detalladas

### `/contactos` - Clientes por Contactar

**Layout**:

```
┌────────────────────────────────────────────────────┐
│ 📞 Clientes por Contactar                          │
├────────────────────────────────────────────────────┤
│ [📍 Atrasados: 3] [📅 Hoy: 2] [📆 Semana: 5]      │
├───────┬──────────┬───────────┬──────────┬─────────┤
│ Clien.│ Últ. Comp│ Prod. Usu.│ Contact. │ Acc.    │
├───────┼──────────┼───────────┼──────────┼─────────┤
│ Juan  │ 18 días  │ Café 1 lb │⚠️ -3 días│ ✅ 🛒 📞│
│ María │ 7 días   │ Café ½ lb │🟢 Hoy    │ ✅ 🛒 📞│
│ Pedro │ 13 días  │ Café 1 lb │🟡 En 2 d.│ ✅ 🛒 📞│
└───────┴──────────┴───────────┴──────────┴─────────┘
```

**Código de colores**:

- 🔴 Rojo: Atrasado (fecha pasó)
- 🟢 Verde: Hoy
- 🟡 Amarillo: Próximos 7 días
- ⚪ Gris: Futuro (>7 días)

**Acciones**:

- ✅ Marcar como contactado
- 🛒 Registrar venta (abre NewSaleModal con cliente precargado)
- 📞 Ver detalles/editar contacto

## Flujos de Datos

### Flujo 1: Cliente Nuevo → Primera Venta

```
1. Usuario crea cliente en /clientes
   └─> Guarda typical_purchase_frequency_days = 15

2. Usuario registra primera venta
   └─> NO hay historial
   └─> Muestra: "Configurado: 15 días"
   └─> Usuario confirma/modifica
   └─> Guarda next_contact_days = 15
   └─> Crea customer_contacts:
       - contact_date = HOY + 15 días
       - status = 'pending'

3. En 15 días
   └─> Cliente aparece en /contactos
   └─> Usuario contacta → marca como completado
   └─> Si hay venta → nueva venta (vuelve al paso 2)
```

### Flujo 2: Cliente con Historial → Sugerencia

```
Cliente con 3 ventas:
├─ 1 enero
├─ 16 enero (+15 días)
└─ 29 enero (+13 días)

Nueva venta 10 febrero:
├─> calculate_suggested_recurrence()
│   └─> días = [15, 13]
│   └─> promedio = 14 días
│
├─> Muestra: "✨ Sugerido: 14 días"
│
└─> Usuario acepta/modifica
    └─> Se guarda en next_contact_days
    └─> Próxima sugerencia sigue basada en historial real
```

### Flujo 3: Edición de Venta

```
Usuario hace click en ✏️
├─> Verifica edad < 24h
│   └─> Si > 24h: muestra error
│
├─> Abre EditSaleModal con datos precargados
│
├─> Usuario modifica productos/cantidades
│
├─> Click "Guardar Cambios"
│   ├─> Muestra confirmación
│   └─> Usuario confirma
│
└─> Backend (edit_sale_with_inventory_adjustment):
    ├─> BEGIN TRANSACTION
    ├─> Revierte inventario original
    ├─> Valida nuevo inventario disponible
    ├─> Aplica nuevos cambios
    ├─> Actualiza edited_at, edited_by
    ├─> Si next_contact_days cambió:
    │   └─> Actualiza customer_contacts.contact_date
    └─> COMMIT
```

## Casos Edge y Manejo de Errores

### Caso 1: Cliente compra antes de fecha sugerida

**Problema**: Contacto sigue "pending" pero cliente ya compró.

**Solución**:

- Al registrar venta, sistema detecta contacto pendiente
- Pregunta: "¿Marcar contacto previo como completado?"
- Si sí → actualiza `status = 'sale_made'`, `contacted_at = NOW()`

### Caso 2: Editar venta que ya generó contacto

**Problema**: Cambiar `next_contact_days` afecta contacto programado.

**Solución**:

- Mostrar advertencia: "Esto cambiará la fecha de contacto programada"
- Actualizar `customer_contacts.contact_date` automáticamente
- Mantener sincronización venta ↔ contacto

### Caso 3: Eliminar venta (si se permite)

**Problema**: Venta generó contacto pendiente.

**Solución**:

- Si contacto aún es "pending" → eliminar también
- Si contacto ya fue completado → mantener, solo desvincula `sale_id = NULL`
- Preservar historial de contactos realizados

### Caso 4: Cliente inactivo (>90 días sin compra)

**Problema**: Cliente no compra hace mucho y no hay contacto programado.

**Solución**:

- Aparece en `/contactos` con badge especial: "⚠️ Inactivo"
- Permite crear contacto manual para reactivación
- Sugerencia automática basada en última frecuencia conocida

### Caso 5: Editar venta fuera de período

**Problema**: Intento de editar venta > 24 horas.

**Solución**:

```
❌ No se puede editar
Esta venta tiene más de 24 horas.
Para correcciones, contacta al administrador.
```

### Caso 6: Conflicto de inventario al editar

**Problema**: No hay stock suficiente para la nueva cantidad.

**Solución**:

- Validar ANTES de aplicar cambios
- Error específico: "No hay suficiente Café Tropical para cambiar a 2 libras (disponible: 1.5 libras)"
- Opción: Ajustar cantidad o cancelar

### Caso 7: Cliente sin teléfono/email

**Problema**: No se puede contactar al cliente.

**Solución**:

- Permitir guardar cliente sin contacto
- En `/contactos`, marcar con ⚠️ "Sin datos de contacto"
- Opción de actualizar datos desde la lista

### Caso 8: Múltiples contactos pendientes para mismo cliente

**Problema**: Se crearon múltiples contactos sin marcar anteriores.

**Solución**:

- Mostrar solo el más reciente en lista principal
- Opción "Ver todos los contactos" muestra historial completo
- Al marcar como completado, opción de completar todos los pendientes

## TypeScript Types

```typescript
// types/customer.ts

export type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  typical_purchase_frequency_days: number | null;
  notes: string | null;
  created_at: string;
};

export type CustomerContact = {
  id: string;
  customer_id: string;
  sale_id: string | null;
  contact_date: string;
  contacted_at: string | null;
  contacted_by: string | null;
  status: 'pending' | 'contacted' | 'sale_made' | 'not_interested' | 'postponed';
  notes: string | null;
  created_at: string;
};

export type PendingContact = {
  contact_id: string;
  customer_id: string;
  customer_name: string;
  phone: string | null;
  last_purchase_date: string;
  usual_product_name: string | null;
  usual_unit: string | null;
  contact_date: string;
  days_until_contact: number;
  status: string;
};

export type CustomerStats = {
  total_purchases: number;
  total_spent: number;
  avg_days_between_purchases: number | null;
  favorite_product: string | null;
  favorite_unit: string | null;
  last_purchase_date: string | null;
  purchase_history: Array<{
    date: string;
    product: string;
    unit: string;
    amount: number;
  }>;
};

export type EditSaleData = {
  customer_id: string;
  items: Array<{
    product_id: string;
    unit: string;
    quantity: number;
    price_per_unit: number;
  }>;
  payment_method: string;
  next_contact_days: number | null;
};
```

## Estructura de Archivos

```
app/
├── clientes/
│   └── page.tsx                    # Página gestión de clientes
├── contactos/
│   └── page.tsx                    # Página clientes por contactar
└── api/
    └── sales/
        └── edit/
            └── route.ts            # API endpoint editar ventas

components/
├── edit-sale-modal.tsx             # Modal editar ventas
├── customer-modal.tsx              # Modal crear/editar cliente
├── recurrence-input.tsx            # Input reutilizable recurrencia
├── contact-action-dialog.tsx       # Diálogo marcar contacto
├── customer-stats-card.tsx         # Card estadísticas cliente
└── customers/
    ├── customer-table.tsx          # Tabla de clientes
    ├── contact-list.tsx            # Lista contactos pendientes
    └── contact-filters.tsx         # Filtros de contactos

supabase/migrations/
└── 010_customer_recurrence.sql     # Migration completa

types/
└── customer.ts                      # Types para clientes/contactos
```

## Plan de Implementación

### Fase 1: Base de Datos (1 día)

**Tareas**:

1. Crear migration `010_customer_recurrence.sql`
2. Ejecutar en Supabase
3. Crear funciones RPC en orden:
   - `calculate_suggested_recurrence`
   - `get_customer_statistics`
   - `get_pending_contacts`
   - `mark_contact_as_completed`
   - `edit_sale_with_inventory_adjustment`
4. Probar cada función en SQL Editor

**Validación**:

- Todas las funciones ejecutan sin errores
- `calculate_suggested_recurrence` retorna valores correctos
- `get_pending_contacts` ordena correctamente

### Fase 2: Gestión de Clientes (2 días)

**Día 1**:

1. Crear `types/customer.ts`
2. Implementar `RecurrenceInput` component
3. Implementar `CustomerModal` component
4. Crear estructura básica de página `/clientes`

**Día 2**:

1. Implementar `CustomerTable` component
2. Integrar crear/editar clientes
3. Testing de frecuencia típica
4. Ajustes visuales

**Validación**:

- Puede crear cliente con frecuencia típica
- Puede editar cliente existente
- Tabla muestra todos los clientes correctamente

### Fase 3: Recurrencia en Ventas (1 día)

**Tareas**:

1. Modificar `NewSaleModal`:
   - Agregar llamada a `calculate_suggested_recurrence`
   - Integrar `RecurrenceInput`
   - Crear registro en `customer_contacts` al finalizar
2. Probar con cliente nuevo (sin sugerencia)
3. Probar con cliente con historial (con sugerencia)

**Validación**:

- Sugerencia aparece correctamente basada en historial
- Contacto se crea en DB al registrar venta
- Campo es opcional (puede quedar vacío)

### Fase 4: Edición de Ventas (2 días)

**Día 1**:

1. Implementar `EditSaleModal` component
2. Crear API route `/api/sales/edit`
3. Implementar lógica de transacción en backend

**Día 2**:

1. Agregar botón editar en historial
2. Implementar validación 24 horas
3. Manejo de errores de inventario
4. Testing completo del flujo

**Validación**:

- Solo muestra botón editar en ventas < 24h
- Inventario se ajusta correctamente
- Errores de stock muestran mensaje claro
- Edición actualiza `edited_at` y `edited_by`

### Fase 5: Lista de Contactos (2 días)

**Día 1**:

1. Implementar `ContactFilters` component
2. Implementar `ContactList` component
3. Crear estructura de página `/contactos`
4. Integrar filtros

**Día 2**:

1. Implementar `ContactActionDialog` component
2. Integrar marcar como contactado
3. Botón registrar venta desde contacto
4. Testing de todos los estados

**Validación**:

- Filtros funcionan correctamente
- Colores por urgencia son correctos
- Marcar contactado actualiza estado
- Registrar venta precarga cliente

### Fase 6: Pulido y Testing (1 día)

**Tareas**:

1. Agregar links en menú principal:
   - "Clientes" → `/clientes`
   - "Contactos" → `/contactos`
2. Testing de casos edge documentados
3. Ajustes visuales y responsive
4. Documentación de usuario (README)

**Validación**:

- Navegación funciona correctamente
- Casos edge manejados apropiadamente
- UI responsive en mobile
- Documentación clara

## Testing

### Test Cases Críticos

**1. Cálculo de Recurrencia**:

- Cliente sin compras → NULL
- Cliente con 1 compra → frecuencia típica
- Cliente con 3+ compras → promedio de últimas 3
- Verificar redondeo correcto

**2. Edición de Ventas**:

- Venta < 24h → permite editar
- Venta > 24h → bloquea edición
- Stock insuficiente → muestra error
- Edición exitosa → actualiza inventario correctamente

**3. Contactos Pendientes**:

- Filtro "atrasados" muestra solo días negativos
- Filtro "hoy" muestra contact_date = today
- Ordenamiento correcto (atrasados primero)
- Marcar contactado actualiza estado

**4. Manejo de Errores**:

- Cliente sin teléfono → permite guardar, muestra advertencia
- Venta sin next_contact_days → no crea contacto
- Editar venta antigua → mensaje de error claro

## Métricas de Éxito

**Funcionalidad**:

- ✅ Todas las funciones RPC ejecutan sin errores
- ✅ Edición de ventas mantiene integridad de inventario
- ✅ Sugerencias de recurrencia son precisas (±2 días del real)

**Usabilidad**:

- ✅ Puede crear/editar cliente en < 30 segundos
- ✅ Puede editar venta en < 60 segundos
- ✅ Lista de contactos se carga en < 2 segundos

**Negocio**:

- ✅ Tasa de contacto de clientes inactivos aumenta
- ✅ Tiempo promedio entre compras se reduce
- ✅ Menos errores en ventas (gracias a edición)

## Riesgos y Mitigaciones

**Riesgo 1: Edición de ventas genera inconsistencias**

- Mitigación: Restricción de 24 horas
- Mitigación: Transacciones atómicas
- Mitigación: Auditoría completa (edited_at, edited_by)

**Riesgo 2: Sugerencias de recurrencia inexactas**

- Mitigación: Usar solo últimas 3 compras (datos recientes)
- Mitigación: Permitir override manual siempre
- Mitigación: Mostrar base de cálculo al usuario

**Riesgo 3: Lista de contactos se vuelve muy larga**

- Mitigación: Paginación (50 por página)
- Mitigación: Filtros efectivos
- Mitigación: Archivado automático de contactados >30 días

**Riesgo 4: Performance con muchos clientes**

- Mitigación: Índices en customer_contacts
- Mitigación: Limitar historial a últimas 10 compras
- Mitigación: Caché de sugerencias de recurrencia

## Consideraciones Futuras

**Posibles Mejoras**:

1. Notificaciones push cuando hay contactos atrasados
2. Integración con WhatsApp para contacto automático
3. Machine learning para mejorar predicciones
4. Dashboard de métricas de retención
5. Exportar lista de contactos a CSV
6. Recordatorios programados por email

**No incluidas en v1**:

- WhatsApp Business API
- Notificaciones push
- ML/AI avanzado
- Exportación de reportes

## Conclusión

Este diseño implementa un sistema completo de gestión de recurrencia y edición de ventas que:

- ✅ Aprende del comportamiento real de clientes
- ✅ Automatiza seguimiento proactivo
- ✅ Permite corrección de errores sin comprometer datos
- ✅ Mantiene integridad de inventario
- ✅ Escala con crecimiento del negocio

**Estimación total**: 9 días de desarrollo activo

**Próximos pasos**: Crear plan de implementación detallado con worktree aislado.
