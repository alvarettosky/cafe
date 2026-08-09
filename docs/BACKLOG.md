# BACKLOG — Café Mirador CRM

Pendientes reales, clasificados por lo que hace falta para cerrarlos.
Sustituye a `.claude/TODO.md`, que queda como puntero.

- **Última verificación contra el código:** 2026-08-09
- **Documentos hermanos:** [BLUEPRINT](BLUEPRINT.md) · [ROADMAP](ROADMAP.md) · [SYLLABUS](SYLLABUS.md) · [README](../README.md) · [CLAUDE.md](../CLAUDE.md)

## Clasificación

| Clase   | Significado                                                         |
| ------- | ------------------------------------------------------------------- |
| **[A]** | Automatizable ahora: todo lo necesario está en el repo              |
| **[B]** | Requiere una fuente externa (cuenta, clave, aprobación de terceros) |
| **[C]** | Requiere juicio humano o una decisión de producto                   |
| **[D]** | Bloqueado por una dependencia                                       |

---

## ✅ P0-RESTAURACION-2 — El ensayo no miraba las columnas. Cerrado el 2026-08-09 (`039`)

`036` funcionaba en producción y **reventaba al reconstruir la base solo desde
el repositorio**: `ERROR 42703: column "custom_price" does not exist`. Era
correcta contra la única base donde alguien la había probado, y falsa contra la
única que importa el día de un desastre.

La causa de fondo: el paso 6 del ensayo comparaba **objetos y funciones** entre
producción y la base reconstruida, y ahí paraba. Ampliado a **columnas**,
aparecieron cuatro; dos de ellas deriva real que nadie había versionado —
`price_list_items.custom_price` y `price_lists.discount_percent`—, y las dos
las lee el camino que decide el precio de una venta.

**Tercer escalón del mismo modo de fallo, un nivel más abajo cada vez:**

| Migración   | Qué vivía solo en producción             | Qué no lo miraba                                                |
| ----------- | ---------------------------------------- | --------------------------------------------------------------- |
| `030`       | cuatro **vistas** sin `security_invoker` | `pg_class.relrowsecurity` y `pg_policies`, que describen tablas |
| `033`/`034` | seis **funciones**                       | la comparación de tablas                                        |
| `039`       | dos **columnas**                         | la comparación de objetos y funciones                           |

Cada vez, la comprobación existente miraba justo un nivel por encima del sitio
donde estaba el problema.

⚠️ **Y un tercer hallazgo, sobre el ensayo mismo:** en local elige el ZIP con
`ls -t` sobre el **espejo** (`~/Backups/cafe-mirador/`), que solo se refresca
con el timer diario. El 2026-08-09 probó el backup de las 03:45 mientras el de
las 16:57 llevaba media hora en el bucket. No es un fallo de corrección —el
espejo es el artefacto de recuperación local— pero sí un riesgo: puede dar por
bueno un backup viejo mientras el reciente está roto. En CI no pasa (no hay
espejo, baja el último). Pendiente **A24**.

---

## ✅ P0-VENTA — El CRM no podía registrar NI UNA venta. Cerrado el 2026-08-09 (`037` + `038`)

Apareció al comprobar que `036` no hubiera roto el camino de venta. No lo había
roto: **ya estaba roto**, por dos defectos independientes, y ninguno era nuevo.

### Fallo 1 — un trigger contra una columna inexistente (`037`)

`sales` tiene un trigger `AFTER INSERT` que marca al cliente:

```sql
UPDATE customers SET last_purchase_date = NEW.created_at,
                     updated_at = CURRENT_TIMESTAMP   -- <- no existía
```

`customers` nunca tuvo `updated_at`. El trigger falla con `42703` y **revierte
la transacción entera**: sin venta, sin items, sin descuento de inventario.
Aislado con un `INSERT INTO sales` a pelo, sin pasar por ninguna RPC.

### Fallo 2 — la app llamaba a la única de las cuatro sobrecargas que estaba rota (`038`)

Hay **cuatro** `process_coffee_sale`. La de cuatro argumentos es la buena
(gramos, Kardex, validación de stock). La de **cinco** —la que resuelve
PostgREST, porque los dos llamadores mandan `p_customer_recurrence_days`— se
escribió partiendo de una versión anterior del código y habla de un esquema
inexistente: `cost_per_kg`, `cost_per_unit`, `stock_kg`, `stock_units`,
`inventory.updated_at`. Muere en su primera línea útil con `42703`.

Es decir: **desde que se añadió la recurrencia, el POS no ha vendido nunca.**

### Por qué ninguna puerta lo veía

| Puerta              | Por qué no lo vio                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 866 tests unitarios | Usan mocks: comprueban que el componente **llame** a la RPC con ciertos argumentos, no que exista una función capaz de atenderlos                                                           |
| `npm run check:rpc` | Comprueba que la función **exista**. Existe: cuatro veces. No mira cuál resuelve una llamada, ni si su cuerpo cuadra con el esquema                                                         |
| E2E                 | No crea ventas contra la base real                                                                                                                                                          |
| `CLAUDE.md`         | **Ya avisaba** de que `updated_at` no existe en `customers`… como error a evitar al programar. Nadie comprobó si algo en producción lo estaba cometiendo. Un aviso escrito no es una prueba |

Verificado ejecutando una venta completa (en transacción con `ROLLBACK`): stock
5000 → 4500 g, movimiento de Kardex escrito, `customer_recurrence_days` = 15,
`last_purchase_date` actualizada. Y el control negativo: con stock 0 la venta se
rechaza con «Stock insuficiente».

**Esto es la factura de B4**, el pendiente que dice que `check:rpc` verifica
existencia y no firma. Sobrecargar una RPC crea un dispatch que ningún tipo de
TypeScript ve, y el ganador puede ser la copia vieja.

---

## ✅ A23 — Catálogo roto y duplicado. Cerrado el 2026-08-09 (`036`)

**El modelo vivo no era el que decía la documentación.** El BACKLOG y `CLAUDE.md`
afirmaban que el POS ya usaba `products`/`product_variants` y que el portal era
la única parte en el modelo viejo. Medido contra la base:

| Modelo                          | Funciones que lo usan                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `inventory`                     | **28** — `process_coffee_sale` ×4, `get_dashboard_stats`, `get_advanced_metrics`, `edit_sale`, `create_customer_order`, y todo el portal |
| `products` / `product_variants` | **5**, todas de la Fase 4; solo una invocada desde el código, por un componente que ninguna página renderiza                             |

Así que no había dos catálogos divergiendo: había uno vivo y una Fase 4 a medias.

**Lo que se hizo:** fusionar las 12 filas de `inventory` en 5 (había 3 filas de
«Café Molido Medio» de 2.500 g cada una), índice único sobre el nombre para que
no vuelvan, existencias a 0, precios reales (**$45.000 la libra, $25.000 la
media** — decisión del dueño; no es la mitad), y retirar `products`,
`product_variants` y sus 7 funciones.

De paso cerró **A15**: los nombres truncados («Café», «Café en») eran la regex
de `025` quitando «grano» de «Café en Grano» y dejando la preposición huérfana.

### Y un tercer bug, del mismo patrón

`get_product_price_for_customer` leía `inventory.price_per_lb`, **columna que no
existía**: fallaba siempre con `42703`. `new-sale-modal.tsx:220` la llama en cada
venta y manda el error a `console.error`, así que el efecto visible era que la
sugerencia de precio no aparecía nunca. Cerrado dando a `inventory` las dos
columnas que la función llevaba esperando, y exponiéndolas en el modal de
producto.

---

