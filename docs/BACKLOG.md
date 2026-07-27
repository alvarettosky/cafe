# BACKLOG — Café Mirador CRM

Pendientes reales, clasificados por lo que hace falta para cerrarlos.
Sustituye a `.claude/TODO.md`, que queda como puntero.

- **Última verificación contra el código:** 2026-07-27
- **Documentos hermanos:** [BLUEPRINT](BLUEPRINT.md) · [ROADMAP](ROADMAP.md) · [SYLLABUS](SYLLABUS.md) · [README](../README.md) · [CLAUDE.md](../CLAUDE.md)

## Clasificación

| Clase   | Significado                                                         |
| ------- | ------------------------------------------------------------------- |
| **[A]** | Automatizable ahora: todo lo necesario está en el repo              |
| **[B]** | Requiere una fuente externa (cuenta, clave, aprobación de terceros) |
| **[C]** | Requiere juicio humano o una decisión de producto                   |
| **[D]** | Bloqueado por una dependencia                                       |

---

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

| #   | Pendiente                                                   | Notas                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Warnings de accesibilidad en `Dialog` (falta `Description`) | Radix los emite en consola; 10 warnings de ESLint conviven aparte                                                                                                                                                                              |
| A2  | Modo oscuro/claro con toggle                                | Hoy el dark es fijo (`<html className="dark">`)                                                                                                                                                                                                |
| A3  | Accesibilidad: etiquetas ARIA y navegación por teclado      |                                                                                                                                                                                                                                                |
| A4  | Caché de consultas frecuentes                               | El dashboard reconsulta en cada montaje                                                                                                                                                                                                        |
| A5  | Lazy loading de componentes pesados                         | `app/portal/suscripcion/page.tsx` son 707 líneas                                                                                                                                                                                               |
| A6  | Optimización de imágenes                                    |                                                                                                                                                                                                                                                |
| A7  | Service Worker / PWA                                        |                                                                                                                                                                                                                                                |
| A8  | Dashboard de métricas de recurrencia                        | Los datos ya existen (`customer_segments`)                                                                                                                                                                                                     |
| A9  | Gráficas de predicción de ventas basadas en recurrencia     | Depende de A8 para no duplicar consultas                                                                                                                                                                                                       |
| A10 | Animaciones de transición                                   | framer-motion ya está en el proyecto                                                                                                                                                                                                           |
| A11 | Etiqueta «Ver en Drive» en `/backups`                       | **Es un fósil**: el almacenamiento es Supabase Storage desde la migración; ya no hay Drive. Cambiar el texto y su aserción en el test                                                                                                          |
| A14 | Zona de entrega sin color se pinta transparente             | `delivery-zones-manager.tsx` no aplica `background-color` cuando `color` es null; el componente hermano `delivery-zone-select.tsx` usa gris `#9CA3AF`. Unificar en el gris es un cambio de producto, no de tipos: por eso se dejó fuera de A12 |

## B — Requiere fuente externa

