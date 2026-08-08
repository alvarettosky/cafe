-- 034_funciones_que_solo_vivian_en_produccion.sql
--
-- Seis funciones existian UNICAMENTE en la base de produccion: ninguna
-- migracion de `supabase/migrations/` las crea. Si el proyecto se hubiera
-- perdido, se habrian perdido con el.
--
-- Las destapo el paso de paridad de `scripts/restore-drill.sh` el 2026-08-07,
-- comparando lo que produccion expone contra lo que las migraciones
-- reconstruyen. Antes de ese paso, el ensayo decia "restauracion correcta"
-- porque los datos cargaban — y cargaban, en una base a la que le faltaban seis
-- funciones.
--
-- Vienen del mismo sitio que el eslabon de `014`: `migrations/`, el directorio
-- suelto sin numerar que alguien aplico a mano en enero.
--
-- El cuerpo de abajo NO esta escrito a mano: es `pg_get_functiondef` sobre
-- produccion, que es la unica fuente de verdad para algo que solo vive ahi.
--
-- ⚠️ `edit_sale` se versiona TAL COMO ESTA, y esta rota: referencia
-- `inventory.stock_kg`, `cost_per_kg` y `updated_at`, columnas que hoy no
-- existen en esa tabla. No la llama nadie (BACKLOG A19). Se versiona igual
-- porque el objetivo de esta migracion es que reconstruir de un desastre
-- devuelva la base QUE HABIA, no una mejorada: arreglarla o retirarla es una
-- decision aparte, y ahora por fin es visible en el repo para poder tomarla.