## ✅ P0-SEC-5 — Cualquiera podía hacerse administrador. Cerrado el 2026-08-09 (`035`)

Salió de una pregunta de negocio —«¿estamos listos para producción?»— y no de
una auditoría de seguridad. Dos agujeros, los dos **probados ejecutándolos**
contra producción.

### Fallo 1 — escalada de privilegios, explotable por cualquier usuario

La política `Users can update own profile` era `FOR UPDATE USING (auth.uid() = id)`
**sin `WITH CHECK`**. Postgres reutiliza entonces el `USING` como check, y
`auth.uid() = id` sigue siendo cierto después de cambiarse el rol: la política
limitaba **qué fila** se tocaba, no **qué columnas**. Y la fila propia contiene
el rol propio.

Medido en transacción con `ROLLBACK`, suplantando a un `seller` real:

| Prueba                                               | Resultado                       |
| ---------------------------------------------------- | ------------------------------- |
| `update profiles set role='admin' where id=<propio>` | ✅ devolvió `role=admin`        |
| Lo mismo `where id <> <propio>` (control negativo)   | 0 filas → el RLS **sí** actuaba |

El control negativo importa: sin él, el primer resultado también sería lo que
se ve si el RLS estuviera apagado, que es otro diagnóstico y otra corrección.

Agravante: el registro estaba **abierto al público** (`disable_signup: false`) y
`/login` mostraba «Crear cuenta de vendedor». La cadena completa era
registrarse → confirmar correo → promoverse → leer clientes, ventas, precios e
inventario, y disparar backups y exportaciones.

### Fallo 2 — `customer_contacts` abierta a internet

Sus cuatro políticas eran `USING true` para `public`, y `anon` tenía GRANT. Un
`POST` anónimo devolvía **`23502`** (falta `customer_id`): había pasado permisos
y RLS, y solo lo frenó una restricción de columna.

**Por qué nadie lo vio: la tabla está vacía**, y `check:anon` clasificaba
«200 con `[]`» como `OK_VACIO`. Es la trampa de siempre — vacío no es protegido
— pero esta vez con un giro: el script **ya declaraba** este hueco en su lista
`NO_MIRA` («escritura anónima: solo se comprueba SELECT»). El agujero estaba
donde el propio verificador decía que no miraba. Declarar un hueco no lo tapa.

### Qué se hizo

1. `035`: retirar la política de `profiles`, `REVOKE UPDATE` a `authenticated` y
   `anon`, cerrar `customer_contacts` a staff aprobado, y **revocar toda
   escritura de `anon` sobre `public`** (era GRANT completo en 24 objetos; el
   RLS era lo único que lo contenía). `ALTER DEFAULT PRIVILEGES` para las
   tablas que se creen mañana.
2. `disable_signup: true` y `site_url` a la URL real de Vercel (apuntaba a
   `http://localhost:3000`, así que los correos de confirmación y de
   recuperación eran inservibles en producción).
3. `/login` deja de ofrecer registro, con 3 tests que **fallan contra el código
   anterior** (A/B comprobado: 2 de 3 fallan antes, los 3 pasan después).
4. `check:anon` amplía a **escritura anónima**, con autotest propio.

### Lo que enseñó ampliar el verificador

La primera versión de la sonda mandaba `PATCH` con cuerpo `{}` y reportó **21
tablas escribibles** — todas falsas. Un `PATCH` que no nombra ninguna columna
no hace que Postgres evalúe el privilegio de `UPDATE`: devolvía 204 con el
permiso ya revocado. **La sonda no medía la escritura; no medía nada.**

Se detectó porque contradecía un 401 medido a mano diez minutos antes. Con una
columna en el cuerpo, la misma petición da `42501` como anon y **204 con la
clave secreta** — o sea, distingue. Y la detección se probó con una **trampa
real**: `GRANT UPDATE ... TO anon` sobre `whatsapp_templates`, comprobar que la
trampa **entró** (204 por HTTP), correr el gate (falla y la nombra), revocar.

---

## ✅ P0-BACKUP — El backup no era restaurable. Cerrado el 2026-08-07 (`014` + ensayo)

**Un backup que nunca se ha restaurado no es un backup: es un archivo.** El
workflow diario llevaba meses en `success`, subía su ZIP y ahí terminaba toda la
comprobación. Al intentar restaurarlo por primera vez salieron **tres cosas, y
las tres impedían recuperarse de un desastre**:

| Qué                                                    | Medido                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| El backup respaldaba **20 de 21 tablas**               | Faltaba `customer_type_price_lists` (5 filas): un restore perdía los precios por tipo de cliente |
| **El esquema no era reconstruible** desde el repo      | `021` fallaba: `column c.typical_recurrence_days does not exist`                                 |
| El guard de `029` **abortaba en cualquier base nueva** | Esperaba un predicado que en producción se había creado a mano                                   |

**La causa de fondo del segundo punto:** hay **dos directorios de migraciones**.
`supabase/migrations/` es el canónico, pero `migrations/` (en la raíz, sin
numerar) contiene piezas de las que el canónico depende —`customer_contacts` y
las columnas de recurrencia— que alguien aplicó a mano en su día. Reconstruir
siguiendo el orden canónico era **imposible**, y nadie podía saberlo sin probarlo.

**Lo que se hizo:**

1. [`014_recurrencia_columnas_y_contactos.sql`](../supabase/migrations/014_recurrencia_columnas_y_contactos.sql)
   — trae el eslabón perdido al orden canónico, idempotente (en producción no
   cambia nada).
2. `029` reconoce las **dos** variantes reales del predicado de stock bajo en vez
   de una, sin relajar el guard: sigue abortando ante un predicado desconocido.
3. `customer_type_price_lists` añadida a `TABLES_TO_EXPORT`.
4. [`scripts/restore-drill.sh`](../scripts/restore-drill.sh) — **el ensayo**:
   levanta un Postgres efímero, reconstruye el esquema desde las migraciones,
   carga el último ZIP real y comprueba cobertura. Cableado en
   [`restore-drill.yml`](../.github/workflows/restore-drill.yml): a diario tras
   el backup, y en cada push que toque migraciones, el exportador o el ensayo.

**Verificado ejecutando, no declarando** (2026-08-07): 34 migraciones aplicadas,
0 fallidas · 21 tablas cargadas · 53 filas restauradas · cobertura completa. Y el
ensayo **detecta la regresión**: con un ZIP al que se le quitó `customers.json`
—comprobando antes que el sabotaje estaba dentro— falla y sale con 1.

**Los dos límites que este bloque declaraba, cerrados el mismo día:**

1. ~~El ensayo no prueba que el esquema reconstruido sea idéntico al de
   producción~~ → **ahora sí lo compara.** El paso 6 contrasta lo que producción
   expone (24 objetos, 54 RPC) contra lo que las migraciones reconstruyen, y
   falla si algo vive solo en producción. En su primera corrida encontró **seis
   funciones** que existían únicamente en la base —`edit_sale`, `can_edit_sale`,
   `calculate_customer_recurrence`, `get_customers_to_contact`,
   `get_pending_credits`, `update_customer_recurrence`—, todas del directorio
   suelto `migrations/`. Versionadas en
   [`034`](../supabase/migrations/034_funciones_que_solo_vivian_en_produccion.sql)
   con su DDL real leído de producción. `inventory_for_pricing` no se versionó:
   se **retiró** ([`033`](../supabase/migrations/033_retirar_vista_huerfana_inventory_for_pricing.sql)),
   porque era un placeholder con el precio por libra fijado a 10.00 que no
   usaba nadie.
