-- ============================================================================
-- Migration 025: Migrar datos de inventory a products + product_variants
-- ============================================================================
-- Propósito: Convertir los productos existentes en la tabla inventory a la
-- nueva estructura de productos padre + variantes.
--
-- IMPORTANTE: Esta migración:
-- 1. NO elimina datos existentes
-- 2. Crea productos padre basados en nombres
-- 3. Crea variantes para cada producto existente
-- 4. Agrega columnas de referencia para trazabilidad
--
-- Dependencia: Ejecutar DESPUÉS de 024_product_variants.sql
-- ============================================================================

-- ============================================================================
-- 1. Agregar columnas de referencia a inventory (legacy)
-- ============================================================================
-- Estas columnas permiten rastrear qué productos fueron migrados

ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS migrated_to_product_id UUID REFERENCES products(id),
ADD COLUMN IF NOT EXISTS migrated_to_variant_id UUID REFERENCES product_variants(id),
ADD COLUMN IF NOT EXISTS migration_date TIMESTAMPTZ;

COMMENT ON COLUMN inventory.migrated_to_product_id IS 'ID del producto padre en nueva estructura';
COMMENT ON COLUMN inventory.migrated_to_variant_id IS 'ID de la variante en nueva estructura';

-- ============================================================================
-- 2. Función para migrar un producto de inventory
-- ============================================================================

