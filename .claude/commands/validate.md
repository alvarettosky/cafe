---
description: Validación completa del codebase Café Mirador en 5 fases
---

# /validate — Café Mirador CRM

Ejecuta las cinco fases **en orden** y **detente en la primera que falle**. No
sigas a la fase N+1 con la N en rojo: los errores de tipos producen fallos de
test que parecen otra cosa, y se pierde el tiempo depurando el síntoma.

Reporta la salida **real** de cada comando. No la resumas ni la maquilles.

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
significa que productor y consumidor estén de acuerdo.

## Fase 3 — Formato

```bash
npm run format:check
```

**Esta fase está en rojo desde antes de existir**, y conviene saberlo en vez de
descubrirlo: el repositorio nunca se formateó por completo. Línea base
2026-07-27: **137 archivos** con diferencias de estilo.

**Pasa si:** ningún archivo **que tú hayas tocado** aparece en la lista. Para
comprobarlo:

```bash
npm run format:check 2>&1 | grep '^\[warn\]' | sed 's/\[warn\] //' | sort > /tmp/fmt.txt
for f in $(git diff --name-only main...HEAD); do grep -qx "$f" /tmp/fmt.txt && echo "FALLA: $f"; done
```

Si sale alguno: `npx prettier --write <esos archivos>`. **No corras
`npm run format` sobre todo el repo** dentro de un cambio funcional: 137
archivos reformateados sepultan el diff que de verdad importa. Formatear el
repo entero es un trabajo aparte, con su propio commit — ver
[`docs/BACKLOG.md`](../../docs/BACKLOG.md) A13.

## Fase 4 — Tests unitarios y de integración

```bash
npm test
```

**Pasa si:** **865/865 en 38 archivos** (línea base 2026-07-27).

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
funciones. **Línea base:** líneas 93,79 · sentencias 92,1 · ramas 88,22 ·
funciones 89,01.

## Fase 5 — Build de producción

```bash
npm run build
```

**Pasa si:** genera **21 rutas** sin error. No requiere `.env.local`:
`lib/supabase.ts` tiene fallbacks para build-time.

---

## Fuera de estas cinco fases

| Suite              | Comando                 | Por qué no está arriba                                     |
| ------------------ | ----------------------- | ---------------------------------------------------------- |
| E2E (Playwright)   | `npx playwright test`   | Necesita navegadores instalados y servidor levantado       |
| Base de datos      | `npm run test:db`       | Necesita `.env.local` con credenciales reales de Supabase  |
| Mutación (Stryker) | `npm run test:mutation` | Minutos, no segundos. Es para nightly, no para cada cambio |
| Carga (k6)         | `npm run test:load`     | Golpea el despliegue real                                  |

## Reglas

- **Nunca ajustes un mock para que un test pase.** Si el mock y el código real
  discrepan, uno de los dos está mal: averigua cuál antes de tocar nada.
- **Nunca bajes un umbral de cobertura** para que la fase 4 pase.
- Si un verificador falla al 100 %, sospecha primero del verificador.
