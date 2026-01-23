-- ============================================================================
-- Migration 026: Corregir tipos en función get_inventory_movements
-- ============================================================================
-- Problema: La función retorna tipos que no coinciden con la tabla real.
-- Solución: Usar casts explícitos para asegurar compatibilidad.
-- ============================================================================

-- Primero eliminar la función existente (requerido para cambiar tipos de retorno)
DROP FUNCTION IF EXISTS get_inventory_movements(uuid,integer,integer,character varying,timestamp with time zone,timestamp with time zone);

-- Recrear la función con casts explícitos
CREATE OR REPLACE FUNCTION get_inventory_movements(
    p_product_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0,
    p_movement_type VARCHAR(20) DEFAULT NULL,
    p_date_from TIMESTAMPTZ DEFAULT NULL,
    p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    movement_type TEXT,
    quantity_grams INTEGER,
    stock_before INTEGER,
    stock_after INTEGER,
    reference_id UUID,
    reference_type TEXT,
    reason TEXT,
    unit_cost NUMERIC(10, 4),
    batch_number TEXT,
    performed_by UUID,
    performer_email TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        im.id,
        im.movement_type::TEXT,
        im.quantity_grams,
        im.stock_before,
        im.stock_after,
        im.reference_id,
        im.reference_type::TEXT,
        im.reason::TEXT,
        im.unit_cost,
        im.batch_number::TEXT,
        im.performed_by,
        u.email::TEXT as performer_email,
        im.created_at
    FROM inventory_movements im
    LEFT JOIN auth.users u ON im.performed_by = u.id
    WHERE im.product_id = p_product_id
        AND (p_movement_type IS NULL OR im.movement_type = p_movement_type)
        AND (p_date_from IS NULL OR im.created_at >= p_date_from)
        AND (p_date_to IS NULL OR im.created_at <= p_date_to)
    ORDER BY im.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_inventory_movements TO authenticated;
