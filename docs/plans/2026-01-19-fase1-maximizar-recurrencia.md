# Fase 1: Maximizar el Sistema de Recurrencia Existente

> **Estado**: 🟡 Planificado
> **Prioridad**: Alta
> **Estimación**: Primera iteración
> **Dependencias**: Sistema de recurrencia actual funcionando

---

## Resumen Ejecutivo

Café Mirador ya cuenta con un sistema de recurrencia único que predice cuándo los clientes necesitarán recomprar café. Esta fase maximiza el valor de ese sistema existente agregando:

1. **Repetir Pedido** - Un click para reordenar
2. **WhatsApp Automatizado** - Mensajes inteligentes basados en recurrencia
3. **Segmentación RFM** - Clasificación automática de clientes

**Fuente de inspiración**: [RoasterTools](https://www.roastertools.com/) reporta que pedidos con "Buy Again" son 50% más altos que pedidos manuales.

---

## Feature 1.1: Botón "Repetir Último Pedido"

### Objetivo

Permitir a vendedores crear una nueva venta idéntica a la última del cliente con un solo click.

### Ubicación en UI

- **Página `/clientes`**: Botón en cada fila de cliente
- **Modal de Cliente**: Botón prominente en la vista de detalle
- **Página `/contactos`**: Botón junto a cada cliente "por contactar"

### Especificación Técnica

#### Nueva RPC en Supabase

```sql
-- Obtener última venta de un cliente para repetir
CREATE OR REPLACE FUNCTION get_last_sale_for_repeat(p_customer_id UUID)
RETURNS JSON AS $$
DECLARE
  last_sale RECORD;
  sale_items JSON;
BEGIN
  -- Obtener última venta del cliente
  SELECT * INTO last_sale
  FROM sales
  WHERE customer_id = p_customer_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF last_sale IS NULL THEN
    RETURN NULL;
  END IF;

  -- Obtener items de esa venta
  SELECT json_agg(json_build_object(
    'product_id', si.product_id,
    'product_name', i.name,
    'quantity', si.quantity,
    'unit_type', si.unit_type,
    'unit_price', si.unit_price
  ))
  INTO sale_items
  FROM sale_items si
  JOIN inventory i ON i.id = si.product_id
  WHERE si.sale_id = last_sale.id;

  RETURN json_build_object(
    'sale_id', last_sale.id,
    'customer_id', last_sale.customer_id,
    'payment_method', last_sale.payment_method,
    'total', last_sale.total,
    'created_at', last_sale.created_at,
    'items', sale_items
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Componente React

```typescript
// components/repeat-sale-button.tsx
interface RepeatSaleButtonProps {
  customerId: string;
  customerName: string;
  onSaleCreated?: () => void;
}

// Flujo:
// 1. Click en botón
// 2. Llamar get_last_sale_for_repeat(customer_id)
// 3. Abrir NewSaleModal pre-llenado con los datos
// 4. Usuario confirma o modifica
// 5. Procesar venta normal
```

#### Modificaciones a NewSaleModal

```typescript
// Agregar prop para datos iniciales
interface NewSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaleComplete: () => void;
  initialData?: {
    customerId: string;
    customerName: string;
    items: SaleItem[];
    paymentMethod: string;
  };
}
```

### Criterios de Aceptación

- [ ] Botón visible en `/clientes` para cada cliente con al menos 1 compra
- [ ] Botón visible en `/contactos` para clientes por contactar
- [ ] Click abre modal pre-llenado con última compra
- [ ] Usuario puede modificar cantidades antes de confirmar
- [ ] Si producto ya no tiene stock suficiente, mostrar alerta
- [ ] Venta se procesa correctamente con RPC existente

---

## Feature 1.2: Automatización WhatsApp Inteligente

### Objetivo

Generar mensajes WhatsApp automáticos y contextuales basados en el estado de recurrencia del cliente.

### Tipos de Mensajes

| Trigger                     | Mensaje                                                                                                 | Cuándo                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Recordatorio preventivo** | "Hola [nombre], según tu ritmo de compra, pronto necesitarás más café. ¿Te preparo tu pedido habitual?" | 3 días ANTES de fecha esperada     |
| **Cliente atrasado**        | "Hola [nombre], hace [X días] que no nos visitas. ¿Todo bien con tu café?"                              | 1-7 días DESPUÉS de fecha esperada |
| **Cliente muy atrasado**    | "Hola [nombre], te extrañamos! Hace [X días] de tu última compra. ¿Necesitas que te llevemos café?"     | >7 días DESPUÉS de fecha esperada  |
| **Post-venta**              | "Gracias por tu compra [nombre]! Esperamos que disfrutes tu café. Nos vemos en ~[X días]"               | Inmediatamente después de venta    |
| **Primera compra**          | "Bienvenido [nombre]! Gracias por elegirnos. ¿Cada cuántos días sueles comprar café?"                   | Primera compra del cliente         |

### Especificación Técnica

#### Nueva Tabla para Templates

```sql
CREATE TABLE whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key VARCHAR(50) UNIQUE NOT NULL,
  template_text TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar templates por defecto
