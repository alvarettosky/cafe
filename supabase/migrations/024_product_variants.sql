-- ============================================================================
-- Migration 024: Sistema de Productos con Variantes
-- ============================================================================
-- Propósito: Implementar arquitectura de productos padre + variantes (SKUs)
-- para permitir gestión flexible de presentaciones y precios.
--
-- Problema resuelto: Actualmente cada presentación (libra grano, libra molido)
-- es un producto independiente. Esto dificulta reportes agrupados y cambios
-- de información del producto.
--
-- IMPORTANTE: Esta migración es ADITIVA. No elimina la tabla inventory existente.
-- ============================================================================

-- ============================================================================
-- 1. Tabla de Productos Padre
-- ============================================================================
-- Almacena información general del café: origen, variedad, notas de cata, etc.
-- Múltiples variantes pueden pertenecer a un producto padre.

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Información básica
    name VARCHAR(200) NOT NULL,
    description TEXT,

    -- Información del café
    origin VARCHAR(100),           -- País/región de origen
    variety VARCHAR(100),          -- Variedad del café (Caturra, Bourbon, etc.)
    process VARCHAR(100),          -- Proceso (Lavado, Natural, Honey, etc.)
    altitude VARCHAR(50),          -- Rango de altitud (1500-1800 msnm)
    tasting_notes TEXT,            -- Notas de cata (chocolate, frutas, etc.)
    roast_level VARCHAR(30),       -- Nivel de tostión (Claro, Medio, Oscuro)

    -- Categorización
    category VARCHAR(50) DEFAULT 'coffee',  -- coffee, blend, subscription, etc.
    tags TEXT[],                   -- Tags para filtros/búsqueda

    -- Estado
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,  -- Para ordenar en UI

    -- Multimedia (URLs)
    image_url TEXT,

    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE products IS 'Productos padre - información general del café sin variantes específicas';
COMMENT ON COLUMN products.origin IS 'País o región de origen del café';
COMMENT ON COLUMN products.variety IS 'Variedad botánica del café (Caturra, Bourbon, Typica, etc.)';
COMMENT ON COLUMN products.process IS 'Método de procesamiento (Lavado, Natural, Honey, Anaeróbico)';
COMMENT ON COLUMN products.tasting_notes IS 'Descripción de sabores y aromas';

-- Índices para búsquedas comunes
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = true;
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_origin ON products(origin);

-- ============================================================================
-- 2. Tabla de Variantes de Producto (SKUs)
-- ============================================================================
-- Cada variante es una combinación específica: Producto + Peso + Molienda
-- Esta es la entidad que se vende y tiene stock.

CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relación con producto padre
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Identificación única
    sku VARCHAR(50) UNIQUE,        -- Código único: CAFE-HUILA-500G-GRANO
    barcode VARCHAR(50),           -- Código de barras (opcional)

    -- Características de la variante
    presentation VARCHAR(50) NOT NULL,  -- libra, media_libra, 250g, 1kg, etc.
    grind_type VARCHAR(30) DEFAULT 'grano',  -- grano, molido_fino, molido_medio, molido_grueso
    weight_grams INTEGER NOT NULL,      -- Peso en gramos

    -- Precios
    base_price NUMERIC(10, 2) NOT NULL,        -- Precio base de venta
    cost NUMERIC(10, 2),                        -- Costo del producto
    compare_at_price NUMERIC(10, 2),           -- Precio tachado (para ofertas)

    -- Inventario
    stock_grams INTEGER NOT NULL DEFAULT 0,    -- Stock en gramos
    min_stock INTEGER DEFAULT 500,              -- Mínimo para alerta
    track_inventory BOOLEAN DEFAULT true,       -- ¿Controlar inventario?
    allow_backorder BOOLEAN DEFAULT false,      -- ¿Permitir venta sin stock?

    -- Estado
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,          -- ¿Variante predeterminada?
    sort_order INTEGER DEFAULT 0,

    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Restricciones
    CONSTRAINT valid_weight CHECK (weight_grams > 0),
    CONSTRAINT valid_price CHECK (base_price >= 0),
    CONSTRAINT valid_stock CHECK (stock_grams >= 0 OR NOT track_inventory)
);

COMMENT ON TABLE product_variants IS 'Variantes de producto (SKUs) - cada combinación específica vendible';
COMMENT ON COLUMN product_variants.sku IS 'Código único de identificación (Stock Keeping Unit)';
COMMENT ON COLUMN product_variants.presentation IS 'Tipo de presentación: libra, media_libra, 250g, 500g, 1kg';
COMMENT ON COLUMN product_variants.grind_type IS 'Tipo de molienda: grano, molido_fino, molido_medio, molido_grueso';
COMMENT ON COLUMN product_variants.stock_grams IS 'Inventario actual en gramos';

-- Índices para variantes
CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(sku) WHERE sku IS NOT NULL;
CREATE INDEX idx_variants_active ON product_variants(is_active) WHERE is_active = true;
CREATE INDEX idx_variants_presentation ON product_variants(presentation);
CREATE INDEX idx_variants_grind ON product_variants(grind_type);
CREATE INDEX idx_variants_stock ON product_variants(stock_grams);

-- ============================================================================
-- 3. RLS (Row Level Security)
-- ============================================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- Políticas para products
CREATE POLICY "Productos visibles para usuarios aprobados"
    ON products FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.approved = true
        )
    );

CREATE POLICY "Solo admins pueden modificar productos"
    ON products FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.approved = true
            AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.approved = true
            AND profiles.role = 'admin'
        )
    );

-- Políticas para product_variants
CREATE POLICY "Variantes visibles para usuarios aprobados"
    ON product_variants FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.approved = true
        )
    );

