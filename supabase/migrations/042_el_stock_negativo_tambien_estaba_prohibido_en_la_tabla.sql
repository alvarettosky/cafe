-- 042_el_stock_negativo_tambien_estaba_prohibido_en_la_tabla.sql
--
-- `041` retiro la validacion «Stock insuficiente» de las funciones, y **no
-- basto**. Al probarlo —vender una libra con el inventario en cero— la venta
-- siguio fallando, ahora con otro error:
--
--     ERROR 23514: new row for relation "inventory" violates check constraint
--                  "positive_stock"
--     DETAIL: Failing row contains (…, Café Molido Medio, -500, …)
--
-- La prohibicion estaba en **dos sitios**: una comprobacion explicita dentro de
-- cada funcion, y una restriccion `CHECK (total_grams_available >= 0)` en la
-- propia tabla `inventory`. Retirar la primera dejaba la segunda intacta, asi
-- que el dueno habria seguido sin poder registrar su venta — con un mensaje
-- distinto, mas oscuro, y esta vez sin ninguna pista de donde tocar.
--
-- Es el mismo patron que este repositorio ya lleva escrito tres veces:
-- **revisar el mecanismo que conoces no dice nada del que no estas mirando.**
-- Aqui el mecanismo olvidado no era una vista, ni una funcion, ni una columna:
-- era una **restriccion de tabla**. Y solo aparecio porque `041` se probo
-- EJECUTANDOLA en vez de darla por buena al leer el diff.
--
-- ===========================================================================
-- Que queda protegido
-- ===========================================================================
--
-- Se retira la restriccion, no se sustituye por otra mas laxa. El stock negativo
-- es ahora un estado **valido y con significado**: «se vendio cafe que el
-- sistema no sabia que existia; falta registrar la entrada».
--
-- Lo que sigue rechazandose es vender un producto que no existe en `inventory`,
-- porque ahi no hay a que imputar la venta ni de donde sacar el costo.

BEGIN;

ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS positive_stock;

COMMENT ON COLUMN public.inventory.total_grams_available IS
  'Gramos disponibles. PUEDE SER NEGATIVO desde 042: significa que se vendió café que el sistema no tenía registrado, y que falta anotar la entrada. No es un error de datos, es una señal.';

COMMIT;

-- ===========================================================================
-- Comprobado ejecutando, con ROLLBACK
-- ===========================================================================
--
--   Antes de 042: 23514, violates check constraint "positive_stock"
--   Despues:      la venta entra, `inventory` queda en -500 y el Kardex
--                 registra `stock_before = 0`, `stock_after = -500`.