INSERT INTO whatsapp_templates (template_key, template_text, description) VALUES
('reminder_preventive', 'Hola {nombre}, según tu ritmo de compra, pronto necesitarás más café. ¿Te preparo tu pedido habitual de {ultimo_producto}?', 'Recordatorio 3 días antes'),
('reminder_due', 'Hola {nombre}, hace {dias} días que no nos visitas. ¿Todo bien con tu café?', 'Cliente en fecha de recompra'),
('reminder_overdue', 'Hola {nombre}, te extrañamos! Hace {dias} días de tu última compra. ¿Necesitas que te llevemos café?', 'Cliente atrasado >7 días'),
('post_sale', 'Gracias por tu compra {nombre}! Esperamos que disfrutes tu café. Nos vemos en ~{recurrencia} días.', 'Después de venta'),
('first_purchase', 'Bienvenido {nombre}! Gracias por elegirnos. ¿Cada cuántos días sueles comprar café?', 'Primera compra');
```

#### Nueva RPC para Generar Mensaje

```sql
CREATE OR REPLACE FUNCTION generate_whatsapp_message(
  p_customer_id UUID,
  p_template_key VARCHAR(50)
)
RETURNS JSON AS $$
DECLARE
  customer RECORD;
  template RECORD;
  last_sale RECORD;
  last_product TEXT;
  message TEXT;
  days_since INT;