CREATE POLICY "Solo admins pueden modificar variantes"
    ON product_variants FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.approved = true
            AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.approved = true
            AND profiles.role = 'admin'
        )
    );

-- ============================================================================
-- 4. Triggers para actualizar timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_product_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_product_timestamp();

CREATE TRIGGER trg_variants_updated
    BEFORE UPDATE ON product_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_product_timestamp();

-- ============================================================================
-- 5. Funciones de utilidad
-- ============================================================================

-- Función para generar SKU automáticamente
CREATE OR REPLACE FUNCTION generate_variant_sku(
    p_product_name TEXT,
    p_weight_grams INTEGER,
    p_grind_type VARCHAR(30)
)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_prefix TEXT;
    v_weight_str TEXT;
    v_grind_str TEXT;
    v_sku TEXT;
    v_counter INTEGER := 1;
BEGIN
    -- Generar prefijo del nombre (primeras 3 letras mayúsculas)
    v_prefix := UPPER(SUBSTRING(REGEXP_REPLACE(p_product_name, '[^a-zA-Z]', '', 'g'), 1, 3));

    -- Formato del peso
    v_weight_str := CASE
        WHEN p_weight_grams >= 1000 THEN (p_weight_grams / 1000)::TEXT || 'KG'
        ELSE p_weight_grams::TEXT || 'G'
    END;

    -- Código de molienda
    v_grind_str := CASE p_grind_type
        WHEN 'grano' THEN 'GR'
        WHEN 'molido_fino' THEN 'MF'
        WHEN 'molido_medio' THEN 'MM'
        WHEN 'molido_grueso' THEN 'MG'
        ELSE 'XX'
    END;

    -- Construir SKU base
    v_sku := v_prefix || '-' || v_weight_str || '-' || v_grind_str;

    -- Verificar unicidad y agregar contador si es necesario
    WHILE EXISTS (SELECT 1 FROM product_variants WHERE sku = v_sku) LOOP
        v_counter := v_counter + 1;
        v_sku := v_prefix || '-' || v_weight_str || '-' || v_grind_str || '-' || v_counter;
    END LOOP;

    RETURN v_sku;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener todas las variantes de un producto con info del padre
CREATE OR REPLACE FUNCTION get_product_with_variants(p_product_id UUID)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'product', row_to_json(p),
        'variants', COALESCE(
            (SELECT json_agg(row_to_json(v) ORDER BY v.sort_order, v.weight_grams)
             FROM product_variants v
             WHERE v.product_id = p.id AND v.is_active = true),
            '[]'::json
        )
    ) INTO v_result
    FROM products p
    WHERE p.id = p_product_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para listar productos con variante predeterminada (para catálogo)
CREATE OR REPLACE FUNCTION list_products_catalog()
RETURNS TABLE (
    product_id UUID,
    product_name VARCHAR(200),
    origin VARCHAR(100),
    tasting_notes TEXT,
    default_variant_id UUID,
    default_price NUMERIC(10, 2),
    min_price NUMERIC(10, 2),
    max_price NUMERIC(10, 2),
    total_stock INTEGER,
    variant_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id as product_id,
        p.name as product_name,
        p.origin,
        p.tasting_notes,
        (SELECT v.id FROM product_variants v
         WHERE v.product_id = p.id AND v.is_active = true
         ORDER BY v.is_default DESC, v.sort_order, v.weight_grams
         LIMIT 1) as default_variant_id,
        (SELECT v.base_price FROM product_variants v
         WHERE v.product_id = p.id AND v.is_active = true
         ORDER BY v.is_default DESC, v.sort_order
         LIMIT 1) as default_price,
        MIN(v.base_price) as min_price,
        MAX(v.base_price) as max_price,
        SUM(v.stock_grams)::INTEGER as total_stock,
        COUNT(v.id)::INTEGER as variant_count
    FROM products p
    LEFT JOIN product_variants v ON v.product_id = p.id AND v.is_active = true
    WHERE p.is_active = true
    GROUP BY p.id, p.name, p.origin, p.tasting_notes
    ORDER BY p.sort_order, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. Vista de compatibilidad con inventory
-- ============================================================================
-- Esta vista permite que el código existente siga funcionando mientras
-- se migra gradualmente a la nueva estructura.

CREATE OR REPLACE VIEW inventory_from_variants AS
SELECT
    pv.id as product_id,
    p.name || ' - ' ||
        CASE pv.presentation
            WHEN 'libra' THEN 'Libra'
            WHEN 'media_libra' THEN 'Media Libra'
            ELSE pv.presentation
        END || ' ' ||
        CASE pv.grind_type
            WHEN 'grano' THEN '(Grano)'
            WHEN 'molido_fino' THEN '(Molido Fino)'
            WHEN 'molido_medio' THEN '(Molido Medio)'
            WHEN 'molido_grueso' THEN '(Molido Grueso)'
            ELSE ''
        END as product_name,
    pv.stock_grams as total_grams_available,
    pv.updated_at as last_updated,
    pv.cost / NULLIF(pv.weight_grams, 0) as cost_per_gram,
    NULL::TEXT as supplier,
    pv.min_stock as reorder_point,
    NULL::TIMESTAMPTZ as last_restock_date,
    NULL::TEXT as notes
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
WHERE pv.is_active = true AND p.is_active = true;

COMMENT ON VIEW inventory_from_variants IS 'Vista de compatibilidad: muestra variantes como si fueran inventario legacy';

-- Permisos para funciones
GRANT EXECUTE ON FUNCTION get_product_with_variants TO authenticated;
GRANT EXECUTE ON FUNCTION list_products_catalog TO authenticated;
GRANT EXECUTE ON FUNCTION generate_variant_sku TO authenticated;