| #   | Pendiente                                       | Qué falta exactamente                                                                                                                                                                 |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Integración con WhatsApp Business API           | Cuenta de WhatsApp Business + aprobación de Meta. Hoy la integración son enlaces `wa.me` generados                                                                                    |
| B2  | Monitoreo de errores con Sentry                 | Cuenta + DSN                                                                                                                                                                          |
| B3  | Analytics de producto (GA o Plausible)          | Cuenta + decidir cuál                                                                                                                                                                 |
| B4  | Verificación automática del contrato de las RPC | Necesita `.env.local` con credenciales de Supabase para generar tipos desde el esquema (`supabase gen types`). Ver [BLUEPRINT §3](BLUEPRINT.md#3-contratos-que-typescript-no-protege) |
| B5  | Ejecutar la suite E2E de Playwright             | Requiere navegadores instalados + servidor levantado. Los 7 tests existen pero **no se han ejecutado en esta verificación**                                                           |

## C — Requiere juicio humano

| #   | Pendiente                                       | La decisión                                                                                                                                             |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Notificaciones push / recordatorios automáticos | ¿Por qué canal? WhatsApp ya es el canal real; push web tiene adopción baja en este público                                                              |
| C2  | Tour guiado para nuevos usuarios                | Es contenido, no código                                                                                                                                 |
| C3  | `/login` no usa la paleta del design system     | Usa `zinc-950`/`emerald-500` de Tailwind, no el café `#A0522D`. ¿Deuda o decisión?                                                                      |
| C4  | Alias «cafe-maghela»                            | No existe en disco. ¿Es un renombre del proyecto o solo un alias conversacional?                                                                        |
| C5  | Dónde vive el design system a largo plazo       | Hoy en el repo privado `proyectos-varios`. Traerlo a `cafe-repo` lo haría público (no tiene datos sensibles) y lo pondría junto a la app que lo consume |

## D — Cerrado, y por qué

> **Leer esta sección antes de proponer algo.** Lo que está aquí ya se decidió;
> re-proponerlo cuesta el tiempo de volver a descartarlo.

| Qué                                                                 | Cuándo                 | Por qué se cerró así                                                                                                                                                                                     |
| ------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enlaces de descarga de backups rotos                                | 2026-07-27 (`5ce639e`) | `BackupFile` duplicado; productor emitía `downloadUrl`, consumidor leía `webViewLink`. Tipo único en `types/backups.ts`                                                                                  |
| Fondo `/coffee-bg-dark.jpg` daba 404                                | 2026-07-27 (`bbf34f4`) | El asset nunca se commiteó. Se agregó el archivo, **no** se quitó la referencia                                                                                                                          |
| `interface Product` ×7                                              | 2026-07-27 (`07ebdda`) | Tres formas distintas bajo un mismo nombre. Cada una con nombre propio en `types/`                                                                                                                       |
| Regla `backups/` en `.gitignore`                                    | 2026-07-27 (`c7d9335`) | Sin anclar, sombreaba `app/backups/` y `app/api/backups/`; el paso «Applying modifications» de lint-staged fallaba en silencio. Anclada a `/backups/`                                                    |
| «Tests fallando en `.worktrees/customer-recurrence-sales-editing/`» | 2026-07-27             | **Afirmación fósil**: `git worktree list` muestra solo el principal y `.worktrees/` no existe. No hay nada que arreglar                                                                                  |
| Deprecation de Husky v9→v10                                         | 2026-07-27             | Eliminadas las dos líneas que fallarían en v10                                                                                                                                                           |
| `/alinear-completo` como comando del proyecto                       | 2026-07-27             | Es del pipeline ICFES de otro proyecto. No aplica. Su lugar lo ocupa `/validate`                                                                                                                         |
| Datos de ventas en este repositorio                                 | 2026-07-27             | El repo es **público** y el CSV tiene 53 clientes identificables. Viven en el repo privado `proyectos-varios`                                                                                            |
| Node 20 vía `setup_env.sh`                                          | 2026-07-27             | `.node_env` no existe y todo (lint, tsc, 865 tests, build) pasa con node v26.4.0. El requisito era de enero                                                                                              |
| A13 — repositorio sin formatear (137 archivos)                      | 2026-07-27 (`256f7d0`) | Formateado entero en un commit aislado. Se agregó `.prettierignore`, que no existía: sin él prettier reescribía 4 `.html`, tres de ellos derivados de un `.md`. `format:check` en verde por primera vez  |
| A12 — homonimia `Referral`, `ReferralStats`, `DeliveryZone`         | 2026-07-27 (`3988e52`) | Eran **tres** declaraciones por forma, no dos: había una copia anónima inline en cada `.map()`. Nombres propios en `types/referrals.ts` y `types/deliveries.ts`. Detalle en §«La mentira de nulabilidad» |

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
