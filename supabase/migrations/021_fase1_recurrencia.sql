-- =====================================================
-- MIGRACIÓN FASE 1: Maximizar Sistema de Recurrencia
-- Fecha: 2026-01-19
-- Descripción: Agrega funciones para repetir pedidos,
--              templates WhatsApp y segmentación de clientes
-- =====================================================

-- ============================================
-- 1. FUNCIÓN: Obtener última venta para repetir
-- ============================================

CREATE OR REPLACE FUNCTION get_last_sale_for_repeat(p_customer_id UUID)
RETURNS JSON AS $$
DECLARE
  last_sale RECORD;
  sale_items_json JSON;
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

  -- Obtener items de esa venta con info del producto
  SELECT json_agg(json_build_object(
    'product_id', si.product_id,
    'product_name', i.product_name,
    'quantity', si.quantity,
    'unit_type', si.unit,
    'unit_price', si.price_per_unit
  ))
  INTO sale_items_json
  FROM sale_items si
  JOIN inventory i ON i.product_id = si.product_id
  WHERE si.sale_id = last_sale.id;

  RETURN json_build_object(
    'sale_id', last_sale.id,
    'customer_id', last_sale.customer_id,
    'payment_method', last_sale.payment_method,
    'total', last_sale.total_amount,
    'created_at', last_sale.created_at,
    'items', COALESCE(sale_items_json, '[]'::JSON)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. TABLA: Templates de WhatsApp
-- ============================================

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
('reminder_preventive', 'Hola {nombre}, segun tu ritmo de compra, pronto necesitaras mas cafe. Te preparo tu pedido habitual de {ultimo_producto}?', 'Recordatorio 3 dias antes'),
('reminder_due', 'Hola {nombre}, hace {dias} dias que no nos visitas. Todo bien con tu cafe?', 'Cliente en fecha de recompra'),
('reminder_overdue', 'Hola {nombre}, te extranamos! Hace {dias} dias de tu ultima compra. Necesitas que te llevemos cafe?', 'Cliente atrasado >7 dias'),
('post_sale', 'Gracias por tu compra {nombre}! Esperamos que disfrutes tu cafe. Nos vemos en ~{recurrencia} dias.', 'Despues de venta'),
('first_purchase', 'Bienvenido {nombre}! Gracias por elegirnos. Cada cuantos dias sueles comprar cafe?', 'Primera compra'),
('prospect', 'Hola {nombre}! Somos de Mirador Montanero Cafe Selecto. Ya probaste nuestro cafe? Tenemos los mejores granos recien tostados!', 'Para prospectos')
ON CONFLICT (template_key) DO NOTHING;

-- RLS para templates
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Política: Todos los autenticados pueden leer
DROP POLICY IF EXISTS "Templates visibles para usuarios autenticados" ON whatsapp_templates;
CREATE POLICY "Templates visibles para usuarios autenticados" ON whatsapp_templates
  FOR SELECT TO authenticated USING (true);

-- Política: Solo admins pueden modificar
DROP POLICY IF EXISTS "Solo admins pueden modificar templates" ON whatsapp_templates;
CREATE POLICY "Solo admins pueden modificar templates" ON whatsapp_templates
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 3. FUNCIÓN: Generar mensaje WhatsApp inteligente
-- ============================================

CREATE OR REPLACE FUNCTION generate_whatsapp_message(
  p_customer_id UUID,
  p_template_key VARCHAR(50)
)
RETURNS JSON AS $$
DECLARE
  v_customer RECORD;
  v_template RECORD;
  v_last_product TEXT;
  v_message TEXT;
  v_days_since INT;
  v_phone_clean TEXT;
BEGIN
  -- Obtener cliente
  SELECT * INTO v_customer FROM customers WHERE id = p_customer_id;
  IF v_customer IS NULL THEN
    RETURN json_build_object('error', 'Cliente no encontrado');
  END IF;

  -- Obtener template
  SELECT * INTO v_template FROM whatsapp_templates
  WHERE template_key = p_template_key AND is_active = true;
  IF v_template IS NULL THEN
    RETURN json_build_object('error', 'Template no encontrado');
  END IF;

  -- Calcular días desde última compra
  v_days_since := COALESCE(
    EXTRACT(DAY FROM NOW() - v_customer.last_purchase_date)::INT,
    0
  );

  -- Obtener último producto comprado
  SELECT i.product_name INTO v_last_product
  FROM sale_items si
  JOIN sales s ON s.id = si.sale_id
  JOIN inventory i ON i.product_id = si.product_id
  WHERE s.customer_id = p_customer_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- Reemplazar variables en template
  v_message := v_template.template_text;
  v_message := REPLACE(v_message, '{nombre}', COALESCE(v_customer.full_name, 'cliente'));
  v_message := REPLACE(v_message, '{dias}', v_days_since::TEXT);
  v_message := REPLACE(v_message, '{recurrencia}', COALESCE(v_customer.typical_recurrence_days::TEXT, '15'));
  v_message := REPLACE(v_message, '{ultimo_producto}', COALESCE(v_last_product, 'cafe'));

  -- Limpiar teléfono (solo números)
  v_phone_clean := REGEXP_REPLACE(COALESCE(v_customer.phone, ''), '[^0-9]', '', 'g');

  RETURN json_build_object(
    'message', v_message,
    'phone', v_customer.phone,
    'phone_clean', v_phone_clean,
    'customer_name', v_customer.full_name,
    'template_used', p_template_key,
    'days_since_purchase', v_days_since,
    'whatsapp_url', 'https://wa.me/' || v_phone_clean || '?text=' ||
      REPLACE(REPLACE(REPLACE(v_message, ' ', '%20'), E'\n', '%0A'), '?', '%3F')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. FUNCIÓN: Determinar template automáticamente
-- ============================================

CREATE OR REPLACE FUNCTION get_customer_whatsapp_template(p_customer_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  v_customer RECORD;
  v_days_since INT;
  v_days_until INT;
BEGIN
  SELECT * INTO v_customer FROM customers WHERE id = p_customer_id;

  IF v_customer IS NULL THEN
    RETURN NULL;
  END IF;

  -- Prospecto (nunca ha comprado)
  IF v_customer.last_purchase_date IS NULL THEN
    RETURN 'prospect';
  END IF;

  v_days_since := EXTRACT(DAY FROM NOW() - v_customer.last_purchase_date)::INT;

  -- Si no tiene recurrencia configurada
  IF v_customer.typical_recurrence_days IS NULL THEN
    IF v_days_since > 30 THEN
      RETURN 'reminder_overdue';
    ELSIF v_days_since > 14 THEN
      RETURN 'reminder_due';
    ELSE
      RETURN 'reminder_preventive';
    END IF;
  END IF;

  v_days_until := v_customer.typical_recurrence_days - v_days_since;

  -- Muy atrasado (>7 días después de recurrencia)
  IF v_days_until <= -7 THEN
    RETURN 'reminder_overdue';
  -- Atrasado (pasó la fecha)
  ELSIF v_days_until <= 0 THEN
    RETURN 'reminder_due';
  -- Próximo (faltan 3 días o menos)
  ELSIF v_days_until <= 3 THEN
    RETURN 'reminder_preventive';
  ELSE
    RETURN 'reminder_preventive';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. VISTA: Segmentos de clientes (RFM simplificado)
-- ============================================

DROP VIEW IF EXISTS customer_segments;
CREATE VIEW customer_segments AS
WITH customer_metrics AS (
  SELECT
    c.id,
    c.full_name,
    c.phone,
    c.email,
    c.typical_recurrence_days,
    c.last_purchase_date,
    -- Recency: días desde última compra
    EXTRACT(DAY FROM NOW() - c.last_purchase_date)::INT as days_since_purchase,
    -- Frequency: número de compras en últimos 90 días
    (SELECT COUNT(*) FROM sales s WHERE s.customer_id = c.id
     AND s.created_at > NOW() - INTERVAL '90 days') as purchase_count_90d,
    -- Monetary: valor total en últimos 90 días
    (SELECT COALESCE(SUM(total_amount), 0) FROM sales s WHERE s.customer_id = c.id
     AND s.created_at > NOW() - INTERVAL '90 days') as total_value_90d,
    -- Total histórico
    (SELECT COUNT(*) FROM sales s WHERE s.customer_id = c.id) as total_purchases,
    (SELECT COALESCE(SUM(total_amount), 0) FROM sales s WHERE s.customer_id = c.id) as lifetime_value
  FROM customers c
  WHERE c.id != '00000000-0000-0000-0000-000000000000' -- Excluir Venta Rápida
)
SELECT
  cm.*,
  CASE
    -- Prospect: nunca ha comprado
    WHEN cm.last_purchase_date IS NULL THEN 'prospect'
    -- New: primera compra en últimos 30 días
    WHEN cm.total_purchases = 1 AND cm.days_since_purchase <= 30 THEN 'new'
    -- Champion: frecuente (>4 compras/90d), reciente, alto valor
    WHEN cm.purchase_count_90d >= 4
         AND cm.days_since_purchase <= COALESCE(cm.typical_recurrence_days, 15)
         AND cm.total_value_90d > 100 -- Umbral simplificado
    THEN 'champion'
    -- Loyal: dentro de recurrencia esperada
    WHEN cm.days_since_purchase <= COALESCE(cm.typical_recurrence_days, 15) THEN 'loyal'
    -- Potential: pocas compras pero recientes
    WHEN cm.total_purchases <= 3 AND cm.days_since_purchase <= 30 THEN 'potential'
    -- At Risk: pasó su recurrencia pero menos de 2x
    WHEN cm.days_since_purchase > COALESCE(cm.typical_recurrence_days, 15)
         AND cm.days_since_purchase <= COALESCE(cm.typical_recurrence_days, 15) * 2
    THEN 'at_risk'
    -- Lost: más de 2x su recurrencia sin comprar
    WHEN cm.days_since_purchase > COALESCE(cm.typical_recurrence_days, 15) * 2 THEN 'lost'
    ELSE 'loyal'
  END as segment
FROM customer_metrics cm;

-- ============================================
-- 6. FUNCIÓN: Estadísticas de segmentos
-- ============================================

CREATE OR REPLACE FUNCTION get_customer_segment_stats()
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_agg(json_build_object(
      'segment', segment,
      'count', count,
      'total_value', total_value,
      'avg_value', avg_value
    ))
    FROM (
      SELECT
        segment,
        COUNT(*) as count,
        COALESCE(SUM(lifetime_value), 0) as total_value,
        COALESCE(ROUND(AVG(lifetime_value)::numeric, 2), 0) as avg_value
      FROM customer_segments
      GROUP BY segment
      ORDER BY
        CASE segment
          WHEN 'champion' THEN 1
          WHEN 'loyal' THEN 2
          WHEN 'potential' THEN 3
          WHEN 'new' THEN 4
          WHEN 'at_risk' THEN 5
          WHEN 'lost' THEN 6
          WHEN 'prospect' THEN 7
        END
    ) stats
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. FUNCIÓN: Obtener clientes por segmento
-- ============================================

CREATE OR REPLACE FUNCTION get_customers_by_segment(p_segment VARCHAR(20))
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_agg(json_build_object(
      'id', id,
      'full_name', full_name,
      'phone', phone,
      'email', email,
      'days_since_purchase', days_since_purchase,
      'total_purchases', total_purchases,
      'lifetime_value', lifetime_value,
      'typical_recurrence_days', typical_recurrence_days,
      'segment', segment
    ))
    FROM customer_segments
    WHERE segment = p_segment
    ORDER BY
      CASE
        WHEN p_segment = 'at_risk' THEN days_since_purchase
        ELSE -lifetime_value
      END DESC
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. GRANTS
-- ============================================

GRANT EXECUTE ON FUNCTION get_last_sale_for_repeat TO authenticated;
GRANT EXECUTE ON FUNCTION generate_whatsapp_message TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_whatsapp_template TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_segment_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_customers_by_segment TO authenticated;
GRANT SELECT ON customer_segments TO authenticated;

-- ============================================
-- FIN DE MIGRACIÓN
-- ============================================
