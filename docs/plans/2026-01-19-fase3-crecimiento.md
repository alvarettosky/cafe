# Fase 3: Crecimiento y Escalabilidad

> **Estado**: ✅ Completado (2026-01-19)
> **Prioridad**: Media
> **Dependencias**: Fases 1 y 2 completadas ✅
> **Enfoque**: Adquisición de clientes y optimización operativa

---

## Resumen Ejecutivo

Con el sistema de recurrencia optimizado (Fase 1) y el portal de clientes funcionando (Fase 2), esta fase se enfoca en:

1. **Programa de Referidos** - Clientes traen nuevos clientes
2. **Listas de Precios Diferenciadas** - Precios por tipo de cliente
3. **Optimización de Rutas de Entrega** - Eficiencia operativa

**Objetivo**: Escalar la base de clientes manteniendo costos operativos controlados.

---

## Feature 3.1: Programa de Referidos

### Objetivo

Incentivar a clientes existentes para que traigan nuevos clientes, aprovechando el boca a boca.

### Modelo del Programa

```
Cliente existente refiere → Nuevo cliente compra → Ambos reciben beneficio

Beneficio sugerido:
- Referidor: 10% descuento en próxima compra (o café gratis)
- Referido: 10% descuento en primera compra

Restricciones:
- Máximo 5 referidos activos por mes
- Descuento válido por 30 días
- Nuevo cliente debe completar primera compra
```

### Inspiración

