-- 035_cerrar_escalada_de_privilegios_y_escritura_anonima.sql
--
-- Cierra DOS agujeros VERIFICADOS CONTRA PRODUCCION el 2026-08-09, ninguno
-- deducido de leer los .sql: los dos se probaron ejecutandolos.
--
-- ===========================================================================
-- 1. Cualquiera que iniciara sesion podia hacerse administrador
-- ===========================================================================
--
-- La politica `Users can update own profile` era:
--
--     FOR UPDATE TO public USING (auth.uid() = id)          -- sin WITH CHECK
--
-- Cuando un UPDATE no declara WITH CHECK, Postgres reutiliza el USING como
-- check. Y `auth.uid() = id` sigue siendo cierto DESPUES de cambiar `role` y
-- `approved`: la politica limita QUE FILA se toca, no QUE COLUMNAS. La fila
-- propia incluye el rol propio.
--
-- Medido contra la base de produccion, en transaccion con ROLLBACK:
--
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<uuid de un seller>", ...}';
--   update profiles set role='admin', approved=true where id='<mismo uuid>'
--     -> DEVUELVE LA FILA: role=admin, approved=true          <-- ESCALADA
--
-- Control negativo de esa medicion (para descartar que el RLS estuviera
-- apagado y el resultado no significara nada): el mismo UPDATE sobre
-- `id <> <uuid propio>` devuelve **0 filas**. O sea el RLS SI estaba
-- actuando; lo que fallaba era el alcance de la politica, no su existencia.
-- `pg_class.relrowsecurity` = true en `profiles`, comprobado aparte.
--
-- Agravante: el registro estaba abierto al publico (`disable_signup: false`)
-- y `/login` muestra el boton «Crear cuenta de vendedor». La cadena completa
-- era: registrarse -> confirmar correo -> promoverse a admin -> leer clientes,
-- ventas, precios e inventario, y disparar backups y exportaciones.
--
-- El trigger `handle_new_user` da de alta con `approved=false`, que era la
-- unica defensa... y `approved` es justo una de las dos columnas que la
-- politica dejaba editar al propio interesado.
--
-- Se RETIRA la politica entera en vez de acotarla porque **nadie la usa**:
-- las cuatro referencias a `profiles` del codigo (`components/auth-provider.tsx`,
-- `app/api/export/route.ts`, `app/api/backups/{list,trigger}/route.ts`) son
-- `.select()`. No hay un solo `.update()` sobre `profiles` en `app/`, `lib/`
-- ni `components/`.
--
-- ⚠️ La app SI aprueba usuarios, pero no por ahi: `PendingUsersModal` llama a
-- `approve_user()` / `reject_user()`, las dos `SECURITY DEFINER` y propiedad de
-- `postgres`, asi que se ejecutan con los permisos del propietario y el REVOKE
-- no las toca. Comprobado ejecutandolo, no leyendolo: dentro de una transaccion
-- con ROLLBACK se dejo a un seller en `approved=false`, se llamo a
-- `approve_user()` como el admin real y la fila volvio a `approved=true`.
-- El UPDATE directo del mismo admin sobre `profiles`, en cambio, ahora da 42501
-- — que es exactamente lo que se buscaba: el rol se cambia por la puerta que
-- comprueba quien llama, no por la que solo comprueba que fila se toca.
--
-- Si algun dia se quiere que cada quien edite su propio nombre, la forma
-- correcta NO es devolver esta politica, es un GRANT por columna:
--
--     GRANT UPDATE (full_name) ON public.profiles TO authenticated;
--     CREATE POLICY ... FOR UPDATE USING (auth.uid() = id)
--                                 WITH CHECK (auth.uid() = id);
--
-- ===========================================================================
-- 2. `customer_contacts` estaba abierta a internet: leer, escribir y BORRAR
-- ===========================================================================
--
-- Sus cuatro politicas eran `USING true` / `WITH CHECK true` para `public`,
-- que incluye a `anon`. Y `anon` tiene GRANT de todo sobre la tabla.
--
-- Medido con la clave publishable, la que viaja en el bundle:
--
--   POST /rest/v1/customer_contacts  {}   ->  HTTP 400  code 23502
--       'null value in column "customer_id" violates not-null constraint'
--
-- Un 23502 es la prueba: la peticion PASO permisos y RLS, y solo la freno una
-- restriccion de columna. Si `anon` no hubiera podido escribir, PostgREST
-- habria contestado 401/403 sin llegar a mirar el contenido.
--
-- Hoy la tabla esta VACIA, asi que no hay fuga consumada — y por eso mismo no
-- la vio nadie: `check:anon` clasifica «200 con []» como OK_VACIO. Es la
-- trampa de siempre: **vacio no es protegido**. El dia que el CRM guarde el
-- primer contacto, ese contacto es publico y cualquiera puede borrarlo.
--
-- ===========================================================================
-- 3. Por que ademas se revoca la escritura anonima en TODAS las tablas
-- ===========================================================================
--
-- `anon` tiene INSERT/UPDATE/DELETE/TRUNCATE sobre las 24 tablas de `public`
-- (es el GRANT por defecto de Supabase). Lo unico que lo contiene es el RLS
-- de cada tabla, una a una. `customer_contacts` demuestra lo que cuesta que
-- se escape una: basta una politica `true` para que el GRANT se vuelva real.
--
-- Se retira el permiso de escritura de raiz, para que el RLS deje de ser la
-- unica linea. Es seguro: **el portal publico no escribe en ninguna tabla.**
-- Sus 13 llamadas van todas por RPC `SECURITY DEFINER` (verificado en
-- `app/portal/**`: cero `.insert(`, `.update(`, `.delete(`, `.upsert(`), y una
-- funcion SECURITY DEFINER se ejecuta con los permisos de su propietario, no
-- con los de `anon`. El SELECT no se toca: ahi el RLS ya esta medido y cerrado.
--
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Nadie se promociona a si mismo
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Cinturon ademas del tirante: aunque alguien recree una politica abierta,
-- sin GRANT no hay UPDATE posible desde el cliente.
REVOKE UPDATE ON public.profiles FROM authenticated, anon;

-- ---------------------------------------------------------------------------
-- 2. `customer_contacts` pasa a las mismas reglas que `customers`
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable read access for all users" ON public.customer_contacts;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.customer_contacts;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.customer_contacts;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.customer_contacts;

CREATE POLICY "Approved employees can manage customer_contacts"
  ON public.customer_contacts
  FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.approved = true
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.approved = true
    )
  );

-- ---------------------------------------------------------------------------
-- 3. `anon` deja de poder escribir en `public`
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;

-- Y que tampoco lo herede una tabla que se cree manana.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon;

COMMIT;

-- ===========================================================================
-- Como comprobar que esto quedo cerrado (con control positivo, no a ojo)
-- ===========================================================================
--
--   npm run check:anon        # ampliado en esta misma sesion: ahora sondea
--                             # ESCRITURA anonima, no solo SELECT
--
-- A mano, con la clave publishable:
--
--   POST /rest/v1/customer_contacts {}      -> 401/403  (antes: 400 / 23502)
--   PATCH /rest/v1/customers?id=eq.<real>   -> 401/403  (antes: 200 con [])
--
-- Y el control positivo que evita leerse un 401 como «seguro»: la MISMA
-- peticion con la clave secreta debe seguir funcionando (200 con 1 fila).
-- Si las dos fallan, lo roto es la sonda, no el agujero.
