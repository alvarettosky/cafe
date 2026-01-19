-- =====================================================
-- MIGRACIÓN FASE 2: Portal de Cliente Self-Service
-- Fecha: 2026-01-19
-- Descripción: Sistema de autenticación por magic links,
--              portal de cliente, y suscripciones
-- =====================================================

-- ============================================
-- 1. TABLA: Autenticación de Clientes
-- ============================================

CREATE TABLE IF NOT EXISTS customer_auth (
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

-- Índices para búsqueda rápida de tokens
CREATE INDEX IF NOT EXISTS idx_customer_auth_magic_token
  ON customer_auth(magic_token) WHERE magic_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_auth_session_token
  ON customer_auth(session_token) WHERE session_token IS NOT NULL;

-- ============================================
-- 2. COLUMNAS ADICIONALES EN SALES
-- ============================================

-- Agregar status para pedidos pendientes del portal
ALTER TABLE sales ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS notes TEXT;

-- Índice para filtrar por status
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);

-- ============================================
-- 3. TABLA: Suscripciones de Clientes
-- ============================================

CREATE TABLE IF NOT EXISTS customer_subscriptions (
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

CREATE TABLE IF NOT EXISTS subscription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES customer_subscriptions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES inventory(product_id),
  quantity INT NOT NULL DEFAULT 1,
  unit_type VARCHAR(20) NOT NULL DEFAULT 'libra' -- 'libra' o 'media_libra'
);

-- ============================================
-- 4. RPC: Generar Magic Link
-- ============================================

CREATE OR REPLACE FUNCTION generate_customer_magic_link(p_customer_id UUID)
RETURNS JSON AS $$
DECLARE
  v_token VARCHAR(64);
  v_customer RECORD;
  v_base_url TEXT := 'https://cafe-pi-steel.vercel.app';
BEGIN
  -- Verificar que el cliente existe
  SELECT * INTO v_customer FROM customers WHERE id = p_customer_id;
  IF v_customer IS NULL THEN
    RETURN json_build_object('error', 'Cliente no encontrado');
  END IF;

  -- Verificar que tiene teléfono para WhatsApp
  IF v_customer.phone IS NULL OR v_customer.phone = '' OR v_customer.phone = 'N/A' THEN
    RETURN json_build_object('error', 'Cliente no tiene teléfono registrado');
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
    'customer_name', v_customer.full_name,
    'customer_phone', v_customer.phone,
    'whatsapp_url', 'https://wa.me/' ||
      REGEXP_REPLACE(COALESCE(v_customer.phone, ''), '[^0-9]', '', 'g') ||
      '?text=' ||
      REPLACE(REPLACE(
        'Hola ' || v_customer.full_name || '! Aqui esta tu acceso al portal de Cafe Mirador: ' ||
        v_base_url || '/portal/auth?token=' || v_token || ' (valido por 24 horas)',
        ' ', '%20'
      ), E'\n', '%0A')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. RPC: Validar Magic Link y Crear Sesión
-- ============================================

CREATE OR REPLACE FUNCTION validate_customer_magic_link(p_token VARCHAR)
RETURNS JSON AS $$
DECLARE
  v_auth RECORD;
  v_session_token VARCHAR(64);
BEGIN
  -- Buscar token válido
  SELECT ca.*, c.full_name as customer_name, c.phone as customer_phone, c.email as customer_email
  INTO v_auth
  FROM customer_auth ca
  JOIN customers c ON c.id = ca.customer_id
  WHERE ca.magic_token = p_token
    AND ca.magic_token_expires_at > NOW();

  IF v_auth IS NULL THEN
    RETURN json_build_object('error', 'Link invalido o expirado');
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
    'customer_email', v_auth.customer_email,
    'expires_at', NOW() + INTERVAL '30 days'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. RPC: Validar Sesión de Cliente
-- ============================================

CREATE OR REPLACE FUNCTION validate_customer_session(p_session_token VARCHAR)
RETURNS JSON AS $$
DECLARE
  v_auth RECORD;
