-- Semilla de datos iniciales para Café Palestina

-- Insertar productos básicos si no existen
INSERT INTO inventory (product_name, total_grams_available)
VALUES 
    ('Café Tostado (Grano)', 5000),  -- 10 Libras aprox
    ('Café Molido Medio', 2500)      -- 5 Libras aprox
ON CONFLICT DO NOTHING;

-- Nota: En un escenario real, querrás guardar los IDs generados para usarlos en el frontend.
-- Puedes consultarlos con: SELECT * FROM inventory;
