-- 027_cerrar_rls_publico.sql
--
-- Cierra el acceso anonimo a la base de produccion.
--
-- CONTEXTO (verificado el 2026-07-27 contra la base en produccion)
--
-- La clave `anon` es publica por diseño: viaja en el bundle de JavaScript que
-- sirve Vercel, asi que cualquiera puede extraerla del navegador. Lo unico que
-- separa esa clave de los datos es RLS. Y RLS no estaba haciendo su trabajo:
--
--   curl .../rest/v1/customers -H "apikey: <anon>"   -> 2 filas
--   curl .../rest/v1/sales     -H "apikey: <anon>"   -> 1 fila
--   curl .../rest/v1/inventory -H "apikey: <anon>"   -> 3 filas
--   curl .../rest/v1/profiles  -H "apikey: <anon>"   -> 3 filas
--
-- Eran dos fallos distintos:
--
--   1. `sales` y `sale_items` tenian RLS DESACTIVADO. Sus politicas
--      ("Approved employees can CRUD...") estaban bien escritas pero inertes:
--      una politica sin RLS activo no se evalua. Es el peor modo de fallo,
--      porque `pg_policies` las lista con normalidad y todo parece correcto.
--
--   2. `customers`, `inventory` y `profiles` tenian RLS activo y politicas
--      correctas, pero CONVIVIENDO con politicas abiertas. Las politicas de
--      PostgreSQL son permisivas y se combinan con OR: basta una que diga
--      `true` para que las demas den igual. La de `customers` era `ALL` con
--      `USING true` y `WITH CHECK true`, es decir, cualquiera con la clave
--      publica podia tambien MODIFICAR y BORRAR clientes.
--
-- Lo que este script NO hace: crear politicas nuevas para el acceso legitimo.
-- No hace falta. Las politicas que reconocen al empleado aprobado ya existen y
-- son correctas; lo que sobraba era lo abierto.
--
-- COMPROBADO ANTES DE ESCRIBIRLO
--
--   - Los RPC que escriben ventas (`process_coffee_sale`, `edit_sale`,
--     `create_customer_order`, ...) son SECURITY DEFINER: ignoran RLS, asi que
--     activarlo en `sales`/`sale_items` no rompe el alta ni la edicion.
--   - Los RPC de administracion (`get_pending_users`, `approve_user`,
--     `reject_user`) tambien son SECURITY DEFINER: siguen viendo los perfiles
--     ajenos aunque `profiles` quede restringido a la fila propia.
--   - Las 4 lecturas directas de `profiles` en el codigo
--     (auth-provider y las 3 rutas de API) filtran por `.eq('id', user.id)`:
--     leen su propia fila, que es justo lo que la politica nueva permite.
--
-- La politica de `profiles` se limita a `auth.uid() = id` y NO consulta
-- `profiles` para comprobar si quien pregunta es admin. Hacerlo provocaria
-- recursion infinita: evaluar la politica exigiria leer la tabla que la
-- politica protege. El caso de admin ya esta cubierto por las funciones
-- SECURITY DEFINER.

BEGIN;

-- 1. Politicas correctas pero inertes: faltaba activar RLS.
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- 2. `Public Access` permitia leer, insertar, modificar y BORRAR clientes a
--    cualquiera. La politica de empleados aprobados se conserva.
DROP POLICY IF EXISTS "Public Access" ON public.customers;

-- 3. Dos politicas abiertas de lectura sobre inventario. Se conserva
--    "Approved users can read inventory" y las tres de admin para escritura.
DROP POLICY IF EXISTS "Allow public read access" ON public.inventory;
DROP POLICY IF EXISTS "Anyone can read inventory" ON public.inventory;

-- 4. `profiles` expone el rol y el estado de aprobacion de cada usuario:
--    es el mapa de quien es administrador. Queda restringido a la fila propia.
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;

CREATE POLICY "Users read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

COMMIT;

-- VERIFICACION (con la clave anon, desde fuera):
--
--   for t in customers sales sale_items inventory profiles; do
--     curl -s ".../rest/v1/$t?select=*&limit=1" -H "apikey: <anon>"
--   done
--
-- Todas deben devolver `[]`. Una respuesta con filas significa que queda una
-- politica permisiva sin retirar.
