-- Script de diagnóstico para verificar el estado de la base de datos
-- Ejecuta esto en el SQL Editor para ver qué falta

-- 1. Verificar tablas existentes
SELECT 'TABLES' as check_type, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Verificar funciones/RPCs existentes
SELECT 'FUNCTIONS' as check_type, routine_name
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- 3. Verificar políticas RLS
SELECT 'RLS POLICIES' as check_type,
       tablename,
       policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 4. Verificar datos en inventory
SELECT 'INVENTORY DATA' as check_type,
       product_name,
       total_grams_available
FROM inventory
ORDER BY product_name;

-- 5. Verificar datos en customers
SELECT 'CUSTOMER COUNT' as check_type,
       COUNT(*) as total_customers
FROM customers;

-- Resumen de lo que debería existir:
-- TABLAS: customers, inventory, sale_items, sales
-- FUNCIONES: get_dashboard_stats, process_coffee_sale
-- POLÍTICAS RLS: Varias en cada tabla
-- DATOS: Al menos 2 productos en inventory
