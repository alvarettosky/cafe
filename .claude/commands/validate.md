---
description: Validación completa del codebase Café Mirador en 8 fases
---

# /validate — Café Mirador CRM

Ejecuta las fases **en orden** y **detente en la primera que falle**. No sigas a
la fase N+1 con la N en rojo: los errores de tipos producen fallos de test que
parecen otra cosa, y se pierde el tiempo depurando el síntoma.

Reporta la salida **real** de cada comando. No la resumas ni la maquilles.

> **Lo que estas fases NO ven.** El 2026-07-27 las cinco fases originales pasaron
> en verde mientras (a) la base de producción estaba **abierta a internet** y (b)
> una RPC que el dashboard llama **no existía**. Ninguna miraba la base real. Las
> fases 6 y 7 existen por eso.
>
> Y no bastaron: el **2026-08-07**, con las siete en verde, cuatro **vistas**
> seguían devolviendo datos de clientes a cualquier anónimo. De ahí la fase 8.
> Sigue sin cubrirse todo: ver §«El hueco que queda».

---

## Fase 1 — Lint

```bash
npm run lint
```

**Pasa si:** 0 errores.
**Línea base 2026-07-27:** 0 errores, 10 warnings (`no-unused-vars` en imports y
en variables `session` de tres archivos). Si aparecen warnings nuevos, no
bloquean, pero se anotan.

## Fase 2 — Tipos

```bash
npx tsc --noEmit
```

**Pasa si:** sin salida de error.

⚠️ `tsc` **no** cubre los contratos que cruzan procesos: respuestas HTTP, firmas
de RPC de Supabase y datos de MSW. Ver
[`docs/BLUEPRINT.md` §3](../../docs/BLUEPRINT.md). Que esta fase pase en verde no
significa que productor y consumidor estén de acuerdo. La fase 6 cubre una parte
de ese hueco.

## Fase 3 — Formato

```bash
npm run format:check
```

**Pasa si:** `All matched files use Prettier code style!`

**Línea base 2026-07-27: en verde, todo el repositorio.** Hasta el commit
`256f7d0` esta fase nacía en rojo con **137 archivos** sin formatear y había que
comprobar a mano cuáles eran tuyos. Ya no: si sale un solo archivo, es tuyo.

Existe `.prettierignore` desde ese commit. No lo quites: sin él, `npm run format`
reescribe los `.html` derivados y `next-env.d.ts`, que `next build` regenera con
su propio estilo.

## Fase 4 — Tests unitarios y de integración

```bash
npm test
```

**Pasa si:** **893/893 en 41 archivos** (línea base 2026-08-07).

- Si el número **baja**, hay una regresión.
- Si el número **sube**, se agregaron tests: actualiza la línea base aquí y en
  [`docs/ROADMAP.md`](../../docs/ROADMAP.md).
- Si un test falla **justo después de tocar un tipo compartido**, sospecha
  primero del _mock_, no del código. Precedente: `git show 5ce639e`.

Con cobertura:

```bash
npm run test:coverage
```

**Umbral exigido** (`vitest.config.mts`): 80 % en líneas, sentencias, ramas y
funciones. **Línea base 2026-08-07:** líneas 93,15 · sentencias 91,31 · ramas 87,81 ·
funciones 88,38.

## Fase 5 — Build de producción

```bash
npm run build
```

**Pasa si:** genera **21 rutas** sin error — 18 estáticas (`○`) y 3 dinámicas
(`ƒ`: las tres de `app/api/`). No requiere `.env.local`: `lib/supabase.ts` tiene
fallbacks para build-time.

⚠️ Este documento decía «23 páginas estáticas». Al contarlas el 2026-08-07 salen
**21 rutas, y solo 18 son estáticas**: la cifra estaba mal por partida doble.
Cuenta el bloque `Route (app)` del build, no de memoria.

## Fase 6 — Contrato de RPC contra la base real

```bash
npm run check:rpc
```

**Pasa si:** todas las RPC que el código invoca existen en la base.