2. ~~El backup son solo datos: la reconstrucción depende del repo~~ → **el ZIP
   ahora lleva su propio esquema.** `export-tables.ts` copia las migraciones
   dentro del backup, así que el archivo guardado fuera de Supabase es
   autosuficiente, y el ensayo restaura **desde el esquema del propio ZIP**, no
   desde el repo de hoy. Verificado: 37 migraciones aplicadas desde el ZIP, 21
   tablas, 53 filas, paridad completa.

⚠️ **Lo que sigue sin probarse:** que los datos restaurados sean _correctos_ más
allá de que carguen y cuadren en número. Y `edit_sale` se versionó **rota** —
referencia columnas que ya no existen en `inventory`— a propósito: reconstruir de
un desastre debe devolver la base que había, no una mejorada. Arreglarla o
retirarla es A19.

---

## ✅ P0-SEC-4 — Cuatro vistas filtraban datos de clientes. Cerrado el 2026-08-07 (`030`)

**La base seguía abierta, por un tipo de objeto que nadie había mirado.** 027
cerró tablas, 029 cerró funciones. Las **vistas** no son ni una cosa ni la otra:
no tienen RLS propio, así que no aparecen en `pg_class.relrowsecurity` ni en
`pg_policies`, y ninguna de las dos revisiones pasó por ellas.

Medido contra producción con la clave **publishable** — la que viaja en el bundle
y por tanto tiene cualquiera:

| Objeto                                           | Antes de `030`                                                                     | Después             |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------- |
| `customers` / `sales` / `inventory` / `profiles` | `[]`                                                                               | `[]`                |
| `customer_segments`                              | **2 filas**: `full_name`, `phone`, `email`, `last_purchase_date`, `lifetime_value` | `permission denied` |
| `inventory_from_variants`                        | **3 filas**: `cost_per_gram`, `supplier`                                           | `permission denied` |
| `inventory_movement_summary`                     | **2 filas**                                                                        | `permission denied` |
| `inventory_for_pricing`                          | **3 filas**                                                                        | `permission denied` |

Causa: las cuatro se crearon sin `security_invoker`, así que Postgres las evalúa
con los permisos de su **propietario** y saltan el RLS de las tablas base. Y
`anon` tenía `SELECT` sobre las cuatro.

Hoy la base tiene datos de demo (2 clientes), así que lo filtrado es poco. **Pero
el histórico real son 53 clientes identificables**, y la decisión de cargarlos al
CRM sigue abierta ([C]): de haberse cargado antes de este hallazgo, la fuga habría
sido de las 53 personas.

`inventory_for_pricing` no la crea **ninguna migración de este repo**: se creó a
mano en el dashboard. Nadie la consulta desde el código.

**Lo que se hizo:**

1. [`030_cerrar_vistas_security_definer.sql`](../supabase/migrations/030_cerrar_vistas_security_definer.sql)
   — `security_invoker = on` + `REVOKE SELECT FROM anon, PUBLIC` + `GRANT` explícito
   a `authenticated`, con verificación que **aborta la transacción** si algo no
   surtió efecto. Probada antes en transacción revertida, comprobando después que
   el `ROLLBACK` había dejado las vistas intactas.
2. [`scripts/check-anon-exposure.mjs`](../scripts/check-anon-exposure.mjs) —
   fase 8 de `/validate` y paso del CI. No revisa una lista de sospechosos:
   **pregunta a la base qué objetos hay y los prueba todos**, para que el próximo
   objeto quede cubierto sin que nadie se acuerde.
3. Nueve tests que fijan el criterio del verificador (`scripts/__tests__/`).

**Las tres lecciones**

1. **Revisar el mecanismo que conoces no dice nada del que no estás mirando.**
   RLS y políticas describen tablas. La pregunta correcta no era «¿está el RLS
   activo?» sino «¿qué devuelve la base a un anónimo?», que es agnóstica al tipo
   de objeto.
2. **Un control negativo cuyo sabotaje no llega a entrar es un verde falso.** Al
   probar el verificador con una vista trampa, la primera corrida dio VERDE: la
   trampa existía en `pg_class` pero PostgREST aún no la publicaba. Sin comprobar
   que la trampa era **realmente accesible** (`[{"n":1}]` por HTTP), se habría
   apuntado «el gate no detecta» o, peor, «el gate está bien».
3. **Una credencial muerta convierte cualquier auditoría en un aprobado.** La
   primera sonda usó la clave de `.env.local`, legacy desactivada el 2026-07-27:
   todo devolvía 401. Por eso el verificador exige un control positivo — al menos
   un objeto respondiendo 200 — antes de emitir veredicto.

⚠️ **`.env.local` tiene la clave legacy**, no la publishable. Lo creó `vercel link`.
Cualquier cosa que dependa de él contra la base real fallará con «Legacy API keys
are disabled» (entra en [A], abajo).

---

## ✅ P0-SEC-3 — Lo que 027 dejó abierto. Cerrado el 2026-07-27 (`029`)

Una revisión de código sobre las propias migraciones 027 y 028 encontró que
**cerrar el acceso anónimo a nivel de tabla no cerraba el acceso**.

| Qué                                         | Medido antes                                  | Después de `029`         |
| ------------------------------------------- | --------------------------------------------- | ------------------------ |
| Políticas de `sales` que ignoran `approved` | **2** de 3                                    | 0                        |
| Funciones ejecutables por `anon`            | **62**                                        | 13 (solo las del portal) |
| Corte del día para «Ventas Hoy»             | UTC → se reiniciaba a las 19:00 hora Colombia | `America/Bogota`         |
| «Stock bajo»: dashboard vs Analytics        | **5 vs 2** con los mismos datos               | 5 y 5                    |

**Las dos primeras son agujeros de autorización reales.** Cualquiera podía
registrarse —el registro es abierto y toda cuenta nace con `approved = false`—,
confirmar el correo y leer el historial de ventas entero, porque dos políticas
heredadas de `011` seguían vivas y las permisivas se combinan con **OR**. Y con
solo la clave publishable del bundle, `get_advanced_metrics` devolvía ingresos,
costes y beneficio del negocio a cualquiera: Postgres concede `EXECUTE` a
`PUBLIC` por defecto y `SECURITY DEFINER` se salta RLS por definición.

### Las tres lecciones

**1. La lección de 027 se aplicó a medias.** Su propio texto dice que «añadir la
política buena no sirve si no se retira la mala». Se hizo en `customers` e
`inventory` y se pasó por alto en `sales`, porque ahí el trabajo _parecía_ ser
«activar RLS» y no «revisar qué políticas quedan vivas al activarlo».

**2. Un verificador solo prueba lo que mira.** El bloque de verificación de 027
consultaba las cinco tablas y salía en verde — mientras los mismos datos seguían
siendo legibles por la puerta de las RPC, que no consultaba.

**3. Arreglar una pantalla y no la otra es peor que no arreglar ninguna.** 028
cambió el umbral de stock bajo solo en el dashboard. Antes las dos pantallas
estaban igual de mal pero coincidían; después se contradecían, y el usuario no
tenía forma de saber cuál creer.

⚠️ **`029` no puede revocar en bloque.** El portal de clientes no usa Supabase
Auth —se autentica con un token propio en `localStorage`— así que sus llamadas
llegan como `anon`. Sus 13 RPC van en lista blanca explícita dentro de la
migración: **si se añade una llamada nueva al portal hay que añadirla ahí**, o
fallará con «permission denied».

**Riesgo residual, no cerrado:** esas 13 reciben `p_customer_id` como parámetro y
son `SECURITY DEFINER`. Habría que comprobar si validan el token de sesión por
dentro; si no lo hacen, cualquiera con un UUID de cliente podría leer su portal.
Queda fuera del alcance de esta corrección porque exige rediseño, no un permiso.