CREATE OR REPLACE FUNCTION migrate_inventory_product(
    p_inventory_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_inv RECORD;
    v_product_id UUID;
    v_variant_id UUID;
    v_product_name TEXT;
    v_presentation TEXT;
    v_grind_type TEXT;
    v_weight_grams INTEGER;
    v_sku TEXT;
BEGIN
    -- Obtener producto de inventory
    SELECT * INTO v_inv FROM inventory WHERE product_id = p_inventory_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Producto no encontrado');
    END IF;

    -- Ya migrado?
    IF v_inv.migrated_to_variant_id IS NOT NULL THEN
        RETURN json_build_object(
            'status', 'already_migrated',
            'product_id', v_inv.migrated_to_product_id,
            'variant_id', v_inv.migrated_to_variant_id
        );
    END IF;

    -- Parsear nombre para extraer información
    -- Ejemplo: "Café Tostado (Grano)" -> producto: "Café Tostado", grind: "grano"
    v_product_name := v_inv.product_name;

    -- Detectar tipo de molienda del nombre
    IF v_inv.product_name ILIKE '%grano%' THEN
        v_grind_type := 'grano';
        v_product_name := REGEXP_REPLACE(v_inv.product_name, '\s*\(?\s*grano\s*\)?\s*', '', 'gi');
    ELSIF v_inv.product_name ILIKE '%molido fino%' THEN
        v_grind_type := 'molido_fino';
        v_product_name := REGEXP_REPLACE(v_inv.product_name, '\s*\(?\s*molido\s*fino\s*\)?\s*', '', 'gi');
    ELSIF v_inv.product_name ILIKE '%molido medio%' THEN
        v_grind_type := 'molido_medio';
        v_product_name := REGEXP_REPLACE(v_inv.product_name, '\s*\(?\s*molido\s*medio\s*\)?\s*', '', 'gi');
    ELSIF v_inv.product_name ILIKE '%molido grueso%' THEN
        v_grind_type := 'molido_grueso';
        v_product_name := REGEXP_REPLACE(v_inv.product_name, '\s*\(?\s*molido\s*grueso\s*\)?\s*', '', 'gi');
    ELSIF v_inv.product_name ILIKE '%molido%' THEN
        v_grind_type := 'molido_medio';  -- Por defecto
        v_product_name := REGEXP_REPLACE(v_inv.product_name, '\s*\(?\s*molido\s*\)?\s*', '', 'gi');
    ELSE
        v_grind_type := 'grano';  -- Por defecto
    END IF;

    -- Limpiar nombre de paréntesis vacíos y espacios extra
    v_product_name := TRIM(REGEXP_REPLACE(v_product_name, '\(\s*\)', '', 'g'));
    v_product_name := TRIM(REGEXP_REPLACE(v_product_name, '\s+', ' ', 'g'));

    -- Si el nombre quedó vacío, usar el original
    IF v_product_name = '' OR v_product_name IS NULL THEN
        v_product_name := v_inv.product_name;
    END IF;

    -- Buscar o crear producto padre
    SELECT id INTO v_product_id
    FROM products
    WHERE LOWER(name) = LOWER(v_product_name);

    IF NOT FOUND THEN
        -- Crear nuevo producto padre
        INSERT INTO products (name, category, is_active)
        VALUES (v_product_name, 'coffee', true)
        RETURNING id INTO v_product_id;
    END IF;

    -- Determinar presentación y peso
    -- Asumimos que los productos en inventory son por defecto "libra" (500g)
    -- si no tienen indicación de peso
    IF v_inv.total_grams_available > 2000 THEN
        -- Probablemente es inventario general, crear variante libra
        v_presentation := 'libra';
        v_weight_grams := 500;
    ELSE
        v_presentation := 'libra';
        v_weight_grams := 500;
    END IF;

    -- Generar SKU
    v_sku := generate_variant_sku(v_product_name, v_weight_grams, v_grind_type);

    -- Verificar si ya existe una variante similar
    SELECT id INTO v_variant_id
    FROM product_variants
    WHERE product_id = v_product_id
      AND weight_grams = v_weight_grams
      AND grind_type = v_grind_type;

    IF FOUND THEN
        -- Actualizar stock de variante existente
        UPDATE product_variants
        SET stock_grams = stock_grams + v_inv.total_grams_available,
            updated_at = NOW()
        WHERE id = v_variant_id;
    ELSE
        -- Crear nueva variante
        INSERT INTO product_variants (
            product_id,
            sku,
            presentation,
            grind_type,
            weight_grams,
            base_price,
            cost,
            stock_grams,
            min_stock,
            is_active,
            is_default
        ) VALUES (
            v_product_id,
            v_sku,
            v_presentation,
            v_grind_type,
            v_weight_grams,
            10.00,  -- Precio por defecto
            COALESCE(v_inv.cost_per_gram * v_weight_grams, 0),
            v_inv.total_grams_available,
            COALESCE(v_inv.reorder_point, 500),
            true,
            true  -- Primera variante es la predeterminada
        ) RETURNING id INTO v_variant_id;
    END IF;

    -- Marcar como migrado
    UPDATE inventory
    SET migrated_to_product_id = v_product_id,
        migrated_to_variant_id = v_variant_id,
        migration_date = NOW()
    WHERE product_id = p_inventory_id;

    RETURN json_build_object(
        'status', 'migrated',
        'inventory_id', p_inventory_id,
        'product_id', v_product_id,
        'product_name', v_product_name,
        'variant_id', v_variant_id,
        'sku', v_sku,
        'grind_type', v_grind_type
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. Función para migrar todos los productos de inventory
-- ============================================================================

CREATE OR REPLACE FUNCTION migrate_all_inventory_products()
RETURNS JSON AS $$
DECLARE
    v_inv RECORD;
    v_result JSON;
    v_results JSON[];
    v_migrated INTEGER := 0;
    v_skipped INTEGER := 0;
    v_errors INTEGER := 0;
BEGIN
    v_results := ARRAY[]::JSON[];

    FOR v_inv IN SELECT product_id FROM inventory WHERE migrated_to_variant_id IS NULL
    LOOP
        BEGIN
            v_result := migrate_inventory_product(v_inv.product_id);

            IF v_result->>'status' = 'migrated' THEN
                v_migrated := v_migrated + 1;
            ELSIF v_result->>'status' = 'already_migrated' THEN
                v_skipped := v_skipped + 1;
            END IF;

            v_results := array_append(v_results, v_result);
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors + 1;
            v_results := array_append(v_results, json_build_object(
                'error', SQLERRM,
                'inventory_id', v_inv.product_id
            ));
        END;
    END LOOP;

    RETURN json_build_object(
        'migrated', v_migrated,
        'skipped', v_skipped,
        'errors', v_errors,
        'details', to_json(v_results)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. Crear variante "Media Libra" para productos existentes
-- ============================================================================
-- Después de migrar, crear automáticamente variante de media libra

CREATE OR REPLACE FUNCTION create_half_pound_variants()
RETURNS JSON AS $$
DECLARE
    v_variant RECORD;
    v_new_variant_id UUID;
    v_sku TEXT;
    v_created INTEGER := 0;
BEGIN
    -- Para cada variante de libra, crear una de media libra si no existe
    FOR v_variant IN
        SELECT pv.*, p.name as product_name
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.presentation = 'libra'
        AND pv.is_active = true
        AND NOT EXISTS (
            SELECT 1 FROM product_variants pv2
            WHERE pv2.product_id = pv.product_id
            AND pv2.presentation = 'media_libra'
            AND pv2.grind_type = pv.grind_type
        )
    LOOP
        v_sku := generate_variant_sku(v_variant.product_name, 250, v_variant.grind_type);

        INSERT INTO product_variants (
            product_id,
            sku,
            presentation,
            grind_type,
            weight_grams,
            base_price,
            cost,
            stock_grams,
            min_stock,
            is_active,
            is_default
        ) VALUES (
            v_variant.product_id,
            v_sku,
            'media_libra',
            v_variant.grind_type,
            250,
            v_variant.base_price * 0.55,  -- Media libra ~ 55% del precio de libra
            COALESCE(v_variant.cost * 0.5, 0),
            0,  -- Sin stock inicial
            250,
            true,
            false
        ) RETURNING id INTO v_new_variant_id;

        v_created := v_created + 1;
    END LOOP;

    RETURN json_build_object(
        'created', v_created,
        'message', 'Variantes de media libra creadas'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. Agregar columna variant_id a sale_items para nuevas ventas
-- ============================================================================

ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id);

CREATE INDEX IF NOT EXISTS idx_sale_items_variant ON sale_items(variant_id) WHERE variant_id IS NOT NULL;

COMMENT ON COLUMN sale_items.variant_id IS 'Referencia a variante de producto (nuevo sistema)';

-- ============================================================================
-- 6. Función para obtener variantes para selector de venta
-- ============================================================================

CREATE OR REPLACE FUNCTION get_variants_for_sale()
RETURNS TABLE (
    variant_id UUID,
    product_id UUID,
    product_name VARCHAR(200),
    variant_display_name TEXT,
    sku VARCHAR(50),
    presentation VARCHAR(50),
    grind_type VARCHAR(30),
    weight_grams INTEGER,
    base_price NUMERIC(10, 2),
    stock_grams INTEGER,
    has_stock BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pv.id as variant_id,
        p.id as product_id,
        p.name as product_name,
        p.name || ' - ' ||
            CASE pv.presentation
                WHEN 'libra' THEN 'Libra'
                WHEN 'media_libra' THEN 'Media Libra'
                ELSE pv.presentation
            END || ' (' ||
            CASE pv.grind_type
                WHEN 'grano' THEN 'Grano'
                WHEN 'molido_fino' THEN 'Molido Fino'
                WHEN 'molido_medio' THEN 'Molido Medio'
                WHEN 'molido_grueso' THEN 'Molido Grueso'
                ELSE pv.grind_type
            END || ')' as variant_display_name,
        pv.sku,
        pv.presentation,
        pv.grind_type,
        pv.weight_grams,
        pv.base_price,
        pv.stock_grams,
        (pv.stock_grams >= pv.weight_grams) as has_stock
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    WHERE pv.is_active = true AND p.is_active = true
    ORDER BY p.name, pv.weight_grams DESC, pv.grind_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_variants_for_sale TO authenticated;

-- ============================================================================
-- 7. Permisos
-- ============================================================================

GRANT EXECUTE ON FUNCTION migrate_inventory_product TO authenticated;
GRANT EXECUTE ON FUNCTION migrate_all_inventory_products TO authenticated;
GRANT EXECUTE ON FUNCTION create_half_pound_variants TO authenticated;

-- ============================================================================
-- 8. EJECUTAR MIGRACIÓN AUTOMÁTICAMENTE
-- ============================================================================
-- Descomentar la siguiente línea para ejecutar la migración al aplicar este archivo
-- SELECT migrate_all_inventory_products();
-- SELECT create_half_pound_variants();