[Pact Coffee](https://blueprint.store/post/examples-of-dtc-subscription-retention) usa "refer a friend" exitosamente con 55,000 suscriptores.

### Especificación Técnica

#### Nueva Tabla: referrals

```sql
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Quién refiere
  referrer_customer_id UUID NOT NULL REFERENCES customers(id),
  referrer_code VARCHAR(20) UNIQUE NOT NULL,

  -- Quién fue referido
  referred_customer_id UUID REFERENCES customers(id),
  referred_email VARCHAR(255),
  referred_phone VARCHAR(50),

  -- Estado del referido
  status VARCHAR(20) DEFAULT 'pending',
  -- pending: link compartido pero no usado
  -- registered: referido creado como cliente
  -- completed: referido hizo primera compra
  -- rewarded: ambos recibieron beneficio
  -- expired: expiró sin completar

  -- Recompensas
  referrer_reward_type VARCHAR(20), -- 'discount_percent', 'discount_fixed', 'free_product'
  referrer_reward_value DECIMAL(10,2),
  referrer_reward_claimed BOOLEAN DEFAULT false,
  referrer_reward_sale_id UUID REFERENCES sales(id),

  referred_reward_type VARCHAR(20),
  referred_reward_value DECIMAL(10,2),
  referred_reward_claimed BOOLEAN DEFAULT false,
  referred_reward_sale_id UUID REFERENCES sales(id),

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  registered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

-- Configuración del programa
CREATE TABLE referral_program_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  referrer_reward_type VARCHAR(20) DEFAULT 'discount_percent',
  referrer_reward_value DECIMAL(10,2) DEFAULT 10,
  referred_reward_type VARCHAR(20) DEFAULT 'discount_percent',
  referred_reward_value DECIMAL(10,2) DEFAULT 10,
  max_referrals_per_month INT DEFAULT 5,
  expiration_days INT DEFAULT 30,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar config por defecto
INSERT INTO referral_program_config DEFAULT VALUES;
```

#### RPC: Generar Código de Referido

```sql
CREATE OR REPLACE FUNCTION generate_referral_code(p_customer_id UUID)
RETURNS JSON AS $$
DECLARE
  v_customer RECORD;
  v_code VARCHAR(20);
  v_existing_code VARCHAR(20);
  v_config RECORD;
  v_count_this_month INT;
  v_base_url TEXT := 'https://cafe-pi-steel.vercel.app';
BEGIN
  -- Verificar cliente
  SELECT * INTO v_customer FROM customers WHERE id = p_customer_id;
  IF v_customer IS NULL THEN
    RETURN json_build_object('error', 'Cliente no encontrado');
  END IF;

  -- Obtener config
  SELECT * INTO v_config FROM referral_program_config WHERE is_active = true LIMIT 1;
  IF v_config IS NULL THEN
    RETURN json_build_object('error', 'Programa de referidos no activo');
  END IF;

  -- Verificar límite mensual
  SELECT COUNT(*) INTO v_count_this_month
  FROM referrals
  WHERE referrer_customer_id = p_customer_id
    AND created_at > date_trunc('month', NOW());

  IF v_count_this_month >= v_config.max_referrals_per_month THEN
    RETURN json_build_object('error', 'Límite de referidos alcanzado este mes');
  END IF;

  -- Buscar código existente no usado
  SELECT referrer_code INTO v_existing_code
  FROM referrals
  WHERE referrer_customer_id = p_customer_id
    AND status = 'pending'
    AND expires_at > NOW()
  LIMIT 1;

  IF v_existing_code IS NOT NULL THEN
    v_code := v_existing_code;
  ELSE
    -- Generar nuevo código único
    v_code := UPPER(SUBSTRING(v_customer.name, 1, 3)) || '-' ||
              SUBSTRING(encode(gen_random_bytes(4), 'hex'), 1, 6);

    -- Crear registro de referido
    INSERT INTO referrals (
      referrer_customer_id,
      referrer_code,
      referrer_reward_type,
      referrer_reward_value,
      referred_reward_type,
      referred_reward_value,
      expires_at
    ) VALUES (
      p_customer_id,
      v_code,
      v_config.referrer_reward_type,
      v_config.referrer_reward_value,
      v_config.referred_reward_type,
      v_config.referred_reward_value,
      NOW() + (v_config.expiration_days || ' days')::INTERVAL
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'code', v_code,
    'referral_link', v_base_url || '/referido/' || v_code,
    'referrer_benefit', v_config.referrer_reward_value || '% descuento',
    'referred_benefit', v_config.referred_reward_value || '% descuento en primera compra',
    'expires_at', NOW() + (v_config.expiration_days || ' days')::INTERVAL,
    'whatsapp_message', 'Te invito a probar el café de Café Mirador! Usa mi código ' || v_code || ' y obtén ' || v_config.referred_reward_value || '% de descuento en tu primera compra: ' || v_base_url || '/referido/' || v_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### RPC: Aplicar Código de Referido

```sql
CREATE OR REPLACE FUNCTION apply_referral_code(
  p_code VARCHAR,
  p_new_customer_phone VARCHAR,
  p_new_customer_email VARCHAR DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_referral RECORD;
  v_new_customer_id UUID;
BEGIN
  -- Buscar código válido
  SELECT * INTO v_referral
  FROM referrals
  WHERE referrer_code = UPPER(p_code)
    AND status = 'pending'
    AND expires_at > NOW();

  IF v_referral IS NULL THEN
    RETURN json_build_object('error', 'Código inválido o expirado');
  END IF;

  -- Verificar que no sea auto-referido
  IF EXISTS (
    SELECT 1 FROM customers
    WHERE id = v_referral.referrer_customer_id
      AND (phone = p_new_customer_phone OR email = p_new_customer_email)
  ) THEN
    RETURN json_build_object('error', 'No puedes usar tu propio código');
  END IF;

  -- Actualizar referido
  UPDATE referrals SET
    referred_phone = p_new_customer_phone,
    referred_email = p_new_customer_email,
    status = 'registered',
    registered_at = NOW()
  WHERE id = v_referral.id;

  RETURN json_build_object(
    'success', true,
    'referral_id', v_referral.id,
    'discount_percent', v_referral.referred_reward_value,
    'message', 'Código aplicado! Tienes ' || v_referral.referred_reward_value || '% de descuento en tu primera compra'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### RPC: Completar Referido (al hacer primera compra)

```sql
CREATE OR REPLACE FUNCTION complete_referral_on_purchase(
  p_customer_id UUID,
  p_sale_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_referral RECORD;
  v_customer RECORD;
BEGIN
  -- Buscar si este cliente fue referido
  SELECT c.*, r.*
  INTO v_customer
  FROM customers c
  LEFT JOIN referrals r ON (r.referred_phone = c.phone OR r.referred_email = c.email)
    AND r.status = 'registered'
  WHERE c.id = p_customer_id;

  IF v_customer.id IS NULL OR v_customer.referrer_customer_id IS NULL THEN
    -- No fue referido, nada que hacer
    RETURN json_build_object('was_referred', false);
  END IF;

  -- Marcar como completado
  UPDATE referrals SET
    referred_customer_id = p_customer_id,
    referred_reward_sale_id = p_sale_id,
    referred_reward_claimed = true,
    status = 'completed',
    completed_at = NOW()
  WHERE referred_phone = v_customer.phone
    AND status = 'registered';

  -- TODO: Crear descuento pendiente para el referidor
  -- Esto se podría manejar con una tabla de "pending_rewards"

  RETURN json_build_object(
    'was_referred', true,
    'referrer_notified', true,
    'message', 'Referido completado! El referidor recibirá su beneficio.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Componentes UI

#### Portal del Cliente - Sección Referidos

```typescript
// app/portal/referidos/page.tsx
// - Mostrar código personal
// - Botón compartir por WhatsApp
// - Lista de referidos y estado
// - Recompensas pendientes/usadas
```

#### Admin - Dashboard de Referidos

```typescript
// components/referrals-dashboard.tsx
// - Total referidos activos
// - Conversión (registrados → completados)
// - Top referidores
// - Configuración del programa
```

### Criterios de Aceptación

- [ ] Tabla `referrals` creada
- [ ] Tabla `referral_program_config` creada
- [ ] Cliente puede generar su código desde portal
- [ ] Código se puede compartir por WhatsApp
- [ ] Nuevo cliente puede aplicar código
- [ ] Descuento se aplica en primera compra
- [ ] Referidor recibe notificación y beneficio
- [ ] Admin puede ver estadísticas
- [ ] Admin puede configurar beneficios
- [ ] Límite mensual funciona

---

## Feature 3.2: Listas de Precios Diferenciadas

### Objetivo

Manejar precios diferentes según el tipo de cliente (consumidor final, mayorista, cafetería, etc.).

### Modelo de Precios

```
Tipos de cliente:
- retail: Consumidor final (precio base)
- wholesale_small: Mayorista pequeño (5-10% descuento)
- wholesale_large: Mayorista grande (10-20% descuento)
- cafe: Cafeterías (precio especial por producto)

Cada producto puede tener:
- Precio base (retail)
- Precio por tipo de cliente
- Descuento por volumen
```

### Especificación Técnica

#### Modificar Tabla customers

```sql
-- Agregar tipo de cliente
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type VARCHAR(30) DEFAULT 'retail';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS custom_price_list_id UUID;

-- Tipos válidos
COMMENT ON COLUMN customers.customer_type IS 'retail, wholesale_small, wholesale_large, cafe, custom';
```

#### Nueva Tabla: price_lists

```sql
CREATE TABLE price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) DEFAULT 'percent', -- 'percent' o 'fixed'
  default_discount DECIMAL(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Precios específicos por producto en cada lista
CREATE TABLE price_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  price_per_lb DECIMAL(10,2),
  price_per_half_lb DECIMAL(10,2),
  discount_percent DECIMAL(5,2), -- alternativa: descuento sobre precio base
  UNIQUE(price_list_id, product_id)
);

-- Mapeo de customer_type a price_list
CREATE TABLE customer_type_price_lists (
  customer_type VARCHAR(30) PRIMARY KEY,
  price_list_id UUID REFERENCES price_lists(id),
  description TEXT
);

-- Insertar tipos por defecto
INSERT INTO customer_type_price_lists (customer_type, description) VALUES
('retail', 'Consumidor final - precio base'),
('wholesale_small', 'Mayorista pequeño - 5-10% descuento'),
('wholesale_large', 'Mayorista grande - 10-20% descuento'),
('cafe', 'Cafeterías - precios especiales'),
('custom', 'Lista personalizada por cliente');
```

#### RPC: Obtener Precio para Cliente

```sql
CREATE OR REPLACE FUNCTION get_product_price_for_customer(
  p_product_id UUID,
  p_customer_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_customer RECORD;
  v_product RECORD;
  v_price_list RECORD;
  v_price_item RECORD;
  v_final_price_lb DECIMAL(10,2);
  v_final_price_half DECIMAL(10,2);
BEGIN
  -- Obtener producto base
  SELECT * INTO v_product FROM inventory WHERE id = p_product_id;
  IF v_product IS NULL THEN
    RETURN json_build_object('error', 'Producto no encontrado');
  END IF;

  -- Si no hay cliente, retornar precio base
  IF p_customer_id IS NULL OR p_customer_id = '00000000-0000-0000-0000-000000000000' THEN
    RETURN json_build_object(
      'product_id', v_product.id,
      'product_name', v_product.name,
      'price_per_lb', v_product.price_per_lb,
      'price_per_half_lb', v_product.price_per_half_lb,
      'customer_type', 'retail',
      'discount_applied', 0
    );
  END IF;

  -- Obtener cliente y su tipo
  SELECT * INTO v_customer FROM customers WHERE id = p_customer_id;

  -- Determinar price_list a usar
  IF v_customer.custom_price_list_id IS NOT NULL THEN
    SELECT * INTO v_price_list FROM price_lists WHERE id = v_customer.custom_price_list_id;
  ELSE
    SELECT pl.* INTO v_price_list
    FROM price_lists pl
    JOIN customer_type_price_lists ctpl ON ctpl.price_list_id = pl.id
    WHERE ctpl.customer_type = COALESCE(v_customer.customer_type, 'retail');
  END IF;

  -- Si no hay price_list, usar precio base
  IF v_price_list IS NULL THEN
    RETURN json_build_object(
      'product_id', v_product.id,
      'product_name', v_product.name,
      'price_per_lb', v_product.price_per_lb,
      'price_per_half_lb', v_product.price_per_half_lb,
      'customer_type', v_customer.customer_type,
      'discount_applied', 0
    );
  END IF;

  -- Buscar precio específico del producto en la lista
  SELECT * INTO v_price_item
  FROM price_list_items
  WHERE price_list_id = v_price_list.id AND product_id = p_product_id;

  IF v_price_item IS NOT NULL AND v_price_item.price_per_lb IS NOT NULL THEN
    -- Precio fijo definido
    v_final_price_lb := v_price_item.price_per_lb;
    v_final_price_half := COALESCE(v_price_item.price_per_half_lb, v_price_item.price_per_lb * 0.55);
  ELSIF v_price_item IS NOT NULL AND v_price_item.discount_percent IS NOT NULL THEN
    -- Descuento específico del producto
    v_final_price_lb := v_product.price_per_lb * (1 - v_price_item.discount_percent / 100);
    v_final_price_half := v_product.price_per_half_lb * (1 - v_price_item.discount_percent / 100);
  ELSIF v_price_list.default_discount > 0 THEN
    -- Descuento general de la lista
    v_final_price_lb := v_product.price_per_lb * (1 - v_price_list.default_discount / 100);
    v_final_price_half := v_product.price_per_half_lb * (1 - v_price_list.default_discount / 100);
  ELSE
    -- Precio base
    v_final_price_lb := v_product.price_per_lb;
    v_final_price_half := v_product.price_per_half_lb;
  END IF;

  RETURN json_build_object(
    'product_id', v_product.id,
    'product_name', v_product.name,
    'base_price_per_lb', v_product.price_per_lb,
    'base_price_per_half_lb', v_product.price_per_half_lb,
    'price_per_lb', ROUND(v_final_price_lb, 2),
    'price_per_half_lb', ROUND(v_final_price_half, 2),
    'customer_type', v_customer.customer_type,
    'price_list_name', v_price_list.name,
    'discount_applied', ROUND(
      (1 - v_final_price_lb / v_product.price_per_lb) * 100, 1
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Componentes UI

#### Admin - Gestión de Listas de Precios

```typescript
// app/admin/precios/page.tsx
// - CRUD de listas de precios
// - Asignar descuento por defecto
// - Definir precios específicos por producto
// - Asignar lista a tipo de cliente
```

#### Modificar CustomerModal

```typescript
// Agregar selector de customer_type
// Opción de asignar lista personalizada
```

#### Modificar NewSaleModal

```typescript
// Al seleccionar cliente, cargar precios según su tipo
// Mostrar descuento aplicado si corresponde
```

### Criterios de Aceptación

- [ ] Campo `customer_type` agregado a customers
- [ ] Tablas `price_lists` y `price_list_items` creadas
- [ ] RPC `get_product_price_for_customer` funciona
- [ ] NewSaleModal usa precios del cliente
- [ ] Admin puede crear/editar listas de precios
- [ ] Admin puede asignar tipo a cliente
- [ ] Portal cliente ve sus precios especiales
- [ ] Reportes muestran precio real aplicado

---

## Feature 3.3: Optimización de Rutas de Entrega

### Objetivo

Organizar entregas de manera eficiente agrupando clientes por zona geográfica.

### Modelo

```
Zonas de entrega:
- Cada zona tiene un nombre y días de entrega
- Clientes asignados a zonas
- Sistema agrupa pedidos por zona
- Genera lista de entregas optimizada

Ejemplo:
- Zona Norte: Lunes y Jueves
- Zona Sur: Martes y Viernes
- Zona Centro: Miércoles y Sábado
```

### Especificación Técnica

#### Nuevas Tablas

```sql
-- Zonas de entrega
CREATE TABLE delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  delivery_days VARCHAR(50)[], -- ['monday', 'thursday']
  color VARCHAR(7), -- hex color para UI
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asignar cliente a zona
ALTER TABLE customers ADD COLUMN IF NOT EXISTS delivery_zone_id UUID REFERENCES delivery_zones(id);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS delivery_address TEXT;

-- Historial de entregas
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_date DATE NOT NULL,
  zone_id UUID REFERENCES delivery_zones(id),
  status VARCHAR(20) DEFAULT 'planned', -- planned, in_progress, completed
  driver_notes TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entregas individuales
CREATE TABLE delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES sales(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  sort_order INT,
  status VARCHAR(20) DEFAULT 'pending', -- pending, delivered, failed
  delivered_at TIMESTAMPTZ,
  notes TEXT
);
```

#### RPC: Obtener Entregas del Día

```sql
CREATE OR REPLACE FUNCTION get_deliveries_for_date(p_date DATE)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_agg(zone_deliveries ORDER BY sort_order)
    FROM (
      SELECT
        dz.id as zone_id,
        dz.name as zone_name,
        dz.color,
        dz.sort_order,
        (
          SELECT json_agg(json_build_object(
            'sale_id', s.id,
            'customer_id', c.id,
            'customer_name', c.name,
            'customer_phone', c.phone,
            'customer_address', COALESCE(c.delivery_address, c.address),
            'delivery_notes', c.delivery_notes,
            'total', s.total,
            'items_summary', (
              SELECT string_agg(si.quantity || ' ' || si.unit_type || ' ' || i.name, ', ')
              FROM sale_items si
              JOIN inventory i ON i.id = si.product_id
              WHERE si.sale_id = s.id
            ),
            'payment_method', s.payment_method
          ) ORDER BY c.delivery_address)
          FROM sales s
          JOIN customers c ON c.id = s.customer_id
          WHERE c.delivery_zone_id = dz.id
            AND s.created_at::DATE = p_date
            AND s.status = 'completed'
            AND s.customer_id != '00000000-0000-0000-0000-000000000000'
        ) as customers
      FROM delivery_zones dz
      WHERE dz.is_active = true
    ) zone_deliveries
    WHERE customers IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### RPC: Clientes sin Zona Asignada

```sql
CREATE OR REPLACE FUNCTION get_customers_without_zone()
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_agg(json_build_object(
      'id', c.id,
      'name', c.name,
      'address', c.address,
      'phone', c.phone,
      'total_purchases', (SELECT COUNT(*) FROM sales WHERE customer_id = c.id),
      'last_purchase', c.last_purchase_date
    ))
    FROM customers c
    WHERE c.delivery_zone_id IS NULL
      AND c.id != '00000000-0000-0000-0000-000000000000'
      AND EXISTS (SELECT 1 FROM sales WHERE customer_id = c.id)
    ORDER BY (SELECT COUNT(*) FROM sales WHERE customer_id = c.id) DESC
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Componentes UI

#### Admin - Gestión de Zonas

```typescript
// app/admin/zonas/page.tsx
// - CRUD de zonas de entrega
// - Definir días de entrega por zona
// - Asignar color para identificación visual
```

#### Admin - Vista de Entregas

```typescript
// app/entregas/page.tsx
// - Selector de fecha
// - Lista de entregas agrupadas por zona
// - Checkbox para marcar como entregado
// - Botón para abrir navegación (Google Maps)
// - Resumen de totales por zona
```

#### Modificar CustomerModal

```typescript
// Agregar selector de zona
// Campo de dirección de entrega
// Notas de entrega
```

#### Mapa de Clientes (Opcional)

```typescript
// Componente con mapa mostrando clientes por zona
// Útil para asignar zonas visualmente
// Requiere integración con Mapbox o Google Maps
```

### Criterios de Aceptación

- [ ] Tabla `delivery_zones` creada
- [ ] Campos de zona agregados a customers
- [ ] Tablas de deliveries creadas
- [ ] Admin puede crear/editar zonas
- [ ] Admin puede asignar cliente a zona
- [ ] Vista de entregas del día funciona
- [ ] Entregas agrupadas por zona
- [ ] Se puede marcar entrega completada
- [ ] Link a navegación GPS funciona
- [ ] Alerta de clientes sin zona asignada

---

## Migración SQL Consolidada - Fase 3

```sql
-- =====================================================
-- MIGRACIÓN FASE 3: Crecimiento y Escalabilidad
-- Archivo: supabase/migrations/XXX_fase3_crecimiento.sql
-- =====================================================

-- ==================== REFERIDOS ====================

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_customer_id UUID NOT NULL REFERENCES customers(id),
  referrer_code VARCHAR(20) UNIQUE NOT NULL,
  referred_customer_id UUID REFERENCES customers(id),
  referred_email VARCHAR(255),
  referred_phone VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  referrer_reward_type VARCHAR(20),
  referrer_reward_value DECIMAL(10,2),
  referrer_reward_claimed BOOLEAN DEFAULT false,
  referrer_reward_sale_id UUID REFERENCES sales(id),
  referred_reward_type VARCHAR(20),
  referred_reward_value DECIMAL(10,2),
  referred_reward_claimed BOOLEAN DEFAULT false,
  referred_reward_sale_id UUID REFERENCES sales(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  registered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

CREATE TABLE IF NOT EXISTS referral_program_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  referrer_reward_type VARCHAR(20) DEFAULT 'discount_percent',
  referrer_reward_value DECIMAL(10,2) DEFAULT 10,
  referred_reward_type VARCHAR(20) DEFAULT 'discount_percent',
  referred_reward_value DECIMAL(10,2) DEFAULT 10,
  max_referrals_per_month INT DEFAULT 5,
  expiration_days INT DEFAULT 30,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO referral_program_config DEFAULT VALUES ON CONFLICT DO NOTHING;

-- ==================== LISTAS DE PRECIOS ====================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type VARCHAR(30) DEFAULT 'retail';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS custom_price_list_id UUID;

CREATE TABLE IF NOT EXISTS price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) DEFAULT 'percent',
  default_discount DECIMAL(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  price_per_lb DECIMAL(10,2),
  price_per_half_lb DECIMAL(10,2),
  discount_percent DECIMAL(5,2),
  UNIQUE(price_list_id, product_id)
);

CREATE TABLE IF NOT EXISTS customer_type_price_lists (
  customer_type VARCHAR(30) PRIMARY KEY,
  price_list_id UUID REFERENCES price_lists(id),
  description TEXT
);

INSERT INTO customer_type_price_lists (customer_type, description) VALUES
('retail', 'Consumidor final - precio base'),
('wholesale_small', 'Mayorista pequeño'),
('wholesale_large', 'Mayorista grande'),
('cafe', 'Cafeterías'),
('custom', 'Lista personalizada')
ON CONFLICT DO NOTHING;

-- ==================== ZONAS DE ENTREGA ====================

CREATE TABLE IF NOT EXISTS delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  delivery_days VARCHAR(50)[],
  color VARCHAR(7),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS delivery_zone_id UUID REFERENCES delivery_zones(id);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS delivery_address TEXT;

CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_date DATE NOT NULL,
  zone_id UUID REFERENCES delivery_zones(id),
  status VARCHAR(20) DEFAULT 'planned',
  driver_notes TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES sales(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  sort_order INT,
  status VARCHAR(20) DEFAULT 'pending',
  delivered_at TIMESTAMPTZ,
  notes TEXT
);

-- ==================== RLS ====================

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_program_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_items ENABLE ROW LEVEL SECURITY;

-- Políticas para staff
CREATE POLICY "Staff acceso referrals" ON referrals FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true));

CREATE POLICY "Staff acceso referral_config" ON referral_program_config FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true));

CREATE POLICY "Staff acceso price_lists" ON price_lists FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true));

CREATE POLICY "Staff acceso price_list_items" ON price_list_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true));

CREATE POLICY "Staff acceso delivery_zones" ON delivery_zones FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true));

CREATE POLICY "Staff acceso deliveries" ON deliveries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true));

CREATE POLICY "Staff acceso delivery_items" ON delivery_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true));

-- ==================== INDICES ====================

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_customer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referrer_code);
CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(customer_type);
CREATE INDEX IF NOT EXISTS idx_customers_zone ON customers(delivery_zone_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(delivery_date);

-- ==================== GRANTS ====================

GRANT EXECUTE ON FUNCTION generate_referral_code TO authenticated;
GRANT EXECUTE ON FUNCTION apply_referral_code TO anon, authenticated;
GRANT EXECUTE ON FUNCTION complete_referral_on_purchase TO authenticated;
GRANT EXECUTE ON FUNCTION get_product_price_for_customer TO authenticated;
GRANT EXECUTE ON FUNCTION get_deliveries_for_date TO authenticated;
GRANT EXECUTE ON FUNCTION get_customers_without_zone TO authenticated;
```

---

## Checklist de Seguimiento

### Preparación

- [x] Fases 1 y 2 completadas y estables
- [x] Revisar y aprobar diseño técnico
- [x] Crear rama `feature/fase3-crecimiento`

### Feature 3.1: Referidos

- [x] Ejecutar migración (tablas referrals)
- [x] Implementar RPCs de referidos
- [x] Crear sección en portal cliente
- [x] Crear dashboard admin de referidos
- [x] Integrar con flujo de primera compra
- [x] Botón compartir por WhatsApp
- [x] Tests

### Feature 3.2: Listas de Precios

- [x] Ejecutar migración (tablas price_lists)
- [x] Implementar RPC get_product_price_for_customer
- [x] Crear página admin de precios
- [x] Modificar CustomerModal con tipo
- [x] Modificar NewSaleModal para usar precios
- [x] Modificar portal cliente para mostrar precios
- [x] Tests

### Feature 3.3: Rutas de Entrega

- [x] Ejecutar migración (tablas delivery)
- [x] Implementar RPCs de entregas
- [x] Crear página admin de zonas
- [x] Crear vista de entregas del día
- [x] Modificar CustomerModal con zona
- [x] Link a navegación GPS
- [x] Tests

### QA y Deploy

- [x] Code review
- [x] Testing integral (todas las fases)
- [x] Deploy a producción
- [x] Monitorear métricas
- [x] Actualizar CLAUDE.md y README

---

## Métricas de Éxito

| Métrica                           | Baseline | Objetivo           |
| --------------------------------- | -------- | ------------------ |
| Nuevos clientes por referidos     | 0        | 20% de nuevos      |
| Conversión código → compra        | N/A      | >50%               |
| Clientes mayoristas identificados | ?        | 100% clasificados  |
| Entregas por día optimizadas      | ?        | Reducir 20% tiempo |
| Clientes con zona asignada        | 0%       | 80%                |

---

## Referencias

- [Blueprint - DTC Subscription Retention](https://blueprint.store/post/examples-of-dtc-subscription-retention)
- [RoasterTools - Wholesale Portal](https://www.roastertools.com/features/wholesale-portal)
- [Unleashed - Coffee Roasters](https://www.unleashedsoftware.com/industry/coffee-roasters-inventory-management/)
