---
description: Validación completa del codebase Café Mirador en 7 fases
---

# /validate — Café Mirador CRM

Ejecuta las fases **en orden** y **detente en la primera que falle**. No sigas a
la fase N+1 con la N en rojo: los errores de tipos producen fallos de test que
parecen otra cosa, y se pierde el tiempo depurando el síntoma.

Reporta la salida **real** de cada comando. No la resumas ni la maquilles.

> **Lo que estas fases NO ven.** El 2026-07-27 las cinco fases originales pasaron
> en verde mientras (a) la base de producción estaba **abierta a internet** y (b)
> una RPC que el dashboard llama **no existía**. Ninguna miraba la base real. Las
> fases 6 y 7 existen por eso, y siguen sin cubrirlo todo: ver §«El hueco que
> queda».

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

**Pasa si:** **876/876 en 39 archivos** (línea base 2026-07-27).

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
funciones. **Línea base:** líneas 93,23 · sentencias 91,46 · ramas 87,83 ·
funciones 88,76.

## Fase 5 — Build de producción

```bash
npm run build
```

**Pasa si:** genera **23 páginas estáticas** sin error. No requiere `.env.local`:
`lib/supabase.ts` tiene fallbacks para build-time.

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

---

## El hueco que queda

Ni siquiera con siete fases se cubre todo. Consciente y explícito:

| Qué no se verifica                        | Por qué                                                                                                                                                                                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Que RLS proteja de verdad**             | Nada consulta la base como anónimo. El 2026-07-27 las 5 fases pasaron con la base abierta                                                                                                                                                                  |
| **Que el login funcione**                 | Ninguna fase se autentica. `/login` es prerenderizada: devuelve 200 aunque el backend esté caído — así pasaron 85 días sin que nadie lo notara. Comprobación manual en [`docs/REFERENCIAS-OFICIALES.md`](../../docs/REFERENCIAS-OFICIALES.md) §supabase-js |
| **Los _parámetros_ de las RPC**           | La fase 6 comprueba que la función exista, no su firma. Cerrarlo es [BACKLOG](../../docs/BACKLOG.md) B4                                                                                                                                                    |
| **Lo que se ve en pantalla**              | Una regresión de contraste pasó las 5 fases: ninguna mira píxeles                                                                                                                                                                                          |
| **Llamadas `.rpc()` con nombre variable** | El extractor solo resuelve literales, y lo dice al correr                                                                                                                                                                                                  |

## Fuera de estas siete fases

| Suite              | Comando                 | Por qué no está arriba                                      |
| ------------------ | ----------------------- | ----------------------------------------------------------- |
| E2E (Playwright)   | `npx playwright test`   | Tarda minutos. **Sí corre en CI**: 23 tests × 3 navegadores |
| Base de datos      | `npm run test:db`       | Necesita `.env.local` con credenciales reales de Supabase   |
| Mutación (Stryker) | `npm run test:mutation` | Minutos, no segundos. Es para nightly, no para cada cambio  |
| Carga (k6)         | `npm run test:load`     | Golpea el despliegue real                                   |

## Reglas

- **Nunca ajustes un mock para que un test pase.** Si el mock y el código real
  discrepan, uno de los dos está mal: averigua cuál antes de tocar nada.
- **Nunca bajes un umbral de cobertura** para que la fase 4 pase.
- **Un resultado vacío no es un aprobado.** Antes de aceptar un `[]` o un «0
  hallazgos», comprueba que el verificador devuelve algo cuando _debe_. Se dio
  RLS por bueno con una consulta que llevaba `limit=0`.
- Si un verificador falla al 100 %, sospecha primero del verificador.
