-- 029_cerrar_hallazgos_code_review.sql
--
-- Cierra cuatro hallazgos de la revision de codigo del 2026-07-27 sobre las
-- migraciones 027 y 028. Los cuatro estan verificados contra produccion, no
-- deducidos de leer los .sql.
--
-- ===========================================================================
-- 1. `sales` tenia RLS activo... y dos politicas que ignoran `approved`
-- ===========================================================================
--
-- 027 activo RLS en `sales` dando por hecho que sus politicas eran correctas.
-- Dos de las tres no lo son: vienen de `011_roles_and_permissions.sql`, son
-- anteriores al sistema de aprobacion, y `020_user_approval.sql` nunca las
-- retiro. Comprobado contra produccion:
--
--   SI  ALL     Approved employees can CRUD sales      <- la buena
--   NO  INSERT  Authenticated users can insert sales
--   NO  SELECT  Users see own sales, Admins see all
--
-- El registro es abierto y cada cuenta nace con `approved = false`. Como las
-- politicas permisivas se combinan con **OR**, en cuanto una cuenta sin
-- aprobar confirmaba su correo podia leer el historial de ventas entero e
-- insertar ventas falsas. Es exactamente el agujero que 020 existe para cerrar,
-- reabierto en la unica tabla que 027 acababa de «asegurar».
--
-- Es la misma leccion de 027 sin aprender del todo: **anadir la politica buena
-- no sirve de nada si no se retira la mala.** 027 lo aplico a `customers` e
-- `inventory` y se le paso `sales`, porque ahi el trabajo parecia ser «activar
-- RLS» y no «revisar que politicas quedan vivas al activarlo».

DROP POLICY IF EXISTS "Authenticated users can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Users see own sales, Admins see all" ON public.sales;

-- ===========================================================================
-- 2. 62 funciones eran ejecutables por `anon`
-- ===========================================================================
--
-- 027 cerro el acceso anonimo **a nivel de tabla** y dio el trabajo por hecho.
-- Pero Postgres concede EXECUTE a PUBLIC por defecto en cada funcion, y las
-- SECURITY DEFINER se saltan RLS por definicion: la puerta seguia abierta un
-- piso mas arriba. Medido: **62 funciones ejecutables por `anon`**.
--
-- La mas cara era `get_advanced_metrics`, SECURITY DEFINER y sin ninguna
-- comprobacion de autorizacion en su cuerpo: con la clave publishable —que va
-- en el bundle publico— devolvia ingresos, costes, beneficio, ticket medio y
-- top de productos del negocio entero.
--
-- El bloque de verificacion de 027 solo consultaba las cinco tablas, asi que
-- reportaba exito mientras los datos seguian siendo legibles por otra via. Un
-- verificador solo prueba lo que mira.
--
-- ⚠️ NO se puede revocar en bloque. El portal de clientes **no usa Supabase
-- Auth**: se autentica con un token de sesion propio en `localStorage`, asi que
-- sus llamadas llegan con el rol `anon`. Revocarle EXECUTE dejaria a los
-- clientes sin portal. Las 13 que necesita van en lista blanca explicita.