## ✅ P0-SEC-2 — Token personal filtrado 188 días. REVOCADO el 2026-07-27

**Requiere una acción que solo puede hacer el dueño de la cuenta.**

`exec-sql-direct.py` entró el **2026-01-19** (`d39823e`, el mismo commit que
`execute-sql-node.js`) con un **Personal Access Token** de Supabase incrustado:
`sbp_8099…`, el llamado **`cafedesalento`**.

Un PAT es peor que la `service_role`. No da acceso a una base: da acceso **a la
cuenta entera** — crear y borrar proyectos, leer todas las claves de cualquiera
de ellos, pausar, restaurar. Estuvo vivo hasta el 2026-07-27 (`GET /v1/projects` → HTTP 200); **ya revocado**, comprobado con 401.

El archivo ya se eliminó del repositorio, y con él `VERCEL_QUICK_FIX.html`, que
llevaba una `anon` legacy (esa ya estaba muerta: la mató desactivar las legacy).
**Pero borrarlos no cierra nada.** El token sigue en la historia de git y en
cualquier fork.

| Acción                                    | Clase                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| **Revocar `cafedesalento` (`sbp_8099…`)** | ✅ **HECHO** el 2026-07-27. Verificado: la Management API devuelve **HTTP 401** |

Cómo distinguirlo de los demás: es el que la cuenta del café lista como
`cafedesalento`, sin usar desde hace 5 meses. **No revoques `cafe-julio-2026`
(`sbp_3f61…`)**: ese es el que usan el espejo de backups y el mantenimiento.

**Lo encontró `scripts/check-secrets.mjs`**, el verificador escrito ese mismo día
para la fuga anterior, al pasarlo sobre todo lo versionado en vez de solo sobre
el diff. Sin él nadie lo habría mirado: nadie audita un `.py` suelto en la raíz.

## ✅ P0-SEC — La base estaba abierta a internet. Cerrado el 2026-07-27

Aparecieron **dos fallos independientes** al preparar un commit de formato. Ambos
verificados contra producción, corregidos y comprobados después.

### Fallo 1 — clave `service_role` en un repositorio público, 189 días

`execute-sql-node.js` entró el **2026-01-19** (`d39823e`) con la clave `service_role`
incrustada en el fuente. Este repositorio es **público**. Se comprobó que la clave **seguía
siendo válida**: una consulta a `customers` con ella devolvía HTTP 200. `service_role`
ignora RLS: lectura y escritura sobre todo.

### Fallo 2 — RLS no protegía nada, y era el más grave

La clave `anon` es **pública por diseño**: viaja en el bundle que sirve Vercel. Lo único
que la separa de los datos es RLS. Con solo esa clave, cualquiera leía:

```
customers -> 2 filas    sales -> 1 fila
inventory -> 3 filas    profiles -> 3 filas
```

Dos causas distintas bajo el mismo síntoma:

- `sales` y `sale_items` tenían **RLS desactivado**. Sus políticas estaban bien escritas
  pero **inertes**: una política sin RLS activo no se evalúa. Es el peor modo de fallo,
  porque `pg_policies` las lista con toda normalidad.
- `customers`, `inventory` y `profiles` tenían RLS activo y políticas correctas
  **conviviendo con políticas abiertas**. Las políticas de PostgreSQL son permisivas y se
  combinan con **OR**: basta una que diga `true` para que las demás sobren. La de
  `customers` era `ALL` con `USING true` **y `WITH CHECK true`** — cualquiera podía además
  modificar y **borrar** clientes.

### Qué se hizo, en este orden

| #   | Acción                                                                            | Resultado                                                                                                       |
| --- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | Migrar consumidores legítimos a la clave `sb_secret_`                             | Secreto de GitHub y espejo de backups. Probado con `supabase-js`: tabla y storage OK                            |
| 2   | [`027_cerrar_rls_publico.sql`](../supabase/migrations/027_cerrar_rls_publico.sql) | RLS activo en `sales`/`sale_items`; retiradas las 4 políticas abiertas; `profiles` restringido a la fila propia |
| 3   | Mover producción a la clave `publishable`                                         | Variable en Vercel + redespliegue. Verificado en el bundle servido                                              |
| 4   | Desactivar las claves legacy                                                      | `PUT /api-keys/legacy?enabled=false`. **La `service_role` filtrada pasó a 401 en ~60 s**                        |
| 5   | [`scripts/check-secrets.mjs`](../scripts/check-secrets.mjs) en pre-commit         | Patrón `'*'`, no solo `*.{ts,tsx}`                                                                              |

**Comprobación final:** clave filtrada 401 · anon legacy 401 · lectura anónima 0 filas en
las 8 tablas probadas · `INSERT` anónimo 401 · las 5 rutas de producción en 200.

### Lo que hay que entender de esto

**La `service_role` legacy no se podía revocar sola.** `DELETE /api-keys/{id}` solo acepta
UUID y las legacy no lo tienen; `PUT /api-keys/legacy` desactiva `anon` y `service_role`
**juntas**. Como producción usaba la `anon` legacy, el orden era obligado: primero mover el
despliegue, después apagar. Intentar apagar antes habría tumbado la aplicación.

**Borrar el archivo no habría servido.** La clave seguía en la historia de git, en los
forks y en las cachés de GitHub. Lo único que cierra una fuga es **rotar**.

**Nada lo detectó en enero porque no había nada mirando.** Lint mira estilo, `tsc` mira
tipos, los tests miran comportamiento. Ninguno mira si lo que subes es una credencial. El
fallo 2 es peor todavía: las **cinco** puertas de `/validate` pasaban en verde con la base
abierta al mundo, porque ninguna consulta la base real.

**El keep-alive dependía de la clave que matamos.** Al desactivar las legacy dejó de
funcionar —su alerta saltó correctamente— y hubo que reapuntarlo a la clave publishable.
Al rotar una credencial hay que buscar **todos** sus consumidores, incluidos los que viven
fuera del repositorio.

### Riesgo residual

La clave sigue en la historia de git y en cualquier fork; ya no sirve para nada, pero
**está**. Purgarla exigiría reescribir la historia y un `push --force` a un repositorio
público, lo cual rompe los clones existentes. No se hizo: rotada la credencial, el beneficio
es cosmético.

Queda **sin auditar** si alguien llegó a usar la clave durante los 189 días. Los registros
de Supabase no llegan tan atrás en el plan gratuito.

## ✅ P0 — RESUELTO el 2026-07-27 (dos días antes de la congelación)

| Acción                                     | Resultado                                                                                                                                                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0.1 Restaurar el proyecto                 | ✅ `POST /v1/projects/inszvqzpxfqibkjsptsm/restore` → HTTP 200. `INACTIVE` → `COMING_UP` → **`ACTIVE_HEALTHY` en ~200 s**. DNS resuelve otra vez                                                          |
| P0.2 Verificar que la app sigue sirviendo  | ⚠️ La anon key desplegada no fue rotada — eso era cierto. Pero la prueba usada, `GET /rest/v1/inventory?select=product_id&limit=0` → `[]`, **no demostraba lo que decía demostrar**: ver la nota de abajo |
| P0.3 Reactivar los workflows               | ✅ Los 6 en `active`. Antes había 4 en `disabled_inactivity`                                                                                                                                              |
| P0.4 Romper la circularidad del keep-alive | ✅ Timer de systemd **fuera de GitHub** — ver abajo                                                                                                                                                       |
| P0.5 Backup fuera de Supabase              | ✅ Espejo local con verificación y vigilante de frescura                                                                                                                                                  |

