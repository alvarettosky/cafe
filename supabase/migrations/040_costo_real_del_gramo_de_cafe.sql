-- 040_costo_real_del_gramo_de_cafe.sql
--
-- El costo del café era **0,02 pesos por gramo**, un relleno que venía de los
-- datos de demostración. Con él, el sistema calculaba así cada venta:
--
--     costo de una libra = 500 g × 0,02 = $10
--     ganancia            = $45.000 − $10 = **$44.990**
--
-- O sea: en cuanto empezaran las ventas de verdad, el dashboard habría dicho
-- que el negocio gana casi el 100 % de lo que factura. No es un número
-- decorativo: `process_coffee_sale` lo usa para escribir `sale_items.profit`,
-- `sales.total_profit` y `sales.profit_margin`, y de ahí salen las gráficas de
-- rentabilidad de `/analytics`. Un costo falso no da un margen aproximado: da
-- un histórico entero de márgenes falsos, y encima creíbles.
--
-- ===========================================================================
-- De dónde sale el 52
-- ===========================================================================
--
-- Del dueño, el 2026-08-09: **la libra deja $19.000 y la media libra $11.500**.
-- Despejando el costo desde el precio de venta:
--
--     Libra:       $45.000 − $19.000 = $26.000 / 500 g = **$52,00 por gramo**
--     Media libra: $25.000 − $11.500 = $13.500 / 250 g = **$54,00 por gramo**
--
-- ⚠️ **Los dos no cuadran, y es correcto que no cuadren.** La media libra sale
-- más cara por gramo porque lleva el mismo empaque y el mismo trabajo para la
-- mitad de café. Pero el modelo guarda **un solo `cost_per_gram` por producto**
-- y lo multiplica por los gramos vendidos, así que no puede reproducir las dos
-- ganancias a la vez.
--
-- Se eligió **52**, la que cuadra la libra, porque la libra es lo que se vende:
-- en el histórico real (133 ventas entre 2024-09 y 2026-06) **todas** fueron
-- por libras. El efecto conocido y aceptado: la media libra mostrará **$12.000**
-- de ganancia en vez de $11.500 — $500 de más por cada media libra vendida.
--
-- Si algún día las medias libras pesan en el negocio, la solución NO es
-- recalibrar este número, sino separar el costo del empaque del costo del café,
-- que es lo que realmente distingue a las dos presentaciones.

BEGIN;

UPDATE public.inventory SET cost_per_gram = 52, last_updated = NOW();

COMMENT ON COLUMN public.inventory.cost_per_gram IS
  'Costo del gramo en COP. 52 desde 040 (2026-08-09), dicho por el dueño: la libra de 500 g deja $19.000 de ganancia sobre $45.000 de venta. Antes valía 0,02 — un relleno de la demo que hacía creer al dashboard que cada libra dejaba $44.990.';

COMMIT;

-- ===========================================================================
-- Comprobado ejecutando dos ventas reales, en transacción con ROLLBACK
-- ===========================================================================
--
--   Libra       → total $45.000 · ganancia **$19.000** · margen 42,22 %
--   Media libra → total $25.000 · ganancia **$12.000** · margen 48,00 %
--
-- La primera es exactamente la cifra que dio el dueño; la segunda, los $500 de
-- desviación previstos arriba. Que la desviación medida coincida con la
-- predicha es lo que dice que el modelo se entendió bien.