BEGIN
  -- Obtener cliente
  SELECT * INTO customer FROM customers WHERE id = p_customer_id;
  IF customer IS NULL THEN
    RETURN json_build_object('error', 'Cliente no encontrado');
  END IF;

  -- Obtener template
  SELECT * INTO template FROM whatsapp_templates
  WHERE template_key = p_template_key AND is_active = true;
  IF template IS NULL THEN
    RETURN json_build_object('error', 'Template no encontrado');
  END IF;

  -- Calcular días desde última compra
  days_since := COALESCE(
    EXTRACT(DAY FROM NOW() - customer.last_purchase_date)::INT,
    0
  );

  -- Obtener último producto comprado
  SELECT i.name INTO last_product
  FROM sale_items si
  JOIN sales s ON s.id = si.sale_id
  JOIN inventory i ON i.id = si.product_id
  WHERE s.customer_id = p_customer_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- Reemplazar variables en template
  message := template.template_text;
  message := REPLACE(message, '{nombre}', COALESCE(customer.name, 'cliente'));
  message := REPLACE(message, '{dias}', days_since::TEXT);
  message := REPLACE(message, '{recurrencia}', COALESCE(customer.typical_recurrence_days::TEXT, '15'));
  message := REPLACE(message, '{ultimo_producto}', COALESCE(last_product, 'café'));

  RETURN json_build_object(
    'message', message,
    'phone', customer.phone,
    'customer_name', customer.name,
    'template_used', p_template_key,
    'whatsapp_url', 'https://wa.me/' || REGEXP_REPLACE(COALESCE(customer.phone, ''), '[^0-9]', '', 'g') || '?text=' || ENCODE(message::BYTEA, 'escape')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Componente de Botón WhatsApp Mejorado

```typescript
// components/smart-whatsapp-button.tsx
interface SmartWhatsAppButtonProps {
  customerId: string;
  customerStatus: 'preventive' | 'due' | 'overdue' | 'post_sale' | 'first_purchase';
}

// El componente:
// 1. Determina template según status
// 2. Llama generate_whatsapp_message()
// 3. Muestra preview del mensaje
// 4. Click abre WhatsApp con mensaje pre-llenado
```

#### Integración en /contactos

Modificar `app/contactos/page.tsx`:

- Agregar columna con botón WhatsApp inteligente
- Botón muestra icono diferente según urgencia
- Preview del mensaje en tooltip/hover

### Criterios de Aceptación

- [ ] Tabla `whatsapp_templates` creada con templates por defecto
- [ ] RPC `generate_whatsapp_message` funcionando
- [ ] Botón WhatsApp en `/contactos` usa mensaje contextual
- [ ] Mensaje incluye nombre del cliente y días correctos
- [ ] Link WhatsApp abre app con mensaje pre-llenado
- [ ] Admin puede editar templates desde configuración (futuro)

---

## Feature 1.3: Segmentación Automática de Clientes (RFM Simplificado)

### Objetivo

Clasificar automáticamente a los clientes según su comportamiento de compra para priorizar acciones.

### Segmentos Definidos

| Segmento      | Criterio                               | Color       | Acción Sugerida        |
| ------------- | -------------------------------------- | ----------- | ---------------------- |
| **Champion**  | Compra frecuente, reciente, alto valor | 🟢 Verde    | Mantener, programa VIP |
| **Loyal**     | Compra regular, dentro de recurrencia  | 🔵 Azul     | Mantener relación      |
| **Potential** | Pocas compras pero recientes           | 🟡 Amarillo | Nutrir, convertir      |
| **At Risk**   | Era frecuente, ahora atrasado          | 🟠 Naranja  | Contactar urgente      |
| **Lost**      | Mucho tiempo sin comprar               | 🔴 Rojo     | Campaña reactivación   |
| **New**       | Primera compra reciente                | 🟣 Morado   | Onboarding             |
| **Prospect**  | Nunca ha comprado                      | ⚪ Gris     | Conversión             |

### Especificación Técnica

#### Vista Materializada para Performance

```sql
-- Vista que calcula segmentos automáticamente
CREATE OR REPLACE VIEW customer_segments AS
WITH customer_metrics AS (
  SELECT
    c.id,
    c.name,
    c.phone,
    c.typical_recurrence_days,
    c.last_purchase_date,
    -- Recency: días desde última compra
    EXTRACT(DAY FROM NOW() - c.last_purchase_date)::INT as days_since_purchase,
    -- Frequency: número de compras en últimos 90 días
    (SELECT COUNT(*) FROM sales s WHERE s.customer_id = c.id
     AND s.created_at > NOW() - INTERVAL '90 days') as purchase_count_90d,
    -- Monetary: valor total en últimos 90 días
    (SELECT COALESCE(SUM(total), 0) FROM sales s WHERE s.customer_id = c.id
     AND s.created_at > NOW() - INTERVAL '90 days') as total_value_90d,
    -- Total histórico
    (SELECT COUNT(*) FROM sales s WHERE s.customer_id = c.id) as total_purchases,
    (SELECT COALESCE(SUM(total), 0) FROM sales s WHERE s.customer_id = c.id) as lifetime_value
  FROM customers c
  WHERE c.id != '00000000-0000-0000-0000-000000000000' -- Excluir Venta Rápida
)
SELECT
  *,
  CASE
    -- Prospect: nunca ha comprado
    WHEN last_purchase_date IS NULL THEN 'prospect'
    -- New: primera compra en últimos 30 días
    WHEN total_purchases = 1 AND days_since_purchase <= 30 THEN 'new'
    -- Champion: frecuente (>4 compras/90d), reciente, alto valor
    WHEN purchase_count_90d >= 4
         AND days_since_purchase <= COALESCE(typical_recurrence_days, 15)
         AND total_value_90d > (SELECT AVG(total_value_90d) FROM customer_metrics WHERE total_value_90d > 0)
    THEN 'champion'
    -- Loyal: dentro de recurrencia esperada
    WHEN days_since_purchase <= COALESCE(typical_recurrence_days, 15) THEN 'loyal'
    -- Potential: pocas compras pero recientes
    WHEN total_purchases <= 3 AND days_since_purchase <= 30 THEN 'potential'
    -- At Risk: pasó su recurrencia pero menos de 2x
    WHEN days_since_purchase > COALESCE(typical_recurrence_days, 15)
         AND days_since_purchase <= COALESCE(typical_recurrence_days, 15) * 2
    THEN 'at_risk'
    -- Lost: más de 2x su recurrencia sin comprar
    WHEN days_since_purchase > COALESCE(typical_recurrence_days, 15) * 2 THEN 'lost'
    ELSE 'loyal'
  END as segment
FROM customer_metrics;
```

#### RPC para Estadísticas de Segmentos

```sql
CREATE OR REPLACE FUNCTION get_customer_segment_stats()
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_agg(json_build_object(
      'segment', segment,
      'count', count,
      'total_value', total_value
    ))
    FROM (
      SELECT
        segment,
        COUNT(*) as count,
        SUM(lifetime_value) as total_value
      FROM customer_segments
      GROUP BY segment
      ORDER BY
        CASE segment
          WHEN 'champion' THEN 1
          WHEN 'loyal' THEN 2
          WHEN 'potential' THEN 3
          WHEN 'at_risk' THEN 4
          WHEN 'new' THEN 5
          WHEN 'lost' THEN 6
          WHEN 'prospect' THEN 7
        END
    ) stats
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Componente de Dashboard de Segmentos

```typescript
// components/customer-segments-card.tsx
// Muestra resumen visual de segmentos con:
// - Gráfico de dona/pie con distribución
// - Lista de segmentos con count y valor
// - Click en segmento filtra lista de clientes
```

#### Modificaciones a /clientes

- Agregar badge de segmento en cada fila
- Filtro por segmento en la lista
- Ordenar por prioridad de acción (at_risk primero)

### Criterios de Aceptación

- [ ] Vista `customer_segments` creada y funcionando
- [ ] RPC `get_customer_segment_stats` retorna datos correctos
- [ ] Badge de segmento visible en `/clientes`
- [ ] Filtro por segmento funcionando
- [ ] Card de resumen de segmentos en dashboard
- [ ] Colores consistentes según segmento

---

## Migración SQL Consolidada - Fase 1

```sql
-- =====================================================
-- MIGRACIÓN FASE 1: Maximizar Sistema de Recurrencia
-- Archivo: supabase/migrations/XXX_fase1_recurrencia.sql
-- =====================================================

-- 1. Función para repetir última venta
CREATE OR REPLACE FUNCTION get_last_sale_for_repeat(p_customer_id UUID)
RETURNS JSON AS $$
-- [código completo arriba]
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Tabla de templates WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key VARCHAR(50) UNIQUE NOT NULL,
  template_text TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar templates por defecto
INSERT INTO whatsapp_templates (template_key, template_text, description) VALUES
('reminder_preventive', 'Hola {nombre}, según tu ritmo de compra, pronto necesitarás más café. ¿Te preparo tu pedido habitual de {ultimo_producto}?', 'Recordatorio 3 días antes'),
('reminder_due', 'Hola {nombre}, hace {dias} días que no nos visitas. ¿Todo bien con tu café?', 'Cliente en fecha de recompra'),
('reminder_overdue', 'Hola {nombre}, te extrañamos! Hace {dias} días de tu última compra. ¿Necesitas que te llevemos café?', 'Cliente atrasado >7 días'),
('post_sale', 'Gracias por tu compra {nombre}! Esperamos que disfrutes tu café. Nos vemos en ~{recurrencia} días.', 'Después de venta'),
('first_purchase', 'Bienvenido {nombre}! Gracias por elegirnos. ¿Cada cuántos días sueles comprar café?', 'Primera compra')
ON CONFLICT (template_key) DO NOTHING;

-- RLS para templates
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Templates visibles para usuarios autenticados" ON whatsapp_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Solo admins pueden modificar templates" ON whatsapp_templates
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. Función para generar mensaje WhatsApp
CREATE OR REPLACE FUNCTION generate_whatsapp_message(
  p_customer_id UUID,
  p_template_key VARCHAR(50)
)
RETURNS JSON AS $$
-- [código completo arriba]
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Vista de segmentos de clientes
CREATE OR REPLACE VIEW customer_segments AS
-- [código completo arriba]
;

-- 5. Función para estadísticas de segmentos
CREATE OR REPLACE FUNCTION get_customer_segment_stats()
RETURNS JSON AS $$
-- [código completo arriba]
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants
GRANT EXECUTE ON FUNCTION get_last_sale_for_repeat TO authenticated;
GRANT EXECUTE ON FUNCTION generate_whatsapp_message TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_segment_stats TO authenticated;
GRANT SELECT ON customer_segments TO authenticated;
```

---

## Checklist de Seguimiento

### Preparación

- [ ] Revisar y aprobar diseño técnico
- [ ] Crear rama de desarrollo `feature/fase1-recurrencia`

### Base de Datos

- [ ] Crear migración SQL consolidada
- [ ] Ejecutar en Supabase (desarrollo)
- [ ] Verificar RPC `get_last_sale_for_repeat`
- [ ] Verificar tabla `whatsapp_templates`
- [ ] Verificar RPC `generate_whatsapp_message`
- [ ] Verificar vista `customer_segments`
- [ ] Verificar RPC `get_customer_segment_stats`

### Feature 1.1: Repetir Pedido

- [ ] Crear componente `RepeatSaleButton`
- [ ] Modificar `NewSaleModal` para aceptar `initialData`
- [ ] Integrar botón en `/clientes`
- [ ] Integrar botón en `/contactos`
- [ ] Manejar caso de stock insuficiente
- [ ] Tests unitarios
- [ ] Tests E2E

### Feature 1.2: WhatsApp Inteligente

- [ ] Crear componente `SmartWhatsAppButton`
- [ ] Integrar en `/contactos`
- [ ] Preview de mensaje en hover/modal
- [ ] Verificar encoding de URL WhatsApp
- [ ] Tests unitarios

### Feature 1.3: Segmentación

- [ ] Crear componente `CustomerSegmentBadge`
- [ ] Crear componente `CustomerSegmentsCard`
- [ ] Integrar badge en `/clientes`
- [ ] Agregar filtro por segmento
- [ ] Agregar card en dashboard
- [ ] Tests unitarios

### QA y Deploy

- [ ] Code review
- [ ] Testing en ambiente desarrollo
- [ ] Ejecutar migración en producción
- [ ] Deploy a Vercel
- [ ] Verificar en producción
- [ ] Actualizar CLAUDE.md con nuevas features

---

## Métricas de Éxito

| Métrica                                     | Baseline | Objetivo |
| ------------------------------------------- | -------- | -------- |
| Tiempo promedio para crear venta repetida   | ~2 min   | <30 seg  |
| Tasa de contacto a clientes "por contactar" | ?        | +50%     |
| Clientes clasificados automáticamente       | 0        | 100%     |

---

## Referencias

- [RoasterTools Wholesale Portal](https://www.roastertools.com/features/wholesale-portal)
- [CleverTap RFM Analysis](https://clevertap.com/blog/rfm-analysis/)
- [WhatsApp CRM Integration](https://nethunt.com/blog/whatsapp-crm/)
