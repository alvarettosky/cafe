-- 036_catalogo_unico_sobre_inventory.sql
--
-- Deja UN solo catálogo, sobre `inventory`, y arregla de paso una RPC que
-- llevaba rota desde que existe.
--
-- ===========================================================================
-- Por qué sobre `inventory` y no sobre `products`
-- ===========================================================================
--
-- El BACKLOG, `CLAUDE.md` y las notas del proyecto decían que el POS ya usaba
-- `products`/`product_variants` y que **el portal era la única parte que leía
-- el modelo viejo**. Al preguntárselo a la base, sale exactamente lo contrario:
--
--   Funciones que tocan `inventory`         -> 28  (process_coffee_sale ×4,
--                                                  get_dashboard_stats,
--                                                  get_advanced_metrics, edit_sale,
--                                                  create_customer_order, y TODO
--                                                  el portal)
--   Funciones que tocan `product_variants`  ->  5  (todas de la Fase 4)
--
-- Y en el frontend igual: `new-sale-modal`, `inventory-list`, `product-modal` y
-- `price-list-manager` leen `inventory`. De las 5 funciones del modelo nuevo,
-- solo `get_variants_for_sale` se invoca desde el código — desde
-- `ProductVariantSelector`, que **no lo usa ninguna página**: solo su propio
-- test. Es código muerto llamando a un modelo muerto.
--
-- Así que no había «dos catálogos divergiendo»: había uno vivo y una Fase 4 a
-- medio hacer cuyo único efecto visible eran cinco nombres rotos.
--
-- ===========================================================================
-- Los nombres rotos, y de dónde salieron
-- ===========================================================================
--
-- `025_migrate_inventory_to_variants.sql` quita del nombre la molienda para
-- convertirla en atributo de la variante. Con una regex por caso:
--
--   'Café Molido Medio'            -> quita 'molido medio' -> 'Café'          (coherente)
--   'Café Tostado (Grano)'         -> quita '(grano)'      -> 'Café Tostado'  (coherente)
--   'Café en Grano'                -> quita 'grano'        -> 'Café en'       ← ROTO
--   'Café Tostado (Tostión Alta)'  -> ninguna regla casa   -> intacto
--
-- El bug es la preposición huérfana. Al retirar `products` desaparece con ella.
--
-- ===========================================================================
-- El bug de precios: `get_product_price_for_customer` NUNCA ha funcionado
-- ===========================================================================
--
-- La función hace `SELECT * INTO v_product FROM inventory` y acto seguido lee
-- `v_product.price_per_lb`. **`inventory` no tiene esa columna.** Ejecutada
-- contra producción:
--
--   ERROR 42703: record "v_product" has no field "price_per_lb"
--
-- Y `components/new-sale-modal.tsx:220` la llama en **cada venta**, al elegir
-- producto y cliente. El error se captura y se manda a `console.error`, así que
-- el efecto visible es que la sugerencia de precio no aparece nunca: el
-- vendedor teclea el precio a mano y todo «funciona». Es el tercer caso del
-- mismo patrón en este repo (`get_dashboard_stats`, `get_products_for_customer_order`):
-- **una RPC rota cuyo error nadie mira se comporta igual que una respuesta
-- vacía.**
--
-- Se arregla dándole a `inventory` las dos columnas que la función lleva
-- esperando desde el principio, en vez de reescribir la función: los precios de
-- venta son un dato del producto, y la lista de precios ya está construida
-- encima de ellos (descuentos y precios fijos por tipo de cliente).
--
-- ===========================================================================
-- Precios y existencias: los de ahora son de demostración
-- ===========================================================================
--
-- Las variantes valían `10.00` y `5.50`, y la lista «Mayoristas» `8.50` y
-- `7.00`. No son pesos: el histórico real vendió la libra a **$35.000 (2024) →
-- $38.000 → $40.000 → $42.000 → $45.000 (2026)**.
--
-- Quedan, por decisión del dueño el 2026-08-09: **libra $45.000 · media libra
-- $25.000** (no la mitad exacta: es el precio comercial). Y las existencias a
-- **cero**, porque los 43.000 g de la base también eran de prueba: la primera
-- entrada real se registra desde el CRM y así queda en el Kardex con su fecha.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Las columnas de precio que la RPC lleva esperando desde siempre
-- ---------------------------------------------------------------------------
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS price_per_lb NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS price_per_half_lb NUMERIC(12, 2);

COMMENT ON COLUMN public.inventory.price_per_lb IS
  'Precio de venta de una libra (500 g) en COP. Lo lee get_product_price_for_customer como precio base; las price_lists aplican descuentos encima.';
COMMENT ON COLUMN public.inventory.price_per_half_lb IS
  'Precio de venta de media libra (250 g) en COP. NO es la mitad de price_per_lb: es un precio comercial propio.';

-- ---------------------------------------------------------------------------
-- 2. Fusionar las filas duplicadas: 12 filas para 5 productos
-- ---------------------------------------------------------------------------
--
-- Cada nombre tenía entre 2 y 3 filas, cada una con su `product_id` y su
-- pedazo de stock («Café Molido Medio» eran 3 filas de 2.500 g). El POS las
-- muestra como productos distintos y el stock real queda repartido.
--
-- El superviviente NO se elige a dedo: gana el que tenga referencias reales
-- (ventas > kardex > listas de precio), y a igualdad, el `product_id` menor
-- para que el resultado sea determinista y el ensayo de restauración lo
-- reproduzca igual.
DO $$
DECLARE
  v_par RECORD;
  v_fusionadas INT := 0;
