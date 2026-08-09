-- 037_ninguna_venta_podia_registrarse.sql
--
-- **El CRM no podía registrar ni una sola venta.** Encontrado el 2026-08-09 al
-- probar que `036` no hubiera roto el camino de venta; resultó que ya estaba
-- roto, y desde antes.
--
-- ===========================================================================
-- Qué pasaba
-- ===========================================================================
--
-- `sales` tiene un trigger `update_customer_last_purchase` que, al insertar una
-- venta, marca al cliente:
--
--     UPDATE customers
--        SET last_purchase_date = NEW.created_at,
--            updated_at = CURRENT_TIMESTAMP     -- <- esta columna NO EXISTE
--      WHERE id = NEW.customer_id;
--
-- `customers` nunca tuvo `updated_at`. Como el trigger es `AFTER INSERT` sobre
-- `sales` y falla con 42703, **la transacción entera se revierte**: no hay venta,
-- no hay items, no se descuenta inventario.
--
--     ERROR 42703: column "updated_at" of relation "customers" does not exist
--
-- Afecta a TODOS los caminos, porque todos acaban insertando en `sales`:
-- `process_coffee_sale` (el POS), `create_customer_order` (los pedidos del
-- portal) y `edit_sale`.
--
-- Aislado para no atribuirlo a la migración de al lado: un `INSERT INTO sales`
-- **a pelo**, sin pasar por ninguna RPC ni por nada que `036` tocara, falla
-- exactamente igual. El defecto está en el trigger, no en el catálogo.
--
-- ===========================================================================
-- Por qué nadie lo vio, otra vez
-- ===========================================================================
--
-- 1. **Ninguna puerta ejecuta una venta.** Los 889 tests unitarios usan mocks de
--    Supabase; `npm run check:rpc` comprueba que `process_coffee_sale` EXISTA,
--    no que funcione; el e2e no crea ventas contra la base real. Una RPC puede
--    existir, tener la firma correcta y reventar en su primera línea útil.
-- 2. **La base está en datos de demostración**, así que nadie estaba vendiendo
--    de verdad y nadie recibía el error.
-- 3. `CLAUDE.md` **ya avisaba** —«`updated_at` no existe en `customers`»— en su
--    lista de errores comunes. La nota describía el síntoma como un tropiezo de
--    quien programa, sin que nadie comprobara que había un trigger en
--    producción cometiéndolo en cada venta. Un aviso escrito no es una prueba.
--
-- ===========================================================================
-- La corrección
-- ===========================================================================
--
-- Se añade la columna en vez de quitarla del trigger. Es lo que el trigger
-- lleva pidiendo desde que se escribió, el resto del esquema ya la usa
-- (`customer_contacts`, `products`…) y saber cuándo cambió un cliente es un
-- dato útil, no un adorno. Quitarla del trigger habría dejado el sistema
-- funcionando pero sin ese dato, y con la nota de `CLAUDE.md` igual de viva.

BEGIN;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON COLUMN public.customers.updated_at IS
  'Última modificación del cliente. La mantiene el trigger update_customer_last_purchase de `sales`, que sin esta columna hacía fallar TODA venta (037).';

COMMIT;

-- ===========================================================================
-- Cómo comprobar que quedó cerrado (ejecutando)
-- ===========================================================================
--
--   BEGIN;
--     INSERT INTO sales (customer_id, total_amount, payment_method, created_at)
--     VALUES ((SELECT id FROM customers LIMIT 1), 1000, 'EFECTIVO', NOW());
--   ROLLBACK;                       -- antes: 42703. Ahora: 1 fila.
--
--   -- Y la venta completa, con descuento de inventario:
--   BEGIN;
--     UPDATE inventory SET total_grams_available = 5000
--      WHERE product_name = 'Café Tostado (Grano)';
--     SELECT process_coffee_sale(...);
--     SELECT total_grams_available FROM inventory
--      WHERE product_name = 'Café Tostado (Grano)';   -- debe haber bajado a 4500
--   ROLLBACK;