> **La prueba de P0.2 era vacía, y por eso el fallo 2 sobrevivió medio día más.**
> Se interpretó la respuesta `[]` como «RLS está devolviendo vacío al anónimo, correcto».
> Pero la consulta llevaba **`limit=0`**: PostgREST devuelve `[]` con `limit=0` haya RLS o
> no, haya datos o no. La prueba no podía fallar, así que no probaba nada.
>
> La consulta correcta —la misma sin `limit=0`— devolvía **3 filas de inventario a un
> anónimo**. Se descubrió horas después, por casualidad, revisando otra cosa.
>
> **El patrón a reconocer:** una verificación cuyo resultado esperado es «vacío» es
> sospechosa por definición, porque vacío es también lo que devuelve una consulta rota,
> mal filtrada o sin permisos. Antes de aceptar un vacío como prueba de seguridad, hay
> que comprobar que la misma consulta devuelve algo cuando **debe** devolverlo. Aquí
> bastaba con quitar `limit=0`.

### P0.4 — Keep-alive externo a GitHub (resuelto 2026-07-27)

Reactivar los workflows devolvió el keep-alive a la vida, pero no arreglaba el fallo de diseño:
GitHub los vuelve a deshabilitar tras 60 días sin actividad en el repositorio, y el ciclo se
repite. **El guardián solo sobrevivía mientras alguien commiteaba, que es justo cuando no hace
falta que corra.**

Ahora hay un segundo disparador que no depende de GitHub, del repo ni de Vercel — un timer de
systemd de usuario en la máquina del desarrollador:

| Pieza                 | Ruta                                                    |
| --------------------- | ------------------------------------------------------- |
| Script                | `~/.local/bin/cafe-mirador-keepalive.sh`                |
| Servicio              | `~/.config/systemd/user/cafe-mirador-keepalive.service` |
| Timer                 | `~/.config/systemd/user/cafe-mirador-keepalive.timer`   |
| Clave (anon, pública) | `~/.config/cafe-mirador/anon.key` (modo 600)            |
| Log                   | `~/.local/state/cafe-mirador/keepalive.log`             |

Tres decisiones que importan:

- **`OnCalendar=daily`, no cada 5 días.** Supabase pausa a los 7. Diario deja 6 días de margen
  para que la máquina esté apagada; el cron de GitHub dejaba 2.
- **`Persistent=true`.** Sin esto, un equipo apagado a la hora del disparo pierde la ejecución
  sin más — así es como se llega a 7 días sin ping sin enterarse. Con `Persistent`, systemd la
  ejecuta al arrancar. `Linger=yes` ya estaba activo, así que corre sin sesión abierta.
- **09:00 hora local (America/Bogota), no medianoche.** Corregido el 2026-07-27: la primera
  versión disparaba a las 00:26 local, y este timer vive en un equipo personal. Programarlo de
  madrugada garantiza que casi nunca dispare a su hora y que todo dependa del rescate de
  `Persistent`. En horario de trabajo el portátil está encendido y el ping ocurre cuando toca;
  `Persistent` vuelve a ser red de seguridad, no el mecanismo principal.
- **Usa la anon key, no la service role.** Es pública por diseño (viaja en el bundle de
  producción, protegida por RLS): genera tráfico de API sin poner un secreto en el disco.

Verificado el 2026-07-27 en las dos direcciones: ejecución real → `Result=success` y log
`OK HTTP 200 - proyecto despierto`; y la rama de alerta comprobada como alcanzable de verdad
(una clave inválida devuelve 401, no es código muerto). El script distingue los tres modos de
fallo: proyecto pausado (sin DNS pero con internet), clave rotada (401/403) y máquina sin red.

**Riesgo residual, explícito:** si esta máquina pasa **más de 7 días seguidos apagada**, el timer
no alcanza a disparar y el proyecto se vuelve a pausar. Cerrarlo del todo exige un disparador que
no dependa de un equipo personal: el plan Pro de Supabase (sin pausa por inactividad), un cron en
un servidor siempre encendido, o un segundo ping desde otro dispositivo. El keep-alive de GitHub
sigue activo como respaldo, con su límite conocido de 60 días.

### P0.5 — Copia de los backups fuera de Supabase (resuelto 2026-07-27)

El workflow `daily-backup.yml` exporta 20 tablas y sube el ZIP a Supabase Storage. El problema no
era que fallara, sino **dónde dejaba la copia**: dentro del mismo sistema del que debía proteger.
Estuvo a dos días de perderse junto con el proyecto.

**Descartado por peligroso:** subir el ZIP como artefacto de GitHub Actions o como release asset.
Este repositorio es **público**, y los artefactos de repos públicos son descargables por cualquiera.
Sería publicar datos de clientes para resolver un problema de respaldo.

**Implementado:** un segundo timer de systemd que baja el bucket a disco local.

| Pieza            | Ruta                                                                |
| ---------------- | ------------------------------------------------------------------- |
| Script           | `~/.local/bin/cafe-mirador-backup-mirror.sh`                        |
| Servicio + timer | `~/.config/systemd/user/cafe-mirador-backup-mirror.{service,timer}` |
| Destino          | `~/Backups/cafe-mirador/` (retención: últimas 30 copias)            |
| Log              | `~/.local/state/cafe-mirador/mirror.log`                            |

Decisiones que importan:

- **Verifica antes de aceptar.** Cada ZIP descargado pasa `unzip -t` y se comprueba que contenga
  `_metadata.json` antes de darlo por bueno; si no, se descarta. Acumular archivos corruptos
  creyendo que hay respaldo es peor que no tener ninguno.
- **Hace de vigilante, no solo de copiadora.** Si el backup más reciente del bucket supera las 48 h,
  alerta y sale con código 1. Ese es exactamente el fallo que pasó desapercibido 111 días: GitHub
  deshabilitó el workflow y nadie notó que habían dejado de generarse backups. Un espejo que copia
  en silencio un bucket congelado reproduce la misma falsa seguridad.
- **Un solo secreto en disco.** Solo vive el PAT de Supabase (`~/.config/cafe-mirador/supabase.pat`,
  modo 600, revocable desde el dashboard). La `service_role` se pide a la Management API en cada
  ejecución y existe únicamente en memoria.
- **11:00 hora local (America/Bogota)**, con `Persistent=true`. El workflow sube el ZIP a las
  02:00 UTC, que son las 21:00 del día anterior en Colombia; espejarlo a la mañana siguiente lo
  recoge con ~14 h de antigüedad, muy por debajo del umbral de 48 h. Se descartó espejar justo
  después del workflow (22:00 local) porque cae fuera de la franja útil, con el equipo apagado.

Verificado el 2026-07-27: primera ejecución real bajó **11 backups, todos validados** (92 KB), y
**la alerta de frescura saltó de verdad** — detectó que el más reciente tenía 2721 h. El código de
salida 1 era correcto: el bucket llevaba parado desde el 5 de abril. Se normaliza solo cuando el
workflow vuelva a correr.

**Riesgo residual:** el espejo vive en el mismo equipo personal que el keep-alive. Protege de perder
el proyecto de Supabase, no de perder el portátil. Una copia realmente fuera de sitio (disco externo,
almacenamiento cifrado remoto) sigue siendo trabajo pendiente si el volumen de datos lo justifica.

