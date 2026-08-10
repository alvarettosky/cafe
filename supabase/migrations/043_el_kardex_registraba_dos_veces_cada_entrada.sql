-- 043_el_kardex_registraba_dos_veces_cada_entrada.sql
--
-- **Cada reposición aparecía dos veces en el Kardex.** Encontrado el 2026-08-09
-- al registrar la primera entrada real de inventario del negocio: 30 libras y 10
-- medias libras (17.500 g).
--
-- ===========================================================================
-- Qué pasaba
-- ===========================================================================
--
-- `register_inventory_movement` hace dos cosas: **inserta** el movimiento en
-- `inventory_movements` y **actualiza** `inventory`. Y sobre `inventory` hay un
-- trigger, `trg_inventory_adjustment_audit`, que registra un movimiento cada vez
-- que cambia el stock — para que un `UPDATE` hecho a mano deje rastro.
--
-- El resultado, medido:
--
--     tipo        gramos   antes → después   motivo
--     restock     +17.500   -500 → 17.000    «Entrada de tueste: 30 libras…»
--     adjustment  +17.500   -500 → 17.000    «Ajuste directo desde gestión…»
--
-- Dos filas para una sola entrada de café. El **stock queda bien** —el trigger
-- solo registra, no suma— pero el historial dice que hubo dos movimientos, y el
-- Kardex existe precisamente para eso: saber quién metió o sacó café, cuándo y
-- por qué. Un inventario que aparenta el doble de movimientos de los que hubo no
-- sirve para cuadrar nada.
--
-- El trigger **ya tenía** la defensa, pero solo para un caso:
--
--     IF current_setting('app.is_sale_operation', true) = 'true' THEN RETURN NEW;
--
-- `process_coffee_sale` marca esa bandera y por eso las ventas nunca se
-- duplicaron. Las demás operaciones del Kardex —reposición, merma, devolución,
-- traslado— no tenían forma de decir «este movimiento ya lo registré yo».
--
-- **La defensa estaba escrita para un caso concreto en vez de para la clase
-- entera**, que es el mismo patrón que ya se pagó con el stock negativo (`042`):
-- la protección existía, pero solo cubría el camino que alguien tuvo delante el
-- día que la escribió.
--
-- ===========================================================================
-- La corrección
-- ===========================================================================
--
-- Se generaliza la bandera: `app.movimiento_ya_registrado`. La fija cualquier
-- función que escriba en `inventory_movements` por su cuenta, y el trigger la
-- respeta igual que a la de ventas. `app.is_sale_operation` se conserva para no
-- romper nada que dependa de ella.
--
-- Lo que **sigue** dejando rastro automático: un `UPDATE` directo sobre
-- `inventory` —desde el editor SQL o desde el modal de producto—, que es
-- justamente para lo que se creó el trigger.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. El trigger entiende la clase entera, no solo las ventas
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_inventory_adjustment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
    -- No registrar si quien hizo el UPDATE ya escribió el movimiento a mano.
    -- Dos banderas por compatibilidad: la de ventas venía de antes.
    IF current_setting('app.is_sale_operation', true) = 'true'
       OR current_setting('app.movimiento_ya_registrado', true) = 'true' THEN
        RETURN NEW;
    END IF;

    IF OLD.total_grams_available IS DISTINCT FROM NEW.total_grams_available THEN
        INSERT INTO inventory_movements (
            product_id, movement_type, quantity_grams,
            stock_before, stock_after, reference_type, reason, performed_by
        ) VALUES (
            NEW.product_id,
            'adjustment',
            NEW.total_grams_available - OLD.total_grams_available,
            OLD.total_grams_available,
            NEW.total_grams_available,
            'manual',
            'Ajuste directo desde gestión de inventario',
            auth.uid()
        );
    END IF;

    RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Quien ya registró su movimiento, lo dice
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_inventory_movement(
    p_product_id uuid,
    p_movement_type character varying,
    p_quantity_grams integer,
    p_reference_id uuid DEFAULT NULL::uuid,
    p_reference_type character varying DEFAULT NULL::character varying,
    p_reason text DEFAULT NULL::text,
    p_unit_cost numeric DEFAULT NULL::numeric,
    p_batch_number character varying DEFAULT NULL::character varying
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_stock_before INTEGER;
    v_stock_after INTEGER;
    v_movement_id UUID;
BEGIN
    -- Este movimiento lo escribe esta función; el trigger no debe repetirlo.
    PERFORM set_config('app.movimiento_ya_registrado', 'true', true);

    SELECT total_grams_available INTO v_stock_before
      FROM inventory
     WHERE product_id = p_product_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto % no encontrado en inventario', p_product_id;
    END IF;

    v_stock_after := v_stock_before + p_quantity_grams;

    -- El stock puede quedar negativo: ver 041 y 042.

    INSERT INTO inventory_movements (
        product_id, movement_type, quantity_grams,
        stock_before, stock_after,
        reference_id, reference_type, reason, unit_cost, batch_number, performed_by
    ) VALUES (
        p_product_id, p_movement_type, p_quantity_grams,
        v_stock_before, v_stock_after,
        p_reference_id, p_reference_type, p_reason, p_unit_cost, p_batch_number, auth.uid()
    ) RETURNING id INTO v_movement_id;

    UPDATE inventory
       SET total_grams_available = v_stock_after,
           last_updated = NOW()
     WHERE product_id = p_product_id;

    RETURN v_movement_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.register_inventory_movement(uuid, character varying, integer, uuid, character varying, text, numeric, character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_inventory_movement(uuid, character varying, integer, uuid, character varying, text, numeric, character varying) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Retirar el duplicado que este defecto ya produjo
-- ---------------------------------------------------------------------------
--
-- Solo uno: la entrada de tueste del 2026-08-09. Se identifica sin ambigüedad
-- porque comparte producto, gramos y stock_before/after con su `restock`, y es
-- posterior. Los `adjustment` de la migración `036` —que puso el stock a cero—
-- NO son duplicados: ahí no hubo ningún movimiento previo que registrar, y se
-- conservan.
DELETE FROM public.inventory_movements dup
 WHERE dup.movement_type = 'adjustment'
   AND dup.reason = 'Ajuste directo desde gestión de inventario'
   AND EXISTS (
     SELECT 1 FROM public.inventory_movements orig
      WHERE orig.id <> dup.id
        AND orig.product_id = dup.product_id
        AND orig.quantity_grams = dup.quantity_grams
        AND orig.stock_before = dup.stock_before
        AND orig.stock_after = dup.stock_after
        AND orig.movement_type <> 'adjustment'
        AND orig.created_at <= dup.created_at
   );

COMMIT;

-- ===========================================================================
-- Comprobación (con ROLLBACK)
-- ===========================================================================
--
--   BEGIN;
--     SELECT register_inventory_movement(
--       (SELECT product_id FROM inventory WHERE product_name='Café Molido Medio'),
--       'restock', 1000, NULL, 'manual', 'prueba', 52, NULL);
--     SELECT count(*) FROM inventory_movements
--      WHERE reason = 'prueba' OR reason = 'Ajuste directo desde gestión de inventario';
--     -- debe haber UNA fila nueva, no dos
--   ROLLBACK;
--
-- Y el control de que el trigger SIGUE vivo para lo suyo:
--
--   BEGIN;
--     UPDATE inventory SET total_grams_available = total_grams_available + 1
--      WHERE product_name = 'Café Molido Medio';
--     -- debe aparecer un 'adjustment' automático
--   ROLLBACK;
