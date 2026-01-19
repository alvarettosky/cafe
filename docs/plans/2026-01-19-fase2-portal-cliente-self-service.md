# Fase 2: Portal de Cliente Self-Service

> **Estado**: 🔵 Pendiente (requiere Fase 1)
> **Prioridad**: Alta
> **Dependencias**: Fase 1 completada
> **Prerequisito**: Sistema de autenticación para clientes

---

## Resumen Ejecutivo

Crear un portal donde los clientes puedan:

1. Ver su historial de compras
2. Hacer pedidos sin necesidad de llamar/escribir
3. Configurar suscripciones automáticas
4. Gestionar sus preferencias

**Impacto esperado**: [RoasterTools](https://www.roastertools.com/features/wholesale-portal) reporta que pedidos online tienen **50% más valor** que pedidos manuales, y reduce carga operativa del equipo.

---

## Decisiones de Arquitectura

### Autenticación de Clientes

**Opción A: Magic Links (Recomendada)**

- Cliente recibe link por WhatsApp/email
- Click en link lo autentica automáticamente
- No necesita recordar contraseña
- Similar a como lo hace [RoasterTools](https://www.roastertools.com/features/wholesale-portal)

**Opción B: Autenticación completa con Supabase Auth**

- Clientes crean cuenta con email/password
- Más complejo pero más robusto
- Requiere flujo de registro separado

**Decisión**: Usar **Magic Links** por simplicidad y mejor UX para clientes no técnicos.

### Separación de Roles

```
Usuarios actuales (profiles):
├── admin     → Dashboard completo, inventario, aprobar usuarios
└── seller    → Ventas, clientes, contactos

Nuevos usuarios (customer_auth):
└── customer  → Solo su portal personal
```

---

## Feature 2.1: Autenticación de Clientes con Magic Links

### Objetivo

Permitir que clientes accedan a su portal sin contraseña, usando links únicos enviados por WhatsApp.

### Flujo de Usuario

```
1. Cliente pide acceso (o vendedor lo invita)
2. Sistema genera magic link único
3. Link se envía por WhatsApp
4. Cliente hace click → accede a su portal
5. Link expira en 24 horas (configurable)
6. Sesión dura 30 días
```

### Especificación Técnica

#### Nueva Tabla: customer_auth

```sql
CREATE TABLE customer_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Magic link
  magic_token VARCHAR(64) UNIQUE,
  magic_token_expires_at TIMESTAMPTZ,

  -- Sesión
  session_token VARCHAR(64) UNIQUE,
  session_expires_at TIMESTAMPTZ,

  -- Metadata
  last_login_at TIMESTAMPTZ,
  login_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(customer_id)
);

-- Índices
CREATE INDEX idx_customer_auth_magic_token ON customer_auth(magic_token) WHERE magic_token IS NOT NULL;
CREATE INDEX idx_customer_auth_session_token ON customer_auth(session_token) WHERE session_token IS NOT NULL;
```

#### RPC: Generar Magic Link

```sql
CREATE OR REPLACE FUNCTION generate_customer_magic_link(p_customer_id UUID)
RETURNS JSON AS $$
DECLARE
  v_token VARCHAR(64);
  v_customer RECORD;
  v_base_url TEXT := 'https://cafe-pi-steel.vercel.app'; -- Configurar según ambiente
BEGIN
  -- Verificar que el cliente existe
  SELECT * INTO v_customer FROM customers WHERE id = p_customer_id;
  IF v_customer IS NULL THEN
    RETURN json_build_object('error', 'Cliente no encontrado');
  END IF;

  -- Generar token único
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Crear o actualizar auth del cliente
  INSERT INTO customer_auth (customer_id, magic_token, magic_token_expires_at)
  VALUES (p_customer_id, v_token, NOW() + INTERVAL '24 hours')
  ON CONFLICT (customer_id) DO UPDATE SET
    magic_token = v_token,
    magic_token_expires_at = NOW() + INTERVAL '24 hours';

  RETURN json_build_object(
    'success', true,
    'magic_link', v_base_url || '/portal/auth?token=' || v_token,
    'expires_at', NOW() + INTERVAL '24 hours',
    'customer_name', v_customer.name,
    'customer_phone', v_customer.phone,
    'whatsapp_message', 'Hola ' || v_customer.name || '! Aquí está tu acceso al portal de Café Mirador: ' || v_base_url || '/portal/auth?token=' || v_token || ' (válido por 24 horas)'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### RPC: Validar Magic Link y Crear Sesión

```sql
CREATE OR REPLACE FUNCTION validate_customer_magic_link(p_token VARCHAR)
RETURNS JSON AS $$
DECLARE
  v_auth RECORD;
  v_customer RECORD;
  v_session_token VARCHAR(64);
BEGIN
  -- Buscar token válido
  SELECT ca.*, c.name as customer_name, c.phone as customer_phone
  INTO v_auth
  FROM customer_auth ca
  JOIN customers c ON c.id = ca.customer_id
  WHERE ca.magic_token = p_token
    AND ca.magic_token_expires_at > NOW();

  IF v_auth IS NULL THEN
    RETURN json_build_object('error', 'Link inválido o expirado');
  END IF;

  -- Generar token de sesión
  v_session_token := encode(gen_random_bytes(32), 'hex');

  -- Actualizar auth: limpiar magic token, crear sesión
  UPDATE customer_auth SET
    magic_token = NULL,
    magic_token_expires_at = NULL,
    session_token = v_session_token,
    session_expires_at = NOW() + INTERVAL '30 days',
    last_login_at = NOW(),
    login_count = login_count + 1
  WHERE id = v_auth.id;

  RETURN json_build_object(
    'success', true,
    'session_token', v_session_token,
    'customer_id', v_auth.customer_id,
    'customer_name', v_auth.customer_name,
    'expires_at', NOW() + INTERVAL '30 days'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### RPC: Validar Sesión de Cliente

```sql
CREATE OR REPLACE FUNCTION validate_customer_session(p_session_token VARCHAR)
RETURNS JSON AS $$
DECLARE
  v_auth RECORD;
  v_customer RECORD;
BEGIN
  SELECT ca.*, c.*
  INTO v_auth
  FROM customer_auth ca
  JOIN customers c ON c.id = ca.customer_id
  WHERE ca.session_token = p_session_token
    AND ca.session_expires_at > NOW();

  IF v_auth IS NULL THEN
    RETURN json_build_object('valid', false);
  END IF;

  RETURN json_build_object(
    'valid', true,
    'customer_id', v_auth.customer_id,
    'customer_name', v_auth.name,
    'customer_phone', v_auth.phone,
    'customer_email', v_auth.email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Componentes React

#### Context para Cliente

```typescript
// context/customer-portal-context.tsx
interface CustomerPortalContextType {
  customer: CustomerPortalUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
}

// Almacena session_token en localStorage
// Valida sesión al cargar
// Proporciona datos del cliente a toda la app del portal
```

#### Página de Auth

```typescript
// app/portal/auth/page.tsx
// 1. Lee ?token= de URL
// 2. Llama validate_customer_magic_link
// 3. Si éxito: guarda session_token, redirect a /portal
// 4. Si error: muestra mensaje y opción de solicitar nuevo link
```

### Criterios de Aceptación

- [ ] Tabla `customer_auth` creada
- [ ] RPC `generate_customer_magic_link` funcionando
- [ ] RPC `validate_customer_magic_link` funcionando
- [ ] RPC `validate_customer_session` funcionando
- [ ] Página `/portal/auth` procesa magic links
- [ ] Sesión persiste 30 días
- [ ] Vendedor puede generar link desde `/clientes`
- [ ] Link se puede enviar por WhatsApp con un click

---

## Feature 2.2: Portal del Cliente - Historial y Pedidos

### Objetivo

Dashboard personal donde el cliente ve su historial y puede hacer pedidos.

### Páginas del Portal

```
/portal                 → Dashboard (resumen + acciones rápidas)
/portal/pedidos         → Historial de pedidos
/portal/nuevo-pedido    → Crear nuevo pedido
/portal/perfil          → Editar datos personales
```

### Diseño de UI

#### Dashboard (/portal)

```
┌─────────────────────────────────────────────────────────┐
│  🏠 Café Mirador                        [Mi Perfil] [X] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Hola, {nombre}! 👋                                     │
│                                                         │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │ Último pedido   │  │ Próximo pedido  │              │
│  │ hace 12 días    │  │ en ~3 días      │              │
│  │                 │  │                 │              │
│  │ 2 lb Colombia   │  │ [Pedir ahora]   │              │
│  │ $45.00          │  │                 │              │
│  │                 │  │                 │              │
│  │ [Repetir]       │  │                 │              │
│  └─────────────────┘  └─────────────────┘              │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Mis pedidos recientes                    [Ver todos]││
│  ├─────────────────────────────────────────────────────┤│
│  │ 7 ene 2026  │ 2 lb Colombia      │ $45.00 │ ✓      ││
│  │ 22 dic 2025 │ 1 lb Huila, 1 lb.. │ $50.00 │ ✓      ││
│  │ 8 dic 2025  │ 2 lb Colombia      │ $45.00 │ ✓      ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │ 💬 ¿Necesitas ayuda?                                ││
│  │ [Escribir por WhatsApp]                             ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Especificación Técnica

#### RPC: Obtener Dashboard del Cliente

```sql
CREATE OR REPLACE FUNCTION get_customer_portal_dashboard(p_customer_id UUID)
RETURNS JSON AS $$
DECLARE
  v_customer RECORD;
  v_last_sale RECORD;
  v_recent_sales JSON;
  v_days_since_purchase INT;
  v_days_until_next INT;
BEGIN
  -- Datos del cliente
  SELECT * INTO v_customer FROM customers WHERE id = p_customer_id;

  -- Última venta con items
  SELECT
    s.*,
    (SELECT json_agg(json_build_object(
      'product_name', i.name,
      'quantity', si.quantity,
      'unit_type', si.unit_type,
      'unit_price', si.unit_price
    ))
    FROM sale_items si
    JOIN inventory i ON i.id = si.product_id
    WHERE si.sale_id = s.id) as items
  INTO v_last_sale
  FROM sales s
  WHERE s.customer_id = p_customer_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- Ventas recientes (últimas 5)
  SELECT json_agg(sale_data)
  INTO v_recent_sales
  FROM (
    SELECT
      s.id,
      s.created_at,
      s.total,
      s.payment_method,
      (SELECT string_agg(
        si.quantity || ' ' || si.unit_type || ' ' || i.name, ', '
      )
      FROM sale_items si
      JOIN inventory i ON i.id = si.product_id
      WHERE si.sale_id = s.id) as items_summary
    FROM sales s
    WHERE s.customer_id = p_customer_id
    ORDER BY s.created_at DESC
    LIMIT 5
  ) sale_data;

  -- Calcular días
  v_days_since_purchase := EXTRACT(DAY FROM NOW() - v_customer.last_purchase_date)::INT;
  v_days_until_next := COALESCE(v_customer.typical_recurrence_days, 15) - v_days_since_purchase;

  RETURN json_build_object(
    'customer', json_build_object(
      'id', v_customer.id,
      'name', v_customer.name,
      'phone', v_customer.phone,
      'email', v_customer.email,
      'typical_recurrence_days', v_customer.typical_recurrence_days
    ),
    'last_sale', CASE WHEN v_last_sale IS NOT NULL THEN json_build_object(
      'id', v_last_sale.id,
      'created_at', v_last_sale.created_at,
      'total', v_last_sale.total,
      'items', v_last_sale.items
    ) ELSE NULL END,
    'days_since_purchase', v_days_since_purchase,
    'days_until_next', v_days_until_next,
    'recent_sales', COALESCE(v_recent_sales, '[]'::JSON),
    'status', CASE
      WHEN v_days_until_next > 3 THEN 'ok'
      WHEN v_days_until_next > 0 THEN 'soon'
      ELSE 'due'
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### RPC: Productos Disponibles para Cliente

```sql
CREATE OR REPLACE FUNCTION get_products_for_customer_order()
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_agg(json_build_object(
      'id', id,
      'name', name,
      'price_per_lb', price_per_lb,
      'price_per_half_lb', price_per_half_lb,
      'stock_kg', stock_kg,
      'available', stock_kg > 0.5
    ))
    FROM inventory
    WHERE stock_kg > 0
    ORDER BY name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### RPC: Cliente Crea Pedido

```sql
CREATE OR REPLACE FUNCTION create_customer_order(
  p_customer_id UUID,
  p_items JSON, -- [{product_id, quantity, unit_type}]
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_item RECORD;
  v_product RECORD;
  v_total DECIMAL(10,2) := 0;
  v_sale_id UUID;
  v_items_processed JSON;
BEGIN
  -- Validar cliente
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id) THEN
    RETURN json_build_object('error', 'Cliente no válido');
  END IF;

  -- Validar y calcular total
  FOR v_item IN SELECT * FROM json_to_recordset(p_items) AS x(product_id UUID, quantity INT, unit_type VARCHAR)
  LOOP
    SELECT * INTO v_product FROM inventory WHERE id = v_item.product_id;

    IF v_product IS NULL THEN
      RETURN json_build_object('error', 'Producto no encontrado: ' || v_item.product_id);
    END IF;

    -- Verificar stock
    IF v_item.unit_type = 'lb' AND v_product.stock_kg < (v_item.quantity * 0.4536) THEN
      RETURN json_build_object('error', 'Stock insuficiente de ' || v_product.name);
    END IF;

    -- Sumar al total
    IF v_item.unit_type = 'lb' THEN
      v_total := v_total + (v_item.quantity * v_product.price_per_lb);
    ELSE
      v_total := v_total + (v_item.quantity * v_product.price_per_half_lb);
    END IF;
  END LOOP;

  -- Crear venta usando RPC existente (reutilizar lógica)
  -- Nota: Esto podría llamar a process_coffee_sale internamente
  -- o crear la venta con estado 'pending' para aprobación

  -- Por ahora, crear como venta pendiente de confirmación
  INSERT INTO sales (customer_id, total, payment_method, notes, status)
  VALUES (p_customer_id, v_total, 'pending', p_notes, 'pending_confirmation')
  RETURNING id INTO v_sale_id;

  -- Insertar items
  INSERT INTO sale_items (sale_id, product_id, quantity, unit_type, unit_price)
  SELECT
    v_sale_id,
    (x->>'product_id')::UUID,
    (x->>'quantity')::INT,
    x->>'unit_type',
    CASE
      WHEN x->>'unit_type' = 'lb' THEN (SELECT price_per_lb FROM inventory WHERE id = (x->>'product_id')::UUID)
      ELSE (SELECT price_per_half_lb FROM inventory WHERE id = (x->>'product_id')::UUID)
    END
  FROM json_array_elements(p_items) x;

  RETURN json_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'total', v_total,
    'message', 'Pedido recibido! Te confirmaremos pronto por WhatsApp.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Componentes React

```
app/portal/
├── layout.tsx              # Layout con CustomerPortalProvider
├── page.tsx                # Dashboard principal
├── pedidos/
│   └── page.tsx            # Historial completo
├── nuevo-pedido/
│   └── page.tsx            # Formulario de nuevo pedido
└── perfil/
    └── page.tsx            # Editar datos
```

### Criterios de Aceptación

- [ ] Ruta `/portal` protegida (requiere sesión de cliente)
- [ ] Dashboard muestra resumen correcto
- [ ] Botón "Repetir" funciona
- [ ] Lista de pedidos recientes correcta
- [ ] Página de historial completo paginada
- [ ] Formulario de nuevo pedido funcional
- [ ] Pedido crea registro en `sales`
- [ ] Notificación al equipo cuando hay pedido nuevo

---

## Feature 2.3: Sistema de Suscripción

### Objetivo

Permitir que clientes configuren pedidos automáticos recurrentes.

### Modelo de Suscripción

```
Cliente configura:
- Productos y cantidades
- Frecuencia (cada X días)
- Método de pago preferido
- Día de entrega preferido (opcional)

Sistema:
- Genera pedido automáticamente
- Notifica al cliente antes de generar
- Cliente puede pausar/saltar/cancelar
```

### Especificación Técnica

#### Nueva Tabla: customer_subscriptions

```sql
CREATE TABLE customer_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Configuración
  frequency_days INT NOT NULL DEFAULT 15,
  preferred_payment_method VARCHAR(50),
  preferred_delivery_day VARCHAR(20), -- 'monday', 'tuesday', etc.
  notes TEXT,

  -- Estado
  status VARCHAR(20) DEFAULT 'active', -- active, paused, cancelled
  paused_until DATE,

  -- Tracking
  next_order_date DATE,
  last_order_date DATE,
  total_orders_generated INT DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(customer_id)
);

-- Items de la suscripción
CREATE TABLE subscription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES customer_subscriptions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES inventory(id),
  quantity INT NOT NULL DEFAULT 1,
  unit_type VARCHAR(20) NOT NULL DEFAULT 'lb'
);
```

#### RPC: Crear/Actualizar Suscripción

```sql
CREATE OR REPLACE FUNCTION upsert_customer_subscription(
  p_customer_id UUID,
  p_frequency_days INT,
  p_items JSON, -- [{product_id, quantity, unit_type}]
  p_preferred_payment_method VARCHAR DEFAULT NULL,
  p_preferred_delivery_day VARCHAR DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_subscription_id UUID;
BEGIN
  -- Crear o actualizar suscripción
  INSERT INTO customer_subscriptions (
    customer_id,
    frequency_days,
    preferred_payment_method,
    preferred_delivery_day,
    next_order_date,
    status
  )
  VALUES (
    p_customer_id,
    p_frequency_days,
    p_preferred_payment_method,
    p_preferred_delivery_day,
    CURRENT_DATE + p_frequency_days,
    'active'
  )
  ON CONFLICT (customer_id) DO UPDATE SET
    frequency_days = EXCLUDED.frequency_days,
    preferred_payment_method = EXCLUDED.preferred_payment_method,
    preferred_delivery_day = EXCLUDED.preferred_delivery_day,
    next_order_date = CURRENT_DATE + EXCLUDED.frequency_days,
    status = 'active',
    updated_at = NOW()
  RETURNING id INTO v_subscription_id;

  -- Limpiar items anteriores
  DELETE FROM subscription_items WHERE subscription_id = v_subscription_id;

  -- Insertar nuevos items
  INSERT INTO subscription_items (subscription_id, product_id, quantity, unit_type)
  SELECT
    v_subscription_id,
    (x->>'product_id')::UUID,
    (x->>'quantity')::INT,
    COALESCE(x->>'unit_type', 'lb')
  FROM json_array_elements(p_items) x;

  RETURN json_build_object(
    'success', true,
    'subscription_id', v_subscription_id,
    'next_order_date', CURRENT_DATE + p_frequency_days,
    'message', 'Suscripción configurada! Tu próximo pedido será el ' || (CURRENT_DATE + p_frequency_days)::TEXT
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### RPC: Pausar/Reanudar Suscripción

```sql
CREATE OR REPLACE FUNCTION toggle_subscription_status(
  p_customer_id UUID,
  p_action VARCHAR -- 'pause', 'resume', 'skip_next', 'cancel'
)
RETURNS JSON AS $$
DECLARE
  v_subscription RECORD;
BEGIN
  SELECT * INTO v_subscription
  FROM customer_subscriptions
  WHERE customer_id = p_customer_id;

  IF v_subscription IS NULL THEN
    RETURN json_build_object('error', 'No tienes suscripción activa');
  END IF;

  CASE p_action
    WHEN 'pause' THEN
      UPDATE customer_subscriptions SET
        status = 'paused',
        updated_at = NOW()
      WHERE customer_id = p_customer_id;
      RETURN json_build_object('success', true, 'message', 'Suscripción pausada');

    WHEN 'resume' THEN
      UPDATE customer_subscriptions SET
        status = 'active',
        next_order_date = CURRENT_DATE + frequency_days,
        paused_until = NULL,
        updated_at = NOW()
      WHERE customer_id = p_customer_id;
      RETURN json_build_object('success', true, 'message', 'Suscripción reactivada');

    WHEN 'skip_next' THEN
      UPDATE customer_subscriptions SET
        next_order_date = next_order_date + frequency_days,
        updated_at = NOW()
      WHERE customer_id = p_customer_id;
      RETURN json_build_object('success', true, 'message', 'Próximo pedido saltado');

    WHEN 'cancel' THEN
      UPDATE customer_subscriptions SET
        status = 'cancelled',
        updated_at = NOW()
      WHERE customer_id = p_customer_id;
      RETURN json_build_object('success', true, 'message', 'Suscripción cancelada');

    ELSE
      RETURN json_build_object('error', 'Acción no válida');
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Cron Job / Edge Function: Procesar Suscripciones

```sql
-- Función para obtener suscripciones que deben generar pedido
CREATE OR REPLACE FUNCTION get_subscriptions_due_today()
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_agg(json_build_object(
      'subscription_id', cs.id,
      'customer_id', cs.customer_id,
      'customer_name', c.name,
      'customer_phone', c.phone,
      'frequency_days', cs.frequency_days,
      'items', (
        SELECT json_agg(json_build_object(
          'product_id', si.product_id,
          'product_name', i.name,
          'quantity', si.quantity,
          'unit_type', si.unit_type
        ))
        FROM subscription_items si
        JOIN inventory i ON i.id = si.product_id
        WHERE si.subscription_id = cs.id
      )
    ))
    FROM customer_subscriptions cs
    JOIN customers c ON c.id = cs.customer_id
    WHERE cs.status = 'active'
      AND cs.next_order_date <= CURRENT_DATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Criterios de Aceptación

- [ ] Tabla `customer_subscriptions` creada
- [ ] Tabla `subscription_items` creada
- [ ] RPC para crear suscripción funciona
- [ ] Cliente puede pausar/saltar/cancelar desde portal
- [ ] Sistema detecta suscripciones que toca procesar
- [ ] Notificación 1 día antes de generar pedido
- [ ] Opción de pausar por X días
- [ ] Estadísticas de suscripciones en dashboard admin

---

## Migración SQL Consolidada - Fase 2

```sql
-- =====================================================
-- MIGRACIÓN FASE 2: Portal de Cliente Self-Service
-- Archivo: supabase/migrations/XXX_fase2_portal_cliente.sql
-- =====================================================

-- 1. Autenticación de clientes
CREATE TABLE IF NOT EXISTS customer_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  magic_token VARCHAR(64) UNIQUE,
  magic_token_expires_at TIMESTAMPTZ,
  session_token VARCHAR(64) UNIQUE,
  session_expires_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  login_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id)
);

CREATE INDEX idx_customer_auth_magic_token ON customer_auth(magic_token) WHERE magic_token IS NOT NULL;
CREATE INDEX idx_customer_auth_session_token ON customer_auth(session_token) WHERE session_token IS NOT NULL;

-- 2. Suscripciones
CREATE TABLE IF NOT EXISTS customer_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  frequency_days INT NOT NULL DEFAULT 15,
  preferred_payment_method VARCHAR(50),
  preferred_delivery_day VARCHAR(20),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'active',
  paused_until DATE,
  next_order_date DATE,
  last_order_date DATE,
  total_orders_generated INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id)
);

CREATE TABLE IF NOT EXISTS subscription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES customer_subscriptions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES inventory(id),
  quantity INT NOT NULL DEFAULT 1,
  unit_type VARCHAR(20) NOT NULL DEFAULT 'lb'
);

-- 3. Agregar columna status a sales si no existe
ALTER TABLE sales ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4. RLS
ALTER TABLE customer_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_items ENABLE ROW LEVEL SECURITY;

-- Políticas para staff (pueden ver todo)
CREATE POLICY "Staff puede ver customer_auth" ON customer_auth
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true)
  );

CREATE POLICY "Staff puede ver suscripciones" ON customer_subscriptions
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true)
  );

CREATE POLICY "Staff puede ver subscription_items" ON subscription_items
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true)
  );

-- 5. Todas las RPCs (incluir código completo de arriba)
-- generate_customer_magic_link
-- validate_customer_magic_link
-- validate_customer_session
-- get_customer_portal_dashboard
-- get_products_for_customer_order
-- create_customer_order
-- upsert_customer_subscription
-- toggle_subscription_status
-- get_subscriptions_due_today

-- 6. Grants
GRANT EXECUTE ON FUNCTION generate_customer_magic_link TO authenticated;
GRANT EXECUTE ON FUNCTION validate_customer_magic_link TO anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_customer_session TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_customer_portal_dashboard TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_products_for_customer_order TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_customer_order TO anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_customer_subscription TO anon, authenticated;
GRANT EXECUTE ON FUNCTION toggle_subscription_status TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_subscriptions_due_today TO authenticated;
```

---

## Checklist de Seguimiento

### Preparación

- [ ] Revisar y aprobar diseño técnico
- [ ] Fase 1 completada y estable
- [ ] Crear rama `feature/fase2-portal-cliente`

### Base de Datos

- [ ] Crear migración SQL consolidada
- [ ] Ejecutar en Supabase (desarrollo)
- [ ] Verificar tabla `customer_auth`
- [ ] Verificar tablas de suscripción
- [ ] Verificar todas las RPCs

### Feature 2.1: Autenticación

- [ ] Crear `CustomerPortalContext`
- [ ] Crear página `/portal/auth`
- [ ] Crear botón "Generar acceso" en `/clientes`
- [ ] Verificar flujo completo de magic link
- [ ] Verificar persistencia de sesión
- [ ] Tests E2E del flujo de auth

### Feature 2.2: Portal del Cliente

- [ ] Crear layout de portal
- [ ] Crear página dashboard `/portal`
- [ ] Crear página historial `/portal/pedidos`
- [ ] Crear página nuevo pedido `/portal/nuevo-pedido`
- [ ] Crear página perfil `/portal/perfil`
- [ ] Botón "Repetir último pedido"
- [ ] Notificación a staff de pedido nuevo
- [ ] Tests E2E

### Feature 2.3: Suscripciones

- [ ] UI para configurar suscripción en portal
- [ ] Botones pausar/saltar/cancelar
- [ ] Vista de suscripciones en dashboard admin
- [ ] Cron/Edge function para procesar suscripciones
- [ ] Notificación pre-pedido a cliente
- [ ] Tests

### QA y Deploy

- [ ] Code review
- [ ] Testing en desarrollo
- [ ] Ejecutar migración en producción
- [ ] Deploy a Vercel
- [ ] Monitorear primeras suscripciones
- [ ] Actualizar CLAUDE.md

---

## Métricas de Éxito

| Métrica                         | Baseline | Objetivo    |
| ------------------------------- | -------- | ----------- |
| % clientes que usan portal      | 0%       | 30%         |
| Pedidos por portal vs manual    | 0%       | 40%         |
| Clientes con suscripción activa | 0        | 20% de base |
| Churn de suscripciones mensual  | N/A      | <10%        |

---

## Referencias

- [RoasterTools Wholesale Portal](https://www.roastertools.com/features/wholesale-portal)
- [CodingKart - Reduce Subscription Churn](https://codingkart.com/blogs/tactics-to-reduce-coffee-subscription-churn/)
- [Blueprint - DTC Subscription Retention](https://blueprint.store/post/examples-of-dtc-subscription-retention)
