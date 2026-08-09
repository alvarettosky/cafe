-- 039_columnas_que_solo_vivian_en_produccion.sql
--
-- Dos columnas existían en la base de producción y **en ninguna migración**.
-- Alguien las creó a mano, seguramente desde el editor SQL del dashboard, y
-- nadie volvió a versionarlas:
--
--     price_list_items.custom_price
--     price_lists.discount_percent
--
-- ===========================================================================
-- Cómo aparecieron
-- ===========================================================================
--
-- No las buscaba nadie. La migración `036` nombra `custom_price` para retirar
-- los dos precios de demostración de la lista «Mayoristas»; en producción
-- funcionó, y al pasarla por el ensayo de restauración —una base reconstruida
-- **solo desde el repositorio**— reventó:
--
--     ERROR 42703: column "custom_price" does not exist
--
-- O sea: la migración era correcta contra la única base donde alguien la había
-- probado, y falsa contra la única base que importa en un desastre.
--
-- Tirando de ese hilo se amplió el paso 6 del ensayo, que hasta ahora comparaba
-- **objetos y funciones** entre producción y la base reconstruida. Al comparar
-- también **columnas**, aparecieron estas dos.
--
-- Es el tercer escalón del mismo modo de fallo en este repositorio:
--
--   `030` — cuatro VISTAS que nadie vigilaba (no son tablas ni funciones)
--   `033`/`034` — seis FUNCIONES que solo existían en producción
--   `039` — dos COLUMNAS que solo existían en producción
--
-- Cada vez, la comprobación existente miraba justo un nivel por encima del
-- sitio donde estaba el problema. **Revisar el mecanismo que conoces no dice
-- nada del que no estás mirando**, y por eso el arreglo de verdad no es esta
-- migración: es que el ensayo compare ahora las columnas, y falle solo.
--
-- ===========================================================================
-- Qué son y por qué se conservan
-- ===========================================================================
--
-- Las dos las lee `get_product_price_for_customer`, que es quien decide el
-- precio de una venta:
--
--   * `price_list_items.custom_price` — precio fijo de un producto dentro de una
--     lista. Hoy no lo usa la función (mira `price_per_lb` y `discount_percent`),
--     pero `components/price-list-manager.tsx` sí lo escribe, así que borrarla
--     rompería el gestor de listas de precios.
--   * `price_lists.discount_percent` — descuento de la lista entera. Convive con
--     `default_discount`, que es la que la función consulta de verdad. Son dos
--     columnas para la misma idea, y eso es deuda anotada en el BACKLOG, no algo
--     que esta migración deba resolver a escondidas.
--
-- Se versionan tal como están en producción —tipo, nulabilidad y default
-- copiados de `information_schema`— para que reconstruir NO cambie nada.

BEGIN;

ALTER TABLE public.price_list_items
  ADD COLUMN IF NOT EXISTS custom_price NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.price_lists
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.price_list_items.custom_price IS
  'Precio fijo del producto en esta lista. Existía solo en producción hasta 039. Lo escribe price-list-manager.tsx.';
COMMENT ON COLUMN public.price_lists.discount_percent IS
  'Descuento de la lista entera. Existía solo en producción hasta 039. ⚠️ Convive con `default_discount`, que es la que get_product_price_for_customer consulta: son dos columnas para la misma idea (BACKLOG).';

COMMIT;

-- ===========================================================================
-- Comprobación
-- ===========================================================================
--
--   ./scripts/restore-drill.sh
--
-- El paso 6 debe decir «todo lo que produccion expone (N objetos, N RPC, N
-- columnas) sale de las migraciones». Si vuelve a nombrar una columna, es que
-- alguien ha tocado la base por fuera otra vez.
