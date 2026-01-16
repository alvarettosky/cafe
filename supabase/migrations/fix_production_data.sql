-- Script de emergencia para agregar datos faltantes en producción
-- Este script es idempotente (puede ejecutarse múltiples veces sin errores)

-- 1. Verificar que la tabla inventory existe y tiene la estructura correcta
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory') THEN
        CREATE TABLE inventory (
            product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            product_name TEXT NOT NULL,
            total_grams_available INTEGER NOT NULL DEFAULT 0,
            last_updated TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT positive_stock CHECK (total_grams_available >= 0)
        );
        CREATE INDEX idx_inventory_product_id ON inventory(product_id);
    END IF;
END $$;

-- 2. Insertar productos iniciales si no existen
-- Usamos ON CONFLICT DO NOTHING para evitar duplicados
INSERT INTO inventory (product_name, total_grams_available)
VALUES
    ('Café Tostado (Grano)', 5000),  -- 10 Libras aprox
    ('Café Molido Medio', 2500)      -- 5 Libras aprox
ON CONFLICT (product_id) DO NOTHING;

-- Si los productos ya existen pero con otro nombre, intentar por nombre
-- Esta parte asegura que tengamos al menos estos dos productos
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM inventory WHERE product_name = 'Café Tostado (Grano)') THEN
        INSERT INTO inventory (product_name, total_grams_available)
        VALUES ('Café Tostado (Grano)', 5000);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM inventory WHERE product_name = 'Café Molido Medio') THEN
        INSERT INTO inventory (product_name, total_grams_available)
        VALUES ('Café Molido Medio', 2500);
    END IF;
END $$;

-- 3. Verificar que los datos se insertaron
SELECT
    'SUCCESS: Inventory data loaded' as status,
    COUNT(*) as total_products,
    SUM(total_grams_available) as total_grams
FROM inventory;

-- 4. Mostrar los productos
SELECT * FROM inventory ORDER BY product_name;