BEGIN
  SELECT
    ca.*,
    c.id as cust_id,
    c.full_name,
    c.phone,
    c.email,
    c.typical_recurrence_days,
    c.last_purchase_date
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
    'customer_id', v_auth.cust_id,
    'customer_name', v_auth.full_name,
    'customer_phone', v_auth.phone,
    'customer_email', v_auth.email,
    'typical_recurrence_days', v_auth.typical_recurrence_days,
    'last_purchase_date', v_auth.last_purchase_date
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. RPC: Cerrar Sesión de Cliente
-- ============================================

CREATE OR REPLACE FUNCTION logout_customer_session(p_session_token VARCHAR)
RETURNS JSON AS $$
BEGIN
  UPDATE customer_auth SET
    session_token = NULL,
    session_expires_at = NULL
  WHERE session_token = p_session_token;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. RPC: Dashboard del Portal de Cliente
-- ============================================

CREATE OR REPLACE FUNCTION get_customer_portal_dashboard(p_customer_id UUID)
RETURNS JSON AS $$
DECLARE
  v_customer RECORD;
  v_last_sale RECORD;
  v_recent_sales JSON;
  v_days_since_purchase INT;
  v_days_until_next INT;
  v_subscription RECORD;
BEGIN
  -- Datos del cliente
  SELECT * INTO v_customer FROM customers WHERE id = p_customer_id;

  IF v_customer IS NULL THEN
    RETURN json_build_object('error', 'Cliente no encontrado');
  END IF;

  -- Última venta con items
  SELECT
    s.id,
    s.created_at,
    s.total_amount,
    s.payment_method,
    (SELECT json_agg(json_build_object(
      'product_name', i.product_name,
      'quantity', si.quantity,
      'unit', si.unit,
      'price_per_unit', si.price_per_unit,
      'total_price', si.total_price
    ))
    FROM sale_items si
    JOIN inventory i ON i.product_id = si.product_id
    WHERE si.sale_id = s.id) as items
  INTO v_last_sale
  FROM sales s
  WHERE s.customer_id = p_customer_id
    AND (s.status IS NULL OR s.status = 'completed')
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- Ventas recientes (últimas 5)
  SELECT json_agg(sale_data ORDER BY created_at DESC)
  INTO v_recent_sales
  FROM (
    SELECT
      s.id,
      s.created_at,
      s.total_amount,
      s.payment_method,
      s.status,
      (SELECT string_agg(
        si.quantity || ' ' || si.unit || ' ' || i.product_name, ', '
      )
      FROM sale_items si
      JOIN inventory i ON i.product_id = si.product_id
      WHERE si.sale_id = s.id) as items_summary
    FROM sales s
    WHERE s.customer_id = p_customer_id
      AND (s.status IS NULL OR s.status = 'completed')
    ORDER BY s.created_at DESC
    LIMIT 5
  ) sale_data;

  -- Calcular días
  v_days_since_purchase := COALESCE(
    EXTRACT(DAY FROM NOW() - v_customer.last_purchase_date)::INT,
    NULL
  );
  v_days_until_next := CASE
    WHEN v_days_since_purchase IS NULL THEN NULL
    ELSE COALESCE(v_customer.typical_recurrence_days, 15) - v_days_since_purchase
  END;

  -- Suscripción activa
  SELECT * INTO v_subscription
  FROM customer_subscriptions
  WHERE customer_id = p_customer_id AND status = 'active';

  RETURN json_build_object(
    'customer', json_build_object(
      'id', v_customer.id,
      'name', v_customer.full_name,
      'phone', v_customer.phone,
      'email', v_customer.email,
      'address', v_customer.address,
      'typical_recurrence_days', v_customer.typical_recurrence_days
    ),
    'last_sale', CASE WHEN v_last_sale.id IS NOT NULL THEN json_build_object(
      'id', v_last_sale.id,
      'created_at', v_last_sale.created_at,
      'total_amount', v_last_sale.total_amount,
      'payment_method', v_last_sale.payment_method,
      'items', v_last_sale.items
    ) ELSE NULL END,
    'days_since_purchase', v_days_since_purchase,
    'days_until_next', v_days_until_next,
    'recent_sales', COALESCE(v_recent_sales, '[]'::JSON),
    'status', CASE
      WHEN v_days_until_next IS NULL THEN 'new'
      WHEN v_days_until_next > 3 THEN 'ok'
      WHEN v_days_until_next > 0 THEN 'soon'
      ELSE 'due'
    END,
    'has_subscription', v_subscription IS NOT NULL,
    'subscription', CASE WHEN v_subscription IS NOT NULL THEN json_build_object(
      'id', v_subscription.id,
      'frequency_days', v_subscription.frequency_days,
      'next_order_date', v_subscription.next_order_date,
      'status', v_subscription.status
    ) ELSE NULL END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. RPC: Historial Completo de Pedidos
-- ============================================

CREATE OR REPLACE FUNCTION get_customer_order_history(
  p_customer_id UUID,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
  v_orders JSON;
  v_total INT;
BEGIN
  -- Contar total
  SELECT COUNT(*) INTO v_total
  FROM sales
  WHERE customer_id = p_customer_id
    AND (status IS NULL OR status IN ('completed', 'pending_confirmation'));

  -- Obtener pedidos
  SELECT json_agg(order_data)
  INTO v_orders
  FROM (
    SELECT
      s.id,
      s.created_at,
      s.total_amount,
      s.payment_method,
      s.status,
      s.notes,
      (SELECT json_agg(json_build_object(
        'product_name', i.product_name,
        'quantity', si.quantity,
        'unit', si.unit,
        'price_per_unit', si.price_per_unit,
        'total_price', si.total_price
      ))
      FROM sale_items si
      JOIN inventory i ON i.product_id = si.product_id
      WHERE si.sale_id = s.id) as items
    FROM sales s
    WHERE s.customer_id = p_customer_id
      AND (s.status IS NULL OR s.status IN ('completed', 'pending_confirmation'))
    ORDER BY s.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) order_data;

  RETURN json_build_object(
    'orders', COALESCE(v_orders, '[]'::JSON),
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. RPC: Productos Disponibles para Pedido
-- ============================================

CREATE OR REPLACE FUNCTION get_products_for_customer_order()
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_agg(json_build_object(
      'id', product_id,
      'name', product_name,
      'available', total_grams_available > 500 -- Más de 500g disponibles
    ))
    FROM inventory
    WHERE total_grams_available > 0
    ORDER BY product_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. RPC: Cliente Crea Pedido (Pendiente)
-- ============================================

CREATE OR REPLACE FUNCTION create_customer_order(
  p_customer_id UUID,
  p_items JSON, -- [{product_id, quantity, unit_type}]
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_item RECORD;
  v_product RECORD;
  v_sale_id UUID;
  v_items_summary TEXT := '';
BEGIN
  -- Validar cliente
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id) THEN
    RETURN json_build_object('error', 'Cliente no valido');
  END IF;

  -- Validar items
  IF p_items IS NULL OR json_array_length(p_items) = 0 THEN
    RETURN json_build_object('error', 'Debe seleccionar al menos un producto');
  END IF;

  -- Validar productos y stock
  FOR v_item IN SELECT * FROM json_to_recordset(p_items) AS x(product_id UUID, quantity INT, unit_type VARCHAR)
  LOOP
    SELECT * INTO v_product FROM inventory WHERE product_id = v_item.product_id;

    IF v_product IS NULL THEN
      RETURN json_build_object('error', 'Producto no encontrado');
    END IF;

    -- Verificar stock básico
    IF v_product.total_grams_available < 500 THEN
      RETURN json_build_object('error', 'Stock insuficiente de ' || v_product.product_name);
    END IF;

    -- Construir resumen
    v_items_summary := v_items_summary ||
      v_item.quantity || ' ' || v_item.unit_type || ' ' || v_product.product_name || ', ';
  END LOOP;

  -- Crear venta con status pending_confirmation (sin precio aún)
  INSERT INTO sales (customer_id, total_amount, payment_method, notes, status, created_at)
  VALUES (
    p_customer_id,
    0, -- Precio lo pone el staff al confirmar
    'pending',
    COALESCE(p_notes, '') || ' | Pedido desde portal: ' || RTRIM(v_items_summary, ', '),
    'pending_confirmation',
    NOW()
  )
  RETURNING id INTO v_sale_id;

  -- Insertar items (precio 0, se actualizará al confirmar)
  INSERT INTO sale_items (sale_id, product_id, quantity, unit, price_per_unit, total_price)
  SELECT
    v_sale_id,
    (x->>'product_id')::UUID,
    (x->>'quantity')::INT,
    COALESCE(x->>'unit_type', 'libra'),
    0, -- Precio lo pone el staff
    0
  FROM json_array_elements(p_items) x;

  RETURN json_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'message', 'Pedido recibido! Te confirmaremos pronto por WhatsApp con el precio y detalles de entrega.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 12. RPC: Obtener Pedidos Pendientes (Staff)
-- ============================================

CREATE OR REPLACE FUNCTION get_pending_customer_orders()
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_agg(json_build_object(
      'sale_id', s.id,
      'customer_id', s.customer_id,
      'customer_name', c.full_name,
      'customer_phone', c.phone,
      'created_at', s.created_at,
      'notes', s.notes,
      'items', (
        SELECT json_agg(json_build_object(
          'product_name', i.product_name,
          'quantity', si.quantity,
          'unit', si.unit
        ))
        FROM sale_items si
        JOIN inventory i ON i.product_id = si.product_id
        WHERE si.sale_id = s.id
      )
    ) ORDER BY s.created_at ASC)
    FROM sales s
    JOIN customers c ON c.id = s.customer_id
    WHERE s.status = 'pending_confirmation'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 13. RPC: Confirmar Pedido (Staff)
-- ============================================

CREATE OR REPLACE FUNCTION confirm_customer_order(
  p_sale_id UUID,
  p_items_with_prices JSON, -- [{sale_item_id, price_per_unit}]
  p_payment_method VARCHAR DEFAULT 'efectivo'
)
RETURNS JSON AS $$
DECLARE
  v_sale RECORD;
  v_total NUMERIC(10,2) := 0;
  v_item RECORD;
BEGIN
  -- Verificar que existe y está pendiente
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id AND status = 'pending_confirmation';
  IF v_sale IS NULL THEN
    RETURN json_build_object('error', 'Pedido no encontrado o ya procesado');
  END IF;

  -- Actualizar precios de items y calcular total
  FOR v_item IN SELECT * FROM json_to_recordset(p_items_with_prices) AS x(sale_item_id UUID, price_per_unit NUMERIC)
  LOOP
    UPDATE sale_items SET
      price_per_unit = v_item.price_per_unit,
      total_price = quantity * v_item.price_per_unit
    WHERE id = v_item.sale_item_id;

    SELECT total_price INTO v_item.price_per_unit FROM sale_items WHERE id = v_item.sale_item_id;
    v_total := v_total + COALESCE(v_item.price_per_unit, 0);
  END LOOP;

  -- Recalcular total desde items
  SELECT COALESCE(SUM(total_price), 0) INTO v_total FROM sale_items WHERE sale_id = p_sale_id;

  -- Actualizar venta
  UPDATE sales SET
    total_amount = v_total,
    payment_method = p_payment_method,
    status = 'completed'
  WHERE id = p_sale_id;

  -- Actualizar última compra del cliente
  UPDATE customers SET
    last_purchase_date = NOW()
  WHERE id = v_sale.customer_id;

  RETURN json_build_object(
    'success', true,
    'sale_id', p_sale_id,
    'total', v_total,
    'message', 'Pedido confirmado'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 14. RPC: Cancelar Pedido Pendiente
-- ============================================

CREATE OR REPLACE FUNCTION cancel_customer_order(p_sale_id UUID)
RETURNS JSON AS $$
DECLARE
  v_sale RECORD;
BEGIN
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id AND status = 'pending_confirmation';
  IF v_sale IS NULL THEN
    RETURN json_build_object('error', 'Pedido no encontrado o ya procesado');
  END IF;

  -- Eliminar items y venta
  DELETE FROM sale_items WHERE sale_id = p_sale_id;
  DELETE FROM sales WHERE id = p_sale_id;

  RETURN json_build_object('success', true, 'message', 'Pedido cancelado');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 15. RPC: Crear/Actualizar Suscripción
-- ============================================

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
  -- Validar frecuencia
  IF p_frequency_days < 7 OR p_frequency_days > 90 THEN
    RETURN json_build_object('error', 'La frecuencia debe ser entre 7 y 90 dias');
  END IF;

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
    paused_until = NULL,
    updated_at = NOW()
  RETURNING id INTO v_subscription_id;

  -- Limpiar items anteriores
  DELETE FROM subscription_items WHERE subscription_id = v_subscription_id;

  -- Insertar nuevos items
  INSERT INTO subscription_items (subscription_id, product_id, quantity, unit_type)
  SELECT
    v_subscription_id,
    (x->>'product_id')::UUID,
    COALESCE((x->>'quantity')::INT, 1),
    COALESCE(x->>'unit_type', 'libra')
  FROM json_array_elements(p_items) x;

  RETURN json_build_object(
    'success', true,
    'subscription_id', v_subscription_id,
    'next_order_date', CURRENT_DATE + p_frequency_days,
    'message', 'Suscripcion configurada! Tu proximo pedido sera el ' || (CURRENT_DATE + p_frequency_days)::TEXT
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 16. RPC: Control de Suscripción
-- ============================================

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
    RETURN json_build_object('error', 'No tienes suscripcion activa');
  END IF;

  CASE p_action
    WHEN 'pause' THEN
      UPDATE customer_subscriptions SET
        status = 'paused',
        updated_at = NOW()
      WHERE customer_id = p_customer_id;
      RETURN json_build_object('success', true, 'message', 'Suscripcion pausada');

    WHEN 'resume' THEN
      UPDATE customer_subscriptions SET
        status = 'active',
        next_order_date = CURRENT_DATE + frequency_days,
        paused_until = NULL,
        updated_at = NOW()
      WHERE customer_id = p_customer_id;
      RETURN json_build_object('success', true, 'message', 'Suscripcion reactivada');

    WHEN 'skip_next' THEN
      UPDATE customer_subscriptions SET
        next_order_date = next_order_date + frequency_days,
        updated_at = NOW()
      WHERE customer_id = p_customer_id;
      RETURN json_build_object('success', true, 'message', 'Proximo pedido saltado');

    WHEN 'cancel' THEN
      UPDATE customer_subscriptions SET
        status = 'cancelled',
        updated_at = NOW()
      WHERE customer_id = p_customer_id;
      RETURN json_build_object('success', true, 'message', 'Suscripcion cancelada');

    ELSE
      RETURN json_build_object('error', 'Accion no valida');
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 17. RPC: Obtener Suscripción del Cliente
-- ============================================

CREATE OR REPLACE FUNCTION get_customer_subscription(p_customer_id UUID)
RETURNS JSON AS $$
DECLARE
  v_subscription RECORD;
  v_items JSON;
BEGIN
  SELECT * INTO v_subscription
  FROM customer_subscriptions
  WHERE customer_id = p_customer_id;

  IF v_subscription IS NULL THEN
    RETURN json_build_object('has_subscription', false);
  END IF;

  SELECT json_agg(json_build_object(
    'id', si.id,
    'product_id', si.product_id,
    'product_name', i.product_name,
    'quantity', si.quantity,
    'unit_type', si.unit_type
  ))
  INTO v_items
  FROM subscription_items si
  JOIN inventory i ON i.product_id = si.product_id
  WHERE si.subscription_id = v_subscription.id;

  RETURN json_build_object(
    'has_subscription', true,
    'subscription', json_build_object(
      'id', v_subscription.id,
      'frequency_days', v_subscription.frequency_days,
      'preferred_payment_method', v_subscription.preferred_payment_method,
      'preferred_delivery_day', v_subscription.preferred_delivery_day,
      'status', v_subscription.status,
      'next_order_date', v_subscription.next_order_date,
      'last_order_date', v_subscription.last_order_date,
      'total_orders_generated', v_subscription.total_orders_generated,
      'items', COALESCE(v_items, '[]'::JSON)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 18. RPC: Suscripciones que toca procesar hoy
-- ============================================

CREATE OR REPLACE FUNCTION get_subscriptions_due_today()
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_agg(json_build_object(
      'subscription_id', cs.id,
      'customer_id', cs.customer_id,
      'customer_name', c.full_name,
      'customer_phone', c.phone,
      'frequency_days', cs.frequency_days,
      'items', (
        SELECT json_agg(json_build_object(
          'product_id', si.product_id,
          'product_name', i.product_name,
          'quantity', si.quantity,
          'unit_type', si.unit_type
        ))
        FROM subscription_items si
        JOIN inventory i ON i.product_id = si.product_id
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

-- ============================================
-- 19. RPC: Actualizar Perfil del Cliente
-- ============================================

CREATE OR REPLACE FUNCTION update_customer_profile(
  p_customer_id UUID,
  p_phone VARCHAR DEFAULT NULL,
  p_email VARCHAR DEFAULT NULL,
  p_address TEXT DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
  UPDATE customers SET
    phone = COALESCE(NULLIF(p_phone, ''), phone),
    email = COALESCE(NULLIF(p_email, ''), email),
    address = COALESCE(NULLIF(p_address, ''), address)
  WHERE id = p_customer_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Perfil actualizado'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 20. RLS (Row Level Security)
-- ============================================

ALTER TABLE customer_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_items ENABLE ROW LEVEL SECURITY;

-- Políticas para staff autenticado (pueden ver/editar todo)
DROP POLICY IF EXISTS "Staff puede gestionar customer_auth" ON customer_auth;
CREATE POLICY "Staff puede gestionar customer_auth" ON customer_auth
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true)
  );

DROP POLICY IF EXISTS "Staff puede gestionar suscripciones" ON customer_subscriptions;
CREATE POLICY "Staff puede gestionar suscripciones" ON customer_subscriptions
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true)
  );

DROP POLICY IF EXISTS "Staff puede gestionar subscription_items" ON subscription_items;
CREATE POLICY "Staff puede gestionar subscription_items" ON subscription_items
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approved = true)
  );

-- ============================================
-- 21. GRANTS
-- ============================================

-- RPCs para staff (authenticated)
GRANT EXECUTE ON FUNCTION generate_customer_magic_link TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_customer_orders TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_customer_order TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_customer_order TO authenticated;
GRANT EXECUTE ON FUNCTION get_subscriptions_due_today TO authenticated;

-- RPCs para portal de cliente (anon - validados por session token internamente)
GRANT EXECUTE ON FUNCTION validate_customer_magic_link TO anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_customer_session TO anon, authenticated;
GRANT EXECUTE ON FUNCTION logout_customer_session TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_customer_portal_dashboard TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_customer_order_history TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_products_for_customer_order TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_customer_order TO anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_customer_subscription TO anon, authenticated;
GRANT EXECUTE ON FUNCTION toggle_subscription_status TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_customer_subscription TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_customer_profile TO anon, authenticated;

-- ============================================
-- FIN DE MIGRACIÓN FASE 2
-- ============================================