CREATE OR REPLACE FUNCTION public.calculate_customer_recurrence(p_customer_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_recurrence_days INTEGER;
    v_sale_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_sale_count
    FROM sales
    WHERE customer_id = p_customer_id;

    IF v_sale_count < 2 THEN
        RETURN NULL;
    END IF;

    WITH recent_sales AS (
        SELECT created_at
        FROM sales
        WHERE customer_id = p_customer_id
        ORDER BY created_at DESC
        LIMIT 3
    ),
    date_diffs AS (
        SELECT
            created_at,
            LAG(created_at) OVER (ORDER BY created_at DESC) as prev_date
        FROM recent_sales
    )
    SELECT
        ROUND(AVG(EXTRACT(DAY FROM (prev_date - created_at))))::INTEGER
    INTO v_recurrence_days
    FROM date_diffs
    WHERE prev_date IS NOT NULL;

    RETURN v_recurrence_days;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.can_edit_sale(p_sale_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_created_at TIMESTAMPTZ;
    v_hours_elapsed NUMERIC;
BEGIN
    SELECT created_at INTO v_created_at
    FROM sales
    WHERE id = p_sale_id;

    IF v_created_at IS NULL THEN
        RETURN FALSE;
    END IF;

    v_hours_elapsed := EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - v_created_at)) / 3600;

    RETURN v_hours_elapsed < 24;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.edit_sale(p_sale_id uuid, p_customer_id uuid, p_payment_method text, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_can_edit BOOLEAN;
    v_old_items JSONB;
    v_new_total NUMERIC := 0;
    v_new_cost NUMERIC := 0;
    v_new_profit NUMERIC := 0;
    v_item JSONB;
    v_product_id UUID;
    v_old_quantity NUMERIC;
    v_new_quantity NUMERIC;
    v_price NUMERIC;
    v_cost NUMERIC;
    v_unit TEXT;
BEGIN
    v_can_edit := can_edit_sale(p_sale_id);

    IF NOT v_can_edit THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Sale cannot be edited after 24 hours'
        );
    END IF;

    SELECT jsonb_agg(
        jsonb_build_object(
            'product_id', product_id,
            'quantity', quantity,
            'unit', unit
        )
    ) INTO v_old_items
    FROM sale_items
    WHERE sale_id = p_sale_id;

    BEGIN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_old_items)
        LOOP
            v_product_id := (v_item->>'product_id')::UUID;
            v_old_quantity := (v_item->>'quantity')::NUMERIC;
            v_unit := v_item->>'unit';

            IF v_unit = 'kg' THEN
                UPDATE inventory
                SET
                    stock_kg = stock_kg + v_old_quantity,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = v_product_id;
            ELSE
                UPDATE inventory
                SET
                    stock_units = stock_units + v_old_quantity,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = v_product_id;
            END IF;
        END LOOP;

        DELETE FROM sale_items WHERE sale_id = p_sale_id;

        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            v_product_id := (v_item->>'product_id')::UUID;
            v_new_quantity := (v_item->>'quantity')::NUMERIC;
            v_price := (v_item->>'unit_price')::NUMERIC;
            v_unit := v_item->>'unit';

            SELECT
                CASE
                    WHEN v_unit = 'kg' THEN cost_per_kg
                    ELSE cost_per_unit
                END INTO v_cost
            FROM inventory
            WHERE product_id = v_product_id;

            INSERT INTO sale_items (
                sale_id,
                product_id,
                quantity,
                unit,
                unit_price,
                total_price,
                cost_per_unit,
                profit
            ) VALUES (
                p_sale_id,
                v_product_id,
                v_new_quantity,
                v_unit,
                v_price,
                v_price * v_new_quantity,
                v_cost,
                (v_price - v_cost) * v_new_quantity
            );

            IF v_unit = 'kg' THEN
                UPDATE inventory
                SET
                    stock_kg = stock_kg - v_new_quantity,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = v_product_id;
            ELSE
                UPDATE inventory
                SET
                    stock_units = stock_units - v_new_quantity,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = v_product_id;
            END IF;

            v_new_total := v_new_total + (v_price * v_new_quantity);
            v_new_cost := v_new_cost + (v_cost * v_new_quantity);
        END LOOP;

        v_new_profit := v_new_total - v_new_cost;

        UPDATE sales
        SET
            customer_id = p_customer_id,
            payment_method = p_payment_method,
            total_amount = v_new_total,
            total_cost = v_new_cost,
            total_profit = v_new_profit,
            profit_margin = CASE
                WHEN v_new_total > 0 THEN (v_new_profit / v_new_total * 100)
                ELSE 0
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = p_sale_id;

        RETURN jsonb_build_object(
            'success', true,
            'sale_id', p_sale_id,
            'total_amount', v_new_total,
            'total_profit', v_new_profit
        );

    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
    END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_customers_to_contact(p_days_threshold integer DEFAULT 7)
 RETURNS TABLE(customer_id uuid, full_name text, phone text, email text, last_purchase_date timestamp with time zone, typical_recurrence_days integer, days_since_last_purchase integer, days_until_expected integer, urgency text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    WITH customer_data AS (
        SELECT
            c.id,
            c.full_name,
            c.phone,
            c.email,
            c.last_purchase_date,
            c.typical_recurrence_days,
            EXTRACT(DAY FROM (CURRENT_TIMESTAMP - c.last_purchase_date))::INTEGER as days_since_last,
            CASE
                WHEN c.typical_recurrence_days IS NOT NULL THEN
                    c.typical_recurrence_days - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - c.last_purchase_date))::INTEGER
                ELSE
                    NULL
            END as days_until_expected
        FROM customers c
        WHERE c.last_purchase_date IS NOT NULL
    )
    SELECT
        cd.id as customer_id,
        cd.full_name,
        cd.phone,
        cd.email,
        cd.last_purchase_date,
        cd.typical_recurrence_days,
        cd.days_since_last as days_since_last_purchase,
        cd.days_until_expected as days_until_expected,
        CASE
            WHEN cd.days_until_expected IS NULL THEN 'unknown'
            WHEN cd.days_until_expected <= -p_days_threshold THEN 'high'
            WHEN cd.days_until_expected <= 0 THEN 'medium'
            ELSE 'low'
        END as urgency
    FROM customer_data cd
    WHERE
        cd.typical_recurrence_days IS NULL
        OR
        cd.days_until_expected <= 0
    ORDER BY
        CASE
            WHEN cd.days_until_expected IS NULL THEN 3
            WHEN cd.days_until_expected <= -p_days_threshold THEN 1
            WHEN cd.days_until_expected <= 0 THEN 2
            ELSE 3
        END,
        cd.days_since_last DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_pending_credits()
 RETURNS TABLE(sale_id uuid, customer_name text, sale_date timestamp with time zone, amount_due numeric, days_pending integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$                                                                                                                                               
  BEGIN                                                                                                                                               
      RETURN QUERY                                                                                                                                    
      SELECT                                                                                                                                          
          s.id as sale_id,                                                                                                                            
          COALESCE(c.full_name, 'Cliente sin nombre') as customer_name,                                                                               
          s.created_at as sale_date,                                                                                                                  
          s.total_amount as amount_due,                                                                                                               
          EXTRACT(DAY FROM (CURRENT_TIMESTAMP - s.created_at))::INTEGER as days_pending                                                               
      FROM sales s                                                                                                                                    
      LEFT JOIN customers c ON s.customer_id = c.id                                                                                                   
      WHERE s.payment_method = 'Pago a crédito o pendiente'                                                                                           
      ORDER BY s.created_at DESC;                                                                                                                     
  END;                                                                                                                                                
  $function$
;

CREATE OR REPLACE FUNCTION public.update_customer_recurrence(p_customer_id uuid, p_recurrence_days integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    UPDATE customers
    SET
        typical_recurrence_days = p_recurrence_days,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_customer_id;

    RETURN FOUND;
END;
$function$
;
