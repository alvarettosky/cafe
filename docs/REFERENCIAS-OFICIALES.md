# Referencias oficiales — OE8

Documentación oficial de las librerías del stack, consultada vía MCP `context7`
(`resolve-library-id` + `query-docs`) el **2026-07-27**, contrastada contra el
código real de este repo. No es un tour general de cada librería: cada entrada
existe porque responde a algo que este proyecto necesita o porque evita un
error concreto. El precedente de este formato es la
[Nota técnica de B4 en BACKLOG.md](BACKLOG.md#nota-técnica--cómo-se-cierra-b4)
(consulta a `/supabase/cli`).

Ver también [BLUEPRINT.md](BLUEPRINT.md) (decisiones de arquitectura, D6 dark
mode) y [../CLAUDE.md](../CLAUDE.md).

**Regla seguida:** si context7 no tenía indexada la versión exacta instalada,
o una consulta no devolvía nada, se dice explícitamente aquí. Nada de lo escrito
abajo viene de conocimiento propio sin contrastar contra la fuente citada.

---

## Next.js 16.1.2

- **context7 ID:** `/vercel/next.js` (rama `canary` del repo oficial de Vercel).
- **Versión instalada (resuelta, sin caret en `package.json`):** `16.1.2`.
- **Cobertura de context7:** no hay snapshot indexado para el patch exacto
  `16.1.2`; las versiones disponibles más cercanas son `v16.1.0`, `v16.1.1`,
  `v16.1.5`, `v16.1.6`, `v16.2.2`, `v16.2.9`. Se consultó la rama `canary`
  general, que incluye la guía de upgrade `version-16.mdx` — el contenido
  citado abajo es de la migración de la **major 16**, no de un patch
  específico, así que aplica igual.

### Async Request APIs — ya no hay acceso síncrono

> "Starting with Next.js 16, synchronous access to Request-time APIs is fully
> removed. APIs like `cookies()`, `headers()`, and `params` must now be
> accessed asynchronously in App Router projects."
> — `docs/01-app/02-guides/upgrading/version-16.mdx`

```ts
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  const query = await props.searchParams
  return <h1>Blog Post: {slug}</h1>
}
```

**Verificado contra este repo:** no hay ninguna carpeta de segmento dinámico
(`app/**/[algo]`) ni uso de `cookies()`/`headers()` fuera de tests — se
comprobó con `grep` sobre `app/` y `lib/`. La única mención de `params` en
`app/` (`app/api/export/route.ts:213`) es un comentario sobre query string, no
un route param. **Conclusión: este breaking change no afecta al código actual,
pero si se agrega una ruta dinámica (`app/[algo]/page.tsx` o
`app/api/[id]/route.ts`) o se vuelve a leer `cookies()`/`headers()`, hay que
tratarlas como `Promise` desde el día uno.**

### `next/legacy/image` deprecado

> "The `next/legacy/image` component is deprecated in Next.js 16. Projects
> should migrate to the standard `next/image` component."

No aplica: el repo no usa `next/legacy/image` (no hay coincidencias).

### `NEXT_PUBLIC_*` — se congelan en build, no en runtime

> "Once an application is built, `NEXT_PUBLIC_` environment variables are
> frozen with the values present at build time. They will not update if the
> environment variables change after deployment. For dynamic runtime values, a
> custom API must be set up to provide them to the client."
> — `docs/01-app/02-guides/environment-variables.mdx`

Y de forma más explícita: Next.js reemplaza **todas** las referencias a
`process.env.NEXT_PUBLIC_X` por el valor literal durante `next build` — no es
una variable leída en runtime, es una sustitución de texto en el bundle.

**Por qué importa aquí:** el repo consume `NEXT_PUBLIC_SUPABASE_URL` y
`NEXT_PUBLIC_SUPABASE_ANON_KEY` en `lib/supabase.ts`,
`app/api/backups/list/route.ts`, `app/api/backups/trigger/route.ts` y
`app/api/export/route.ts`. Esto confirma, con la fuente oficial, la regla que
ya dejó BACKLOG.md al migrar de claves legacy a `sb_publishable_`/`sb_secret_`
(2026-07-27): **cambiar el valor de una `NEXT_PUBLIC_*` en Vercel no tiene
efecto hasta el próximo `next build` + redespliegue.** Un cambio de clave que
solo se guarda en el dashboard de variables de entorno, sin redesplegar, deja
el bundle servido apuntando a la clave vieja indefinidamente. (Coincide con lo
que BACKLOG.md ya registró como paso 3 de la migración: "Variable en Vercel +
redespliegue. Verificado en el bundle servido".)

Nota de nomenclatura: los **nombres** de las variables (`NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`) no cambiaron con la migración de claves — solo
cambió el **valor** que contienen (de JWT legacy a `sb_publishable_`/`sb_secret_`).
Esto es una decisión del proyecto, no algo impuesto por Next.js ni por Supabase.

### `next/font/google` — Fraunces

API confirmada contra `app/layout.tsx:2-11`:

```ts
import { Inter, Fraunces } from 'next/font/google';
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-serif-display',
});
```

La documentación oficial confirma exactamente esta forma de uso: `subsets`,
`weight` como array de strings (`weight: ['100','400','900']` es el ejemplo
oficial) para fuentes no variables, y `variable` para exponer un custom
property CSS que luego se aplica en `className` del `<html>`/`<body>`. No hay
discrepancia entre el uso del repo y la API documentada.

---

## React 19.2.3

- **context7 ID:** `/react/react` (versión indexada más cercana: `v19.2.7`).
- **Versión instalada:** `19.2.3`.

El brief no señaló una pregunta específica de API de React 19 más allá de la
compatibilidad con el stack, así que no se fuerza contenido genérico aquí. Lo
único verificable y relevante: Next.js 16 **requiere** React 19 como peer
dependency para el App Router (confirmado por la coexistencia de
`next@16.1.2` + `react@19.2.3` en `package.json` sin warnings de peer deps al
instalar). No se investigó ninguna otra API de React 19 porque no hay un
punto de fallo concreto de este proyecto que dependa de ella.

---

## Tailwind CSS 4.1.18

- **context7 ID:** `/tailwindlabs/tailwindcss.com` (sitio oficial de docs).
- **Versión instalada (resuelta de `^4`):** `4.1.18`.

### Configuración CSS-first (`@theme`)

> v4 reemplaza `tailwind.config.js` por configuración CSS-first usando el
> bloque `@theme`.

```css
@import 'tailwindcss';

@theme {
  --color-mint-500: oklch(0.72 0.11 178);
}
```

Cada variable `--color-*`, `--font-*`, `--radius-*`, etc. dentro de `@theme`
genera automáticamente utilidades y custom properties. El repo ya sigue este
patrón: `app/globals.css` empieza con `@import 'tailwindcss';` y declara
tokens (`--background`, `--primary`, `--seg-champion-fg`, etc.) en `:root`
— **no** dentro de un bloque `@theme`, sino como custom properties de tema
consumidas por utilidades arbitrarias/mapeadas. Esto es válido (Tailwind v4
no exige que todo custom property viva en `@theme`), pero vale la distinción:
`@theme` es lo que registra el token como **utilidad de Tailwind** generada
(p. ej. `bg-mint-500`); un custom property fuera de `@theme` es solo CSS
normal que hay que referenciar con `bg-[var(--nombre)]` o mapearlo a mano.

### La variante `dark:` — la regla exacta que causó la regresión real de este proyecto

Este es el hallazgo con más peso de todo el documento porque **ya pasó** en
este repo (ver el comentario extenso en `app/globals.css:1-22`).

Fuente oficial (`src/docs/dark-mode.mdx`):

> Por defecto, la variante `dark:` de Tailwind CSS v4 se resuelve mediante
> `@media (prefers-color-scheme: dark)` — sigue la preferencia del sistema
> operativo, **no** una clase.

Para que `dark:` responda a una clase (`<html class="dark">`) en vez de al
SO, hay que declararlo explícitamente en CSS:

```css
@import 'tailwindcss';

@custom-variant dark (&:where(.dark, .dark *));
```

Sin esa línea, `<html className="dark">` (que sí está presente en
`app/layout.tsx:20`) **no tiene ningún efecto sobre qué CSS se aplica** —
Tailwind sigue mirando el SO. La implementación interna que context7 devolvió
confirma por qué:

```css
@variant dark {
  &:where(.dark, .dark *) {
    @slot;
  }
  @media (prefers-color-scheme: dark) {
    &:where(.system, .system *) {
      @slot;
    }
  }
}
```

— es decir, el comportamiento "clase manda" no es el default: hay que optar
por él con `@custom-variant`.

**Esto es exactamente la regresión que describe el comentario en
`app/globals.css`:** se declararon los valores oscuros directamente y sin
condición en `:root` (buscando que `class="dark"` fuera canónico, según
[BLUEPRINT.md §D6](BLUEPRINT.md#d6--dark-mode-canónico)), pero como no existía
`@custom-variant dark`, las utilidades `dark:*` seguían resolviendo por media
query. Resultado: en un SO en modo claro, las superficies quedaban oscuras
(por los `:root` incondicionales) mientras las utilidades `dark:`-condicionadas
(y las utilidades claras sin contraparte `dark:`, ej. `text-gray-700` en
`customer-modal.tsx`) seguían asumiendo tema claro → contraste ~2:1.

**Estado actual verificado (2026-07-27):** `app/globals.css` **no** declara
`@custom-variant dark` — se confirmó con `grep`. El proyecto sigue en modo
media-query (el mecanismo por defecto), que es el que "gana" ahora según el
propio comentario del archivo. Migrar a dark canónico exige, en este orden:
(1) declarar `@custom-variant dark (&:where(.dark, .dark *));`, (2) auditar
todas las utilidades de paleta clara sin variante `dark:` explícita antes de
hacer el cambio — si no, se repite el mismo bug.

---

## Vitest 4.0.17

- **context7 ID:** `/vitest-dev/vitest` (versión indexada disponible más
  cercana: `v4.0.7`; la instalada es `4.0.17` — no hay snapshot exacto, se
  usó la doc general de la rama `main`, que para estas opciones de CLI/config
  no cambia entre esos patches).

### `environment`, `setupFiles`, `coverage.thresholds`

Confirmado contra `vitest.config.mts` del repo — coincide con la API oficial:

```ts
export default defineConfig({
  test: {
    environment: 'jsdom', // oficial: 'happy-dom' | 'jsdom' | 'node'
    setupFiles: './vitest.setup.mts',
    coverage: {
      provider: 'v8', // v8 es el provider por defecto documentado
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
```

Dato adicional no usado hoy en el repo pero documentado: `thresholds` admite
`perFile` (umbrales distintos por archivo) y `autoUpdate` (sube el umbral
automáticamente cuando la cobertura mejora, sin bajarlo nunca). Podría ser
útil si se quiere subir cobertura de forma incremental sin tener que editar
el número a mano cada vez.

### `vitest related --run` en el hook de pre-commit

> "The `vitest related` command runs only tests that cover a specified list
> of source files, working with static imports **but not dynamic ones**. It
> is particularly useful when integrated with tools like `lint-staged`, where
> the `--run` option should be included to ensure the command exits
> properly."
> — `docs/guide/cli.md`

Confirmado contra `.lintstagedrc.js` del repo: usa exactamente
`'vitest related --run --passWithNoTests'` para `*.{ts,tsx}`. Es el uso
oficialmente recomendado. **Caveat documentado que vale la pena que el equipo
tenga presente:** `vitest related` solo seguridad imports **estáticos** —
si un archivo importa dinámicamente (`await import(...)`) al módulo que
cambió, `vitest related` no lo detecta como relacionado y el test
correspondiente no correrá en el hook, aunque sí debería. No se encontraron
`import()` dinámicos en el código de producción del repo al momento de esta
revisión, pero es el tipo de gap que no se nota hasta que ya pasó.

---

## @supabase/supabase-js 2.90.1

- **context7 IDs consultados:** `/supabase/supabase-js` (repo del cliente,
  única versión indexada: `v2.58.0`) y `/supabase/supabase` (docs generales,
  incluye la guía de migración de claves).
- **Versión instalada (resuelta y confirmada en `node_modules` y
  `package-lock.json`):** exactamente `2.90.1`.

### Hallazgo accionable: la versión instalada es anterior a cuando el cliente reconoce oficialmente `sb_publishable_`/`sb_secret_`

Este es el dato que este proyecto necesita de verdad, porque BACKLOG.md
registra que el 2026-07-27 se migró producción de las claves legacy
(`anon`/`service_role`, JWT) a las nuevas `sb_publishable_`/`sb_secret_`, y
desactivó las legacy.

Del CHANGELOG del cliente (`packages/core/supabase-js/CHANGELOG.md`), vía
context7:

> "The `isNewApiKey` function and `sb_publishable_` handling were introduced
> in **v2.110.4**... Before this version, `sb_publishable_` keys were treated
> as JWTs and sent as Bearer tokens in all requests — which would fail for
> Edge Functions."

Y del código fuente citado (`packages/core/supabase-js/src/lib/fetch.ts`):

```ts
const isNewApiKey = (key: string): boolean =>
  key.startsWith('sb_publishable_') || key.startsWith('sb_secret_');
```

**`2.90.1` < `2.110.4`** (comparar el segmento _minor_: 90 < 110 — no es un
error tipográfico, semver de dos y tres dígitos engaña a simple vista).
Es decir: **la versión instalada en este repo es anterior a la que introduce
reconocimiento explícito del nuevo formato de clave.** En `2.90.1` no existe
la función `checkApiKeyFormat`/`isNewApiKey` — el cliente simplemente manda la
clave tal cual en las cabeceras `apikey`/`Authorization: Bearer <key>`, sin
ninguna lógica especial por prefijo.

**Consecuencia práctica, acotada a lo que se pudo verificar en este repo:**

- **Tablas (PostgREST) y Storage:** no hay lógica de formato de por medio en
  el lado del cliente para estas rutas — la clave se manda como header y el
  backend de Supabase es quien la valida. Esto **coincide con lo que
  BACKLOG.md ya registró empíricamente** ("Migrar consumidores legítimos a la
  clave `sb_secret_`... Probado con `supabase-js`: tabla y storage OK") — la
  fuente oficial explica _por qué_ ese resultado era esperable con esta
  versión del cliente, no lo contradice.
- **Edge Functions (`supabase.functions.invoke(...)`):** aquí sí habría
  riesgo real con `2.90.1`, porque antes de `2.110.4` el cliente manda la API
  key como Bearer JWT en **todas** las solicitudes, incluidas las de Edge
  Functions — que esperan un JWT de usuario ahí, no la API key. **Se verificó
  con `grep` que este repo no usa `functions.invoke` ni tiene una carpeta
  `supabase/functions`** — el riesgo no aplica hoy. Si el proyecto llega a
  invocar Edge Functions, subir `@supabase/supabase-js` a `>=2.110.4` antes de
  hacerlo deja de ser opcional.

**No verificado:** el comportamiento exacto de Realtime con claves nuevas en
`2.90.1` — context7 no devolvió nada específico sobre Realtime + formato de
clave nueva, y el repo no usa canales Realtime hoy (no se buscó exhaustivamente
fuera del alcance de esta tarea). Se deja como "no verificado" en vez de
extrapolar.

**Recomendación (no bloqueante):** considerar subir `@supabase/supabase-js`
a `^2.110.4` o superior en el próximo bump de dependencias — no por un bug
activo, sino porque a partir de esa versión el cliente reconoce el formato
nuevo explícitamente (con warning en vez de fallo silencioso si algún día
aparece un prefijo de clave que tampoco reconozca) en lugar de tratarlo como
un JWT genérico por accidente de que "funciona igual".

### Claves nuevas — qué reemplazan

De `apps/docs/content/guides/getting-started/migrating-to-new-api-keys.mdx`:

```ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://your-project.supabase.co',
  'sb_publishable_...' // reemplaza a la clave anon
);
```

`publishable` reemplaza a `anon` (mismo nivel de privilegio bajo, para
clientes públicos); `secret` reemplaza a `service_role`. La diferencia de
fondo frente a las legacy, según el blog oficial de Supabase citado por
context7: las legacy son JWT que expiran a los 10 años del proyecto y no se
pueden rotar/revocar individualmente sin tumbar todo lo que las usa; las
nuevas son revocables una por una y auditable. Esto es exactamente lo que
BACKLOG.md documenta como motivo de la migración de este proyecto.

**Cronograma oficial (no proyecto-específico, pero relevante para planear):**
Supabase empezó a exigir progresivamente el cambio desde el 1 de noviembre de
2025 (proyectos restaurados después de esa fecha ya no tienen claves legacy),
con retiro total de `anon`/`service_role` legacy previsto para "finales de
2026 (por confirmar)". Este proyecto ya migró y desactivó las legacy, así que
va por delante de ese cronograma.

---

## Resumen de lo NO verificado

- API de React 19 más allá de la compatibilidad de versión con Next 16 (el
  brief no señaló una necesidad concreta).
- Comportamiento de Supabase Realtime con las claves nuevas en
  `supabase-js@2.90.1` (context7 no devolvió nada específico; el repo no usa
  Realtime hoy).
- Snapshot de context7 para los patches exactos `next@16.1.2` y
  `vitest@4.0.17` (se usó la documentación general de la rama/major, que para
  el contenido citado no varía entre esos patches, pero se deja constancia de
  que no es un match exacto de versión).