Esta fase existe por un bug real. `app/page.tsx` llamaba a `get_dashboard_stats`,
que **no estaba desplegada**: devolvía HTTP 404 (`PGRST202`) y los cuatro KPIs del
dashboard mostraban `...`. Las cinco fases anteriores pasaban en verde, porque
una RPC es un **string** y ninguna de ellas habla con la base.

Un chequeo contra `supabase/migrations/` no habría bastado:
`004_dashboard_stats.sql` **sí** definía la función. Nunca se aplicó. Lo único que
distingue «definida» de «desplegada» es preguntárselo a la base.

⚠️ Necesita `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. **Sin ellas
sale con 0 pero avisando en voz alta** — ese aviso NO es un aprobado. En CI los
dos secretos existen. En local, o los exportas o das la fase por no ejecutada.

## Fase 7 — Credenciales en el código

```bash
npm run check:secrets
```

**Pasa si:** ningún archivo versionado contiene credenciales.

También sale de un incidente: `execute-sql-node.js` llevaba **189 días** con la
clave `service_role` de producción en un repositorio **público**, y
`exec-sql-direct.py` **188 días** con un token personal de Supabase, que da acceso
a la cuenta entera. Los encontró este verificador, no una persona.

El mismo script corre en pre-commit sobre lo que vas a subir; esta fase lo pasa
sobre **todo lo versionado**, que es lo que ya está publicado.

## Fase 8 — Ninguna tabla ni vista expone datos a un anónimo

```bash
npm run check:anon:autotest   # primero el verificador se prueba a sí mismo
npm run check:anon            # luego pregunta a la base
```

**Pasa si:** ningún objeto de `public` devuelve una sola fila a un cliente que
usa la clave publishable — la misma que viaja en el bundle de producción y que,
por tanto, tiene cualquiera — **y** el conjunto de objetos que ese cliente
alcanza sigue siendo el declarado en
[`scripts/anon-baseline.json`](../../scripts/anon-baseline.json).

⚠️ **Vacío no es lo mismo que protegido.** Una tabla recién creada siempre está
vacía: si `anon` puede leerla, devuelve `200 []` y pasaría por sana hasta el día
en que entren filas — ya públicas. Por eso el criterio no es solo «no devolvió
filas», sino que el conjunto de objetos **alcanzables** coincida con la línea
base. Un objeto alcanzable nuevo, aunque esté vacío, hace fallar la fase y exige
una decisión consciente: `npm run check:anon -- --actualizar-linea-base` la
reescribe, y ese diff se revisa como cualquier otro.

Esta fase existe por una fuga **real, medida el 2026-08-07 contra producción**:
cuatro vistas (`customer_segments`, `inventory_movement_summary`,
`inventory_from_variants`, `inventory_for_pricing`) se habían creado sin
`security_invoker`, así que se evaluaban con los permisos de su propietario y
**saltaban el RLS**. `customer_segments` devolvía nombre, teléfono, email y valor
de vida de los clientes. Lo cerró
[`030_cerrar_vistas_security_definer.sql`](../../supabase/migrations/030_cerrar_vistas_security_definer.sql).

Por qué ninguna fase anterior podía verlo, y esto es lo que hay que retener:
**una vista no es una tabla ni una función.** `pg_class.relrowsecurity` y
`pg_policies` describen tablas; la migración 027 cerró tablas y la 029 cerró
funciones. Las vistas eran un tipo de objeto entero sin vigilar. Por eso esta
fase no revisa una lista de sospechosos: **pregunta a la base qué hay y prueba
todo lo que haya**, para que un objeto nuevo quede cubierto sin que nadie se
acuerde de añadirlo.

⚠️ **El control positivo es parte del veredicto, no un adorno.** La primera sonda
de aquella investigación usó la clave de `.env.local`, que es una **legacy
desactivada el 2026-07-27**: todo devolvía 401 y se habría leído como «nada
expuesto». El script exige que al menos un objeto responda 200 antes de emitir
veredicto; si todo da 401, el resultado es **SONDA MUERTA** y sale con error.

⚠️ Necesita las tres variables (`NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` para descubrir y `NEXT_PUBLIC_SUPABASE_ANON_KEY` para
probar). En local toma la última de `~/.config/cafe-mirador/anon.key`.

**Sin ellas, fuera de CI avisa y sale con 0** para no romper un commit sin
conexión — ese aviso no es un aprobado. **En CI sale con 1**: el paso pasa
`--strict`, y `CI=true` lo activa igualmente. Sin eso, un PR desde un fork
—donde GitHub no inyecta secretos y este repositorio es público— mostraba una
marca verde junto a un paso que afirma que nada está expuesto, sin haber tocado
la base.

---

## El hueco que queda

Ni siquiera con ocho fases se cubre todo. Consciente y explícito:

| Qué no se verifica                        | Por qué                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Que el RLS separe roles AUTENTICADOS**  | La fase 8 sondea **solo como anónimo**. El agujero que cerró la migración `029` estaba en el otro lado: una política sobre `sales` que ignoraba `profiles.approved` dejaba que cualquier cuenta recién registrada leyera el historial entero. Si se reintroduce, anon sigue denegado, las 8 fases salen en verde y nada lo señala |
| **Escritura anónima**                     | La fase 8 solo comprueba `SELECT`. Que nadie pueda **leer** no prueba que nadie pueda **insertar** o **borrar**                                                                                                                                                                                                                   |
| **Buckets de Storage**                    | Ninguna fase mira Storage. Los backups viven ahí                                                                                                                                                                                                                                                                                  |
| **Objetos recién creados**                | La fase 8 descubre por el esquema de PostgREST, que se cachea: justo tras aplicar una migración puede ir un paso por detrás (medido el 2026-08-07 al probar el gate con una vista trampa)                                                                                                                                         |
| **Que el login funcione**                 | Ninguna fase se autentica. `/login` es prerenderizada: devuelve 200 aunque el backend esté caído — así pasaron 85 días sin que nadie lo notara. Comprobación manual en [`docs/REFERENCIAS-OFICIALES.md`](../../docs/REFERENCIAS-OFICIALES.md) §supabase-js                                                                        |
| **Los _parámetros_ de las RPC**           | La fase 6 comprueba que la función exista, no su firma. Cerrarlo es [BACKLOG](../../docs/BACKLOG.md) B4                                                                                                                                                                                                                           |
| **Lo que se ve en pantalla**              | Una regresión de contraste pasó las 5 fases: ninguna mira píxeles                                                                                                                                                                                                                                                                 |
| **Llamadas `.rpc()` con nombre variable** | El extractor solo resuelve literales, y lo dice al correr                                                                                                                                                                                                                                                                         |

## Fuera de estas ocho fases

| Suite                  | Comando                      | Por qué no está arriba                                                                                                         |
| ---------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| E2E (Playwright)       | `npx playwright test`        | Tarda minutos. **Sí corre en CI**: 23 tests × 3 navegadores                                                                    |
| Base de datos          | `npm run test:db`            | Necesita `.env.local` con credenciales reales de Supabase                                                                      |
| Mutación (Stryker)     | `npm run test:mutation`      | Minutos, no segundos. Es para nightly, no para cada cambio                                                                     |
| Carga (k6)             | `npm run test:load`          | Golpea el despliegue real                                                                                                      |
| Ensayo de restauración | `./scripts/restore-drill.sh` | Necesita Docker y tarda minutos. **Corre en CI a diario** tras el backup, y en cada push que toque migraciones o el exportador |

## Reglas

- **Nunca ajustes un mock para que un test pase.** Si el mock y el código real
  discrepan, uno de los dos está mal: averigua cuál antes de tocar nada.
- **Nunca bajes un umbral de cobertura** para que la fase 4 pase.
- **Un resultado vacío no es un aprobado.** Antes de aceptar un `[]` o un «0
  hallazgos», comprueba que el verificador devuelve algo cuando _debe_. Se dio
  RLS por bueno con una consulta que llevaba `limit=0`.
- Si un verificador falla al 100 %, sospecha primero del verificador.