DO $$
DECLARE
    f RECORD;
    -- Las 13 RPC que el portal invoca como `anon`, extraidas de app/portal/**
    -- y context/customer-portal-context.tsx. Si se agrega una llamada nueva al
    -- portal hay que anadirla aqui, o fallara con «permission denied».
    portal_publico TEXT[] := ARRAY[
        'validate_customer_magic_link',
        'validate_customer_session',
        'logout_customer_session',
        'get_customer_portal_dashboard',
        'get_customer_order_history',
        'get_products_for_customer_order',
        'create_customer_order',
        'update_customer_profile',
        'get_customer_subscription',
        'upsert_customer_subscription',
        'toggle_subscription_status',
        'generate_referral_code',
        'get_my_referrals'
    ];
BEGIN
    FOR f IN
        SELECT p.oid::regprocedure AS firma, p.proname
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'
          AND NOT (p.proname = ANY(portal_publico))
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.firma);
        -- Devolver explicitamente lo que el staff necesita: revocar de PUBLIC
        -- se lo quita tambien a `authenticated`, que lo tenia por herencia.
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.firma);
    END LOOP;
END $$;

-- ===========================================================================
-- 3. «Ventas Hoy» se ponia a cero a las 19:00 hora de Colombia
-- ===========================================================================
--
-- La sesion de PostgREST corre en **UTC** (comprobado:
-- `current_setting('TimeZone')` -> `UTC`), asi que `CURRENT_DATE` es la fecha
-- UTC. A las 19:00 en Colombia ya son las 00:00 UTC del dia siguiente: el
-- umbral saltaba y **las ventas de toda la jornada dejaban de sumarse**. Quien
-- cerrara caja a las 20:00 veia «Ventas Hoy: $0» habiendo vendido todo el dia.
--
-- El comentario de `004` lo avisaba —«Using CURRENT_DATE to assume server time
-- match, ideally convert to timezone if needed»— y la migracion 028, que se
-- presentaba como su correccion, reescribio ese mismo WHERE para anadirle el
-- filtro de estados y dejo el `CURRENT_DATE` intacto. Se corrigio lo que se
-- estaba mirando y se paso por alto lo que ya estaba senalado en la linea de al
-- lado.
--
-- `America/Bogota` es UTC-5 todo el ano (sin horario de verano), pero se deja
-- expresado con el nombre de la zona y no con un desplazamiento fijo.

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_inventory_grams INTEGER;
    v_sales_today NUMERIC(10,2);
    v_low_stock_count INTEGER;
    v_roasted_coffee_lbs NUMERIC(10,2);
    v_inicio_dia_local TIMESTAMPTZ;
BEGIN
    -- Medianoche de hoy en Colombia, expresada como instante absoluto.
    v_inicio_dia_local := ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date)
                          AT TIME ZONE 'America/Bogota';

    SELECT COALESCE(SUM(total_grams_available), 0)
    INTO v_total_inventory_grams
    FROM inventory;

    -- Solo ingreso real: se excluyen los pedidos del portal sin confirmar y los
    -- cancelados. NULL cuenta (DEFAULT de la columna = 'completed').
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_sales_today
    FROM sales
    WHERE created_at >= v_inicio_dia_local
      AND (status IS NULL
           OR status NOT IN ('pending_confirmation', 'pending', 'cancelled'));

    -- Umbral por producto. `<=` para que un producto que esta JUSTO en su punto
    -- de reposicion se marque: es cuando hay que pedir.
    SELECT COUNT(*)
    INTO v_low_stock_count
    FROM inventory
    WHERE total_grams_available <= COALESCE(reorder_point, 2500);

    -- 500 g = 1 libra, igual que `process_coffee_sale`. No es la libra
    -- avoirdupois (453,59 g): es la libra comercial que usa este negocio.
    SELECT COALESCE(SUM(total_grams_available), 0) / 500.0
    INTO v_roasted_coffee_lbs
    FROM inventory
    WHERE product_name ILIKE '%Tostado%';

    RETURN jsonb_build_object(
        'total_inventory_grams', v_total_inventory_grams,
        'sales_today',           v_sales_today,
        'low_stock_count',       v_low_stock_count,
        'roasted_coffee_lbs',    v_roasted_coffee_lbs
    );
END;
$$;

REVOKE ALL ON FUNCTION get_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;

-- ===========================================================================
-- 4. El dashboard y Analytics contaban «stock bajo» de forma distinta
-- ===========================================================================
--
-- 028 cambio el umbral a `<= COALESCE(reorder_point, 2500)` solo en
-- `get_dashboard_stats`. `get_advanced_metrics`, que alimenta /analytics, se
-- quedo con `< COALESCE(reorder_point, 1000)`. Difieren en **dos** cosas: el
-- operador y el valor por defecto.
--
-- Con los datos de hoy eso da 5 productos en el dashboard y 2 en Analytics, en
-- el mismo minuto y sobre la misma tabla. El usuario no tiene forma de saber
-- cual creer, y la alerta roja del dashboard queda desmentida por la pantalla
-- de al lado. Arreglar una pantalla y no la otra crea una contradiccion que es
-- peor que el error original: antes las dos estaban igual de mal, pero al menos
-- coincidian.
--
-- Se unifica en el criterio del dashboard, que es el correcto: hay que pedir
-- cuando se **alcanza** el punto de reposicion, no cuando ya se ha pasado.
--
-- Se reescribe solo la expresion de `low_stock_items`; el resto del cuerpo de
-- la funcion se conserva tal cual.

-- Se toma la definicion viva con `pg_get_functiondef`, se sustituye SOLO ese
-- predicado y se vuelve a crear. Asi no hay que copiar aqui un cuerpo de 80
-- lineas que quedaria desincronizado en cuanto alguien toque la funcion.
DO $$
DECLARE
    def TEXT;
    viejo CONSTANT TEXT := '< COALESCE(reorder_point, 1000)';
    nuevo CONSTANT TEXT := '<= COALESCE(reorder_point, 2500)';
BEGIN
    SELECT pg_get_functiondef(p.oid) INTO def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_advanced_metrics'
    LIMIT 1;

    IF def IS NULL THEN
        RAISE NOTICE 'get_advanced_metrics no existe; nada que unificar';
    ELSIF position(nuevo in def) > 0 THEN
        RAISE NOTICE 'get_advanced_metrics ya usa el umbral unificado; nada que hacer';
    ELSIF position(viejo in def) = 0 THEN
        -- Falla ruidosamente. Si el predicado no es el esperado, aplicar el
        -- reemplazo a ciegas dejaria las dos pantallas discrepando en silencio,
        -- que es justo el defecto que esta migracion viene a cerrar.
        RAISE EXCEPTION 'get_advanced_metrics no contiene el predicado esperado (%). Revisar a mano antes de unificar el umbral.', viejo;
    ELSE
        EXECUTE replace(def, viejo, nuevo);
        RAISE NOTICE 'get_advanced_metrics: umbral unificado con get_dashboard_stats';
    END IF;
END $$;

-- ===========================================================================
-- VERIFICACION (ejecutar despues; un vacio NO es un aprobado por si solo)
-- ===========================================================================
--
--   -- 1. no debe quedar ninguna politica de `sales` sin comprobar `approved`
--   SELECT policyname FROM pg_policies
--    WHERE tablename = 'sales'
--      AND coalesce(qual,'') || coalesce(with_check,'') NOT LIKE '%approved%';
--
--   -- 2. `anon` solo debe poder ejecutar las 13 del portal
--   SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.prokind = 'f'
--      AND has_function_privilege('anon', p.oid, 'EXECUTE');
--
--   -- 3. y `authenticated` debe seguir pudiendo con todas
--   SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.prokind = 'f'
--      AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE');
--
--   -- 4. las dos pantallas deben coincidir
--   SELECT (get_dashboard_stats()->>'low_stock_count')::int AS dashboard,
--          (SELECT count(*) FROM inventory
--            WHERE total_grams_available <= COALESCE(reorder_point, 2500)) AS esperado;