> **Contexto que relativiza la urgencia.** Al inspeccionar el contenido real de los backups, la base
> de producción resultó tener **47 registros en total** (2 clientes, 1 venta, 1 ítem de venta): son
> datos de demo, no un histórico de negocio. El historial real de ventas —53 clientes, de
> 2024-09-26 a 2026-06-03— **nunca estuvo en Supabase**: vive en
> `ventas-y-pagos-cafe-2024-09-26-a-2026-06-03.csv`, versionado desde el 2026-07-27 en el repo
> privado `alvaretto/proyectos-varios`. Conviene decidir si ese histórico debe cargarse al CRM; hasta
> entonces, el activo a proteger es el CSV, no la base.

<details>
<summary>Diagnóstico original del incidente (se conserva por la causa raíz)</summary>

## 🚨 P0 — La base de datos de producción se congelaba el ~2026-07-29

**Estado verificado el 2026-07-27.** El proyecto Supabase **`cafe-de-salento`**
(`inszvqzpxfqibkjsptsm`) lleva ~85 días pausado. Supabase avisó por correo el
24-jul-2026 de que lo **congela permanentemente en 5 días**. Pasada esa fecha
**no se puede restaurar**: solo descargar los datos.

No es un riesgo futuro, ya se materializó: `inszvqzpxfqibkjsptsm.supabase.co`
**no resuelve en DNS**. La app lleva ~85 días sin backend. `/login` sigue
viéndose porque es una ruta prerenderizada, no porque funcione.

Que es el mismo proyecto de esta app está probado: el bundle servido en
<https://cafe-pi-steel.vercel.app> contiene ese host.

### Causa raíz

| #   | Cuándo      | Qué pasó                                                                                                                                                                                          |
| --- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 2026-02-03  | Último commit. El repositorio queda inactivo                                                                                                                                                      |
| 2   | ~2026-04-06 | GitHub deshabilita los workflows programados por inactividad del repo. `gh workflow list --all` los marca `disabled_inactivity`: Daily Backup, E2E Tests, Nightly Tests y **Keep Supabase Alive** |
| 3   | 2026-04-06  | Última ejecución de `keep-alive.yml`, el workflow que existía **exactamente para impedir esta pausa** (ping cada 5 días contra el umbral de 7 de Supabase)                                        |
| 4   | ~2026-04-30 | Supabase pausa el proyecto. Cuadra con los «85 días» del correo                                                                                                                                   |
| 5   | ~2026-07-29 | Congelación permanente                                                                                                                                                                            |

**El keep-alive no falló: lo apagaron.** Un guardián cuya ejecución depende de la
misma actividad que vigila no es un guardián. Mientras el repo tenga commits, el
ping sobra; en cuanto deja de tenerlos —el único caso en que hace falta— GitHub
lo desactiva.

**Agravante:** el último backup automático es del **2026-04-05** (Daily Backup
murió el mismo día que el resto) y vive **dentro del proyecto congelable**. No
existe copia externa más reciente.

### Acciones

| #    | Acción                                                                                 | Clase   | Notas                                                                                                    |
| ---- | -------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------- |
| P0.1 | **Restaurar el proyecto desde <https://supabase.com/dashboard>** antes del 29-jul-2026 | **[B]** | Requiere la sesión de Supabase del dueño. Es la única acción con fecha límite                            |
| P0.2 | Descargar los datos como respaldo externo, restaure o no                               | **[B]** | Ídem                                                                                                     |
| P0.3 | Reactivar los 4 workflows (`gh workflow enable`)                                       | **[B]** | Bloqueado: la cuenta autenticada es `alvaretto` y el repo es de `alvarettosky` (403)                     |
| P0.4 | Romper la circularidad del keep-alive                                                  | **✅**  | Resuelto 2026-07-27 con un timer de systemd de usuario, externo a GitHub. Ver la sección P0.4 más arriba |
| P0.5 | Que el backup deje una copia **fuera** de Supabase                                     | **✅**  | Resuelto 2026-07-27 con un espejo local en systemd. Ver la sección P0.5 más arriba                       |

</details>

### Horarios: todo dentro de 07:00–22:00 hora Colombia

Criterio fijado el 2026-07-27. `America/Bogota` es UTC−5 todo el año (sin horario de verano),
así que la conversión es constante.

| Tarea                         | Dónde corre | Hora Colombia       |
| ----------------------------- | ----------- | ------------------- |
| `keep-alive` (timer local)    | este equipo | 09:00               |
| `backup-mirror` (timer local) | este equipo | 11:00               |
| `keep-alive.yml`              | GitHub      | 07:00 (cada 5 días) |
| `daily-backup.yml`            | GitHub      | 21:00               |
| `e2e.yml`                     | GitHub      | 21:00               |
| `nightly.yml`                 | GitHub      | 22:00               |

La distinción que importa: **los timers locales dependen de que este equipo esté encendido; los
workflows de GitHub no.** Por eso los locales se movieron a horario de trabajo y los de GitHub se
dejaron como estaban — ya caían dentro de la franja y su horario es indiferente al portátil.

## A — Automatizable ahora

| #   | Pendiente                                                           | Notas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Warnings de accesibilidad en `Dialog` (falta `Description`)         | Radix los emite en consola; 10 warnings de ESLint conviven aparte                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| A2  | Modo oscuro/claro con toggle                                        | Hoy el dark es fijo (`<html className="dark">`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| A3  | Accesibilidad: etiquetas ARIA y navegación por teclado              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| A4  | Caché de consultas frecuentes                                       | El dashboard reconsulta en cada montaje                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| A5  | Lazy loading de componentes pesados                                 | `app/portal/suscripcion/page.tsx` son 707 líneas                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| A6  | Optimización de imágenes                                            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| A7  | Service Worker / PWA                                                |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| A8  | Dashboard de métricas de recurrencia                                | Los datos ya existen (`customer_segments`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| A9  | Gráficas de predicción de ventas basadas en recurrencia             | Depende de A8 para no duplicar consultas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| A10 | Animaciones de transición                                           | framer-motion ya está en el proyecto                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| A11 | Etiqueta «Ver en Drive» en `/backups`                               | **Es un fósil**: el almacenamiento es Supabase Storage desde la migración; ya no hay Drive. Cambiar el texto y su aserción en el test                                                                                                                                                                                                                                                                                                                                                                                         |
| A14 | Zona de entrega sin color se pinta transparente                     | `delivery-zones-manager.tsx` no aplica `background-color` cuando `color` es null; el componente hermano `delivery-zone-select.tsx` usa gris `#9CA3AF`. Unificar en el gris es un cambio de producto, no de tipos: por eso se dejó fuera de A12                                                                                                                                                                                                                                                                                |
| A16 | **`.env.local` tiene la clave `anon` LEGACY, desactivada**          | Lo creó `vercel link` antes de la rotación del 2026-07-27. Cualquier cosa que lo use contra la base real falla con `Legacy API keys are disabled`. La viva es la publishable (`~/.config/cafe-mirador/anon.key` en local, secreto `NEXT_PUBLIC_SUPABASE_ANON_KEY` en CI). Descubierto porque una sonda de auditoría dio 401 en todo y casi se lee como «nada expuesto»                                                                                                                                                        |
| A17 | **62 funciones con `search_path` mutable**                          | `get_advisors` security, nivel WARN. En funciones `SECURITY DEFINER` es un vector de escalada: quien controle el `search_path` puede colar objetos propios. Se cierra con `ALTER FUNCTION … SET search_path = public, pg_temp` en una migración por lotes. Medido 2026-08-07                                                                                                                                                                                                                                                  |
| A18 | Protección de contraseñas filtradas desactivada                     | `auth_leaked_password_protection` — Supabase puede contrastar contra HaveIBeenPwned. Es un interruptor del dashboard, no código                                                                                                                                                                                                                                                                                                                                                                                               |
| A19 | **Funciones en la base que nadie invoca** (`036` retiró 7 de ellas) | Medido comparando `pg_proc` con las 38 `.rpc()` del código. Seis son triggers (legítimas). Las demás son features **a medias o abandonadas**: `edit_sale`/`can_edit_sale` (CLAUDE.md las documenta como críticas y ningún componente las llama), `confirm_customer_order`, `cancel_customer_order`, `get_pending_customer_orders`, `apply_referral_code`, `complete_referral_on_purchase`, `get_subscriptions_due_today`. Decidir una por una: cablear o borrar. Es el equivalente aquí del «método que existe y nadie llama» |
| A24 | **El ensayo local prueba el backup del espejo, no el último real**  | `restore-drill.sh` elige con `ls -t` sobre `~/Backups/cafe-mirador/`, que solo se refresca con el timer diario. El 2026-08-09 validó el ZIP de las 03:45 mientras el de las 16:57 llevaba media hora en el bucket. Puede dar por bueno un backup viejo mientras el reciente está roto. En CI no ocurre (sin espejo, baja el último). Arreglo: comparar la fecha del espejo con la del bucket y avisar si va por detrás                                                                                                        |
| A25 | **`price_lists` tiene dos columnas para la misma idea**             | `discount_percent` y `default_discount`. `get_product_price_for_customer` consulta **`default_discount`**; `discount_percent` la versionó `039` porque existía en producción, pero nadie la lee. Decidir cuál sobrevive antes de que alguien rellene la que no se usa y no entienda por qué el descuento no se aplica                                                                                                                                                                                                         |
| A22 | **La suite unitaria no es hermética: lee el entorno**               | Con `SUPABASE_SERVICE_ROLE_KEY` y `NEXT_PUBLIC_SUPABASE_URL` exportadas, **30 tests de 6 archivos fallan**; en una terminal limpia pasan los 866. Medido el 2026-08-09 corriendo `npm test` dos veces seguidas, lo único distinto el entorno. Un test que cambia de veredicto según quién lo lance mide la máquina, no el código — y el día que falle de verdad, nadie lo creerá. Fixture `autouse` que fije los valores DECLARADOS en vez de heredarlos, y un test que compruebe el aislamiento en sí                        |
| A20 | **Tres `.html` derivados versionados en el repo público**           | `README.html`, `SUPABASE_SETUP.html`, `DEPLOY_NETLIFY.html`, ~626 KB cada uno. Un derivado no se actualiza solo: publica lo que el `.md` ya borró, y este repositorio es público. O se regeneran en el mismo commit que su fuente, o salen del índice y van al `.gitignore`                                                                                                                                                                                                                                                   |