BEGIN
  CREATE TEMP TABLE fusiones ON COMMIT DROP AS
  WITH ranked AS (
    SELECT
      i.product_id,
      i.product_name,
      ROW_NUMBER() OVER (
        PARTITION BY i.product_name
        ORDER BY
          (SELECT count(*) FROM sale_items s WHERE s.product_id = i.product_id) DESC,
          (SELECT count(*) FROM inventory_movements m WHERE m.product_id = i.product_id) DESC,
          (SELECT count(*) FROM price_list_items p WHERE p.product_id = i.product_id) DESC,
          i.product_id
      ) AS rn
    FROM inventory i
  ),
  superviviente AS (SELECT product_name, product_id FROM ranked WHERE rn = 1)
  SELECT r.product_id AS duplicado, s.product_id AS destino, r.product_name
  FROM ranked r
  JOIN superviviente s USING (product_name)
  WHERE r.rn > 1;

  FOR v_par IN SELECT * FROM fusiones LOOP
    -- Repuntar TODO lo que apunte al duplicado antes de borrarlo. `sale_items`
    -- y `subscription_items` son NO ACTION: sin esto, el DELETE fallaría (que
    -- es preferible a un CASCADE que se llevara ventas por delante).
    UPDATE sale_items          SET product_id = v_par.destino WHERE product_id = v_par.duplicado;
    UPDATE subscription_items  SET product_id = v_par.destino WHERE product_id = v_par.duplicado;
    UPDATE inventory_movements SET product_id = v_par.destino WHERE product_id = v_par.duplicado;

    -- En price_list_items el destino puede tener ya una fila para la misma
    -- lista: la clave es (price_list_id, product_id). Se repunta lo que no
    -- colisione y se descarta el resto.
    UPDATE price_list_items pli
       SET product_id = v_par.destino
     WHERE pli.product_id = v_par.duplicado
       AND NOT EXISTS (
         SELECT 1 FROM price_list_items otro
          WHERE otro.price_list_id = pli.price_list_id
            AND otro.product_id = v_par.destino
       );
    DELETE FROM price_list_items WHERE product_id = v_par.duplicado;

    DELETE FROM inventory WHERE product_id = v_par.duplicado;
    v_fusionadas := v_fusionadas + 1;
  END LOOP;

  RAISE NOTICE 'Filas de inventario fusionadas: %', v_fusionadas;
END $$;

-- Que no vuelvan. Sin esto, la próxima alta con el mismo nombre repite el
-- problema y nadie se entera hasta que el stock aparezca partido en dos.
CREATE UNIQUE INDEX IF NOT EXISTS inventory_product_name_unico
  ON public.inventory (LOWER(TRIM(product_name)));

-- ---------------------------------------------------------------------------
-- 3. Precios reales y existencias a cero
-- ---------------------------------------------------------------------------
UPDATE public.inventory
   SET price_per_lb = 45000,
       price_per_half_lb = 25000,
       total_grams_available = 0,
       last_updated = NOW();

-- Los dos items de la lista «Mayoristas» eran precios de demostración (8.50 y
-- 7.00). Se retiran: una lista sin items significa «sin descuento», que es la
-- verdad hoy. La lista se conserva para cuando haya precios de mayorista de
-- verdad.
DELETE FROM public.price_list_items
 WHERE custom_price < 1000 AND price_per_lb IS NULL AND discount_percent IS NULL;

-- ---------------------------------------------------------------------------
-- 4. Retirar el modelo de la Fase 4
-- ---------------------------------------------------------------------------
--
-- Comprobado antes de borrar: **ningún `sale_items.variant_id` está relleno**
-- (0 de 1), así que no hay historial de ventas atado a una variante. Y el
-- único componente que las consumía no lo renderiza ninguna página.
--
-- Los datos no se pierden aunque esto sea un DROP: el backup diario incluye
-- `products` y `product_variants`, y el ZIP de hoy los lleva.
ALTER TABLE public.sale_items DROP COLUMN IF EXISTS variant_id;

ALTER TABLE public.inventory
  DROP COLUMN IF EXISTS migrated_to_product_id,
  DROP COLUMN IF EXISTS migrated_to_variant_id,
  DROP COLUMN IF EXISTS migration_date;

DROP FUNCTION IF EXISTS public.get_variants_for_sale();
DROP FUNCTION IF EXISTS public.get_product_with_variants(uuid);
DROP FUNCTION IF EXISTS public.list_products_catalog();
DROP FUNCTION IF EXISTS public.create_half_pound_variants();
DROP FUNCTION IF EXISTS public.generate_variant_sku(text, integer, text);
DROP FUNCTION IF EXISTS public.migrate_inventory_product(uuid);
DROP FUNCTION IF EXISTS public.migrate_all_inventory_products();

DROP TABLE IF EXISTS public.product_variants CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;

COMMIT;

-- ===========================================================================
-- Cómo comprobar que quedó bien (ejecutando, no leyendo)
-- ===========================================================================
--
--   -- 5 productos, uno por nombre, sin stock y con precio real:
--   SELECT product_name, total_grams_available, price_per_lb, price_per_half_lb
--     FROM inventory ORDER BY product_name;
--
--   -- La RPC que nunca funcionó, ahora responde:
--   SELECT get_product_price_for_customer(
--            (SELECT product_id FROM inventory LIMIT 1),
--            (SELECT id FROM customers LIMIT 1));
--
--   -- El duplicado no puede volver:
--   INSERT INTO inventory (product_name) VALUES ('café en grano');  -- debe fallar
--
-- Y después, fuera de la base:
--   npm run check:anon   -- la línea base baja de 24 objetos a 22
--   npm test             -- en una TERMINAL LIMPIA (ver A22)