## B — Requiere fuente externa

| #   | Pendiente                                       | Qué falta exactamente                                                                                                                                                                                                                                                                                                                        |
| --- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Integración con WhatsApp Business API           | Cuenta de WhatsApp Business + aprobación de Meta. Hoy la integración son enlaces `wa.me` generados                                                                                                                                                                                                                                           |
| B2  | Monitoreo de errores con Sentry                 | Cuenta + DSN                                                                                                                                                                                                                                                                                                                                 |
| B3  | Analytics de producto (GA o Plausible)          | Cuenta + decidir cuál                                                                                                                                                                                                                                                                                                                        |
| B4  | Verificación automática del contrato de las RPC | 🚧 **La mitad ya está hecha.** `npm run check:rpc` (fase 6 de `/validate`, y job `contract-check` en CI) comprueba que **existan** las RPC invocadas — eso ya no puede repetirse. Falta lo otro: que sus **parámetros** cuadren, y eso sí exige `supabase gen types`. Ver [BLUEPRINT §3](BLUEPRINT.md#3-contratos-que-typescript-no-protege) |

## C — Requiere juicio humano

| #   | Pendiente                                                        | La decisión                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | Notificaciones push / recordatorios automáticos                  | ¿Por qué canal? WhatsApp ya es el canal real; push web tiene adopción baja en este público                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| C2  | Tour guiado para nuevos usuarios                                 | Es contenido, no código                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| C3  | `/login` no usa la paleta del design system                      | Usa `zinc-950`/`emerald-500` de Tailwind, no el café `#A0522D`. ¿Deuda o decisión?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| C4  | Alias «cafe-maghela»                                             | No existe en disco. ¿Es un renombre del proyecto o solo un alias conversacional?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| C5  | Dónde vive el design system a largo plazo                        | Hoy en el repo privado `proyectos-varios`. Traerlo a `cafe-repo` lo haría público (no tiene datos sensibles) y lo pondría junto a la app que lo consume                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| C7  | **La recurrencia ajustada al vender no se guarda en el cliente** | `process_coffee_sale` la escribe en `sales.customer_recurrence_days`, y eso es lo que `038` replicó. Pero el modal deja **ajustar** la recurrencia de un cliente existente y ese ajuste se pierde: solo se guarda al **crear** uno nuevo (`new-sale-modal.tsx:286`). Como `customers.typical_recurrence_days` es lo que alimenta `/contactos`, propagarlo es decisión de producto: ¿el valor de una venta debe pisar el del cliente, o solo rellenarlo cuando está vacío?                                                                                                                                                                                                                                                                  |
| C6  | **Cargar el histórico real al CRM**                              | La base de producción tiene **datos de prueba**, no el negocio: 2 clientes («Profe Vanesa» **no existe** en el CSV real; «El mono» no casa con «Mono (FruVer de la 50)»), 1 venta, precios en dólares de demo. El histórico verdadero —**53 clientes · 133 ventas · 159 libras · $6.087.500 vendidos frente a $4.895.500 cobrados**, del 2024-09-26 al 2026-06-03— vive en `ventas-y-pagos-cafe-*.csv`, en el repo **privado**. Mientras no se cargue, la segmentación RFM, la recurrencia y la cartera no tienen con qué trabajar. **A23 quedó cerrado el 2026-08-09**, así que el catálogo ya no bloquea: quedan por decidir los 2 clientes de prueba y si las ventas históricas se atan a «Café Tostado (Grano)» o se reparten por tipo |

## D — Cerrado, y por qué

> **Leer esta sección antes de proponer algo.** Lo que está aquí ya se decidió;
> re-proponerlo cuesta el tiempo de volver a descartarlo.

| Qué                                                                 | Cuándo                 | Por qué se cerró así                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A21** — el portal listaba productos duplicados                    | 2026-08-07 (`032`)     | `inventory` guarda una fila por lote: 10 entradas para 4 productos. Se agrupa por producto eligiendo la fila con **más stock**, porque `create_customer_order` valida contra esa fila concreta y sumar los lotes daría un `available` que el pedido rechazaría después. El `id` sigue siendo un `inventory.product_id` real: contrato intacto. Verificado: 4 entradas, 4 nombres únicos, los 4 ids válidos para pedir. Migrar el portal a `products`/`product_variants` sigue siendo lo correcto a futuro, pero es un ciclo propio                                               |
| **Seis funciones que solo vivían en producción**                    | 2026-08-07 (`034`)     | Las encontró el paso de paridad del ensayo de restauración. Versionadas con su DDL real                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **A15** — el portal no podía listar productos                       | 2026-08-07 (`031`)     | `get_products_for_customer_order` devolvía **HTTP 400 `42803`**: `json_agg(...)` con el `ORDER BY` **fuera** del agregado. SQL que nunca pudo ejecutarse. Corregido moviendo el `ORDER BY` dentro de `json_agg`, con `COALESCE(..., '[]')` y `search_path` fijo. Verificado llamando la RPC con la clave del portal: **10 productos, orden idéntico al de la base**. Ninguna puerta lo veía: `check:rpc` comprueba que la función **exista**, y los tests del portal mockean `supabase.rpc`. El criterio de disponibilidad (`> 500 g`) **no** se tocó: es negocio, no corrección |
| Enlaces de descarga de backups rotos                                | 2026-07-27 (`5ce639e`) | `BackupFile` duplicado; productor emitía `downloadUrl`, consumidor leía `webViewLink`. Tipo único en `types/backups.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Fondo `/coffee-bg-dark.jpg` daba 404                                | 2026-07-27 (`bbf34f4`) | El asset nunca se commiteó. Se agregó el archivo, **no** se quitó la referencia                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `interface Product` ×7                                              | 2026-07-27 (`07ebdda`) | Tres formas distintas bajo un mismo nombre. Cada una con nombre propio en `types/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Regla `backups/` en `.gitignore`                                    | 2026-07-27 (`c7d9335`) | Sin anclar, sombreaba `app/backups/` y `app/api/backups/`; el paso «Applying modifications» de lint-staged fallaba en silencio. Anclada a `/backups/`                                                                                                                                                                                                                                                                                                                                                                                                                            |
| «Tests fallando en `.worktrees/customer-recurrence-sales-editing/`» | 2026-07-27             | **Afirmación fósil**: `git worktree list` muestra solo el principal y `.worktrees/` no existe. No hay nada que arreglar                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Deprecation de Husky v9→v10                                         | 2026-07-27             | Eliminadas las dos líneas que fallarían en v10                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `/alinear-completo` como comando del proyecto                       | 2026-07-27             | Es del pipeline ICFES de otro proyecto. No aplica. Su lugar lo ocupa `/validate`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Datos de ventas en este repositorio                                 | 2026-07-27             | El repo es **público** y el CSV tiene 53 clientes identificables. Viven en el repo privado `proyectos-varios`                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Node 20 vía `setup_env.sh`                                          | 2026-07-27             | `.node_env` no existe y todo (lint, tsc, 865 tests, build) pasa con node v26.4.0. El requisito era de enero                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| A13 — repositorio sin formatear (137 archivos)                      | 2026-07-27 (`256f7d0`) | Formateado entero en un commit aislado. Se agregó `.prettierignore`, que no existía: sin él prettier reescribía 4 `.html`, tres de ellos derivados de un `.md`. `format:check` en verde por primera vez                                                                                                                                                                                                                                                                                                                                                                          |
| A12 — homonimia `Referral`, `ReferralStats`, `DeliveryZone`         | 2026-07-27 (`3988e52`) | Eran **tres** declaraciones por forma, no dos: había una copia anónima inline en cada `.map()`. Nombres propios en `types/referrals.ts` y `types/deliveries.ts`. Detalle en §«La mentira de nulabilidad»                                                                                                                                                                                                                                                                                                                                                                         |
| B5 — ejecutar la suite E2E de Playwright                            | 2026-07-27 (`0599045`) | Corrió en el CI al mergear: **23 tests en verde en los tres navegadores** (chromium 54,7 s · firefox 1,1 min · webkit 1,7 min). No hacía falta ninguna fuente externa — el workflow ya existía y ya instalaba los navegadores; estaba en §B por una suposición, no por una comprobación. Y no eran 7 tests como decían los docs, sino 23                                                                                                                                                                                                                                         |
| `get_dashboard_stats` devolvía 404 en producción                    | 2026-07-27             | La RPC **no estaba desplegada**: `004_dashboard_stats.sql` existía pero nunca se aplicó. Los 4 KPIs del dashboard mostraban `...`. Restaurada y corregida en `028`, con fase 6 de `/validate` para que no vuelva a pasar inadvertido                                                                                                                                                                                                                                                                                                                                             |
| «libra = 453,6 g» en CLAUDE.md, BLUEPRINT y el manual               | 2026-07-27             | `process_coffee_sale` usa **500 g** (y 250 la media). La libra avoirdupois no es la que descuenta el inventario. El comentario de `004` llegó a contradecir a su propio código: decía `/453.59` dividiendo por `500.0`                                                                                                                                                                                                                                                                                                                                                           |
| Errores de Supabase descartados en 13 sitios                        | 2026-07-27             | `const { data } = await supabase…` sin capturar `error`: un 404 y una respuesta vacía eran indistinguibles. Es lo que mantuvo invisible el bug del dashboard. Corregidos los 13, con 11 tests nuevos que lo fijan                                                                                                                                                                                                                                                                                                                                                                |

---

## La mentira de nulabilidad que destapó A12

Vale la pena dejarlo escrito porque no es un caso aislado del programa de
referidos: es cómo se ve este fallo desde dentro.

Las dos declaraciones de `DeliveryZone` describían **la misma consulta** —
`.from('delivery_zones').select('*')` en ambos archivos— y aun así se
contradecían: una daba `delivery_days` y `color` por no nulos, la otra por
nulables. El esquema zanja la discusión: ambas columnas se crearon sin
`NOT NULL` (`022_fase3_crecimiento.sql:106-107`).

Lo que hace instructivo el caso es **por qué nunca se cayó**. Los consumidores
llevaban guardas que el tipo declaraba imposibles:

```ts
const getDaysLabel = (days: string[]) => {
  if (!days || days.length === 0) return 'Sin dias asignados'; // ← inalcanzable según el tipo
```

Quien escribió el código sabía que podían llegar nulos; solo el tipo no se
enteró. Esa guarda era lo único que separaba la pantalla de un crash, y estaba
formalmente marcada como código muerto: cualquiera podía borrarla en una
limpieza «segura», con el respaldo de TypeScript.

**El sintoma a vigilar:** una guarda defensiva contra un valor que el tipo
declara imposible. O sobra el `if`, o miente el tipo. Casi siempre miente el
tipo, porque el `if` lo escribió alguien que había visto el dato real.

## Cómo se alimenta este backlog

1. Un pendiente entra **solo** si está escrito en el código, en un doc del repo o
   se descubrió como consecuencia directa de un trabajo (con su evidencia).
2. Al cerrarse, se mueve a **§D con el motivo**, no se borra.
3. Si un pendiente resulta ser una afirmación fósil, también va a §D — para que
   nadie lo vuelva a «arreglar».

---

## Nota técnica — cómo se cierra B4

Consultado en la documentación oficial del CLI de Supabase (context7,
`/supabase/cli`, 2026-07-27).

El CLI genera los tipos del esquema, **incluidas las firmas de las RPC**:

```bash
supabase gen types --linked          # desde el proyecto enlazado (Management API)
supabase gen types --local           # desde la base local de desarrollo
supabase gen types --db-url '...'    # desde una URL de conexión
```

Con `--linked` o `--project-id` no se abre conexión a la base: el CLI llama al
endpoint `generateTypescriptTypes` de la Management API. Por eso B4 está en §B y
no en §A — hace falta la credencial del proyecto.

**Detalle que importa al implementarlo:** el archivo generado exporta `Json`,
`Database`, `Tables`, `TablesInsert`, `TablesUpdate`, `Enums` y `CompositeTypes`.
**`Functions` NO se exporta como helper independiente**: existe solo como
propiedad anidada dentro de `Database`, por esquema
(`Database['public']['Functions']['process_coffee_sale']`). Quien intente
`import type { Functions }` va a fallar sin entender por qué.

Cerrar B4 significa: generar el archivo, tipar el cliente con
`createClient<Database>(...)` y hacer que las llamadas `.rpc(...)` validen sus
parámetros contra el esquema real. Eso convierte «cambiar una migración rompe el
frontend en silencio» ([BLUEPRINT §3](BLUEPRINT.md#3-contratos-que-typescript-no-protege))
en un error de compilación.
