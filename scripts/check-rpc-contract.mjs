#!/usr/bin/env node
/**
 * Comprueba que TODAS las RPC que el codigo invoca existen de verdad en la base.
 *
 * ---------------------------------------------------------------------------
 * POR QUE EXISTE
 * ---------------------------------------------------------------------------
 *
 * El 2026-07-27 se descubrio que `app/page.tsx` llamaba a `get_dashboard_stats`,
 * que **no existia en produccion**. Devolvia HTTP 404 (`PGRST202`) y los cuatro
 * KPIs del dashboard mostraban el marcador `...`. Nadie se entero.
 *
 * Ninguna de las cinco fases de `/validate` podia verlo:
 *
 *   - `npm run lint`   mira estilo
 *   - `npx tsc`        mira tipos de TypeScript, y una RPC es un string
 *   - `npm test`       pasa porque el mock de Supabase responde lo que se le pida
 *   - `npm run build`  compila igual: el nombre de la RPC no se resuelve en build
 *   - `format:check`   mira comillas
 *
 * Es el hueco que `docs/BLUEPRINT.md` §3 describe: **el contrato critico de este
 * sistema no es ningun modulo de TypeScript, son las firmas de las RPC**, y
 * cambiar una migracion rompe el frontend sin que nada avise.
 *
 * Un migration-check no bastaba: `supabase/migrations/004_dashboard_stats.sql`
 * SI definia la funcion. Nunca se aplico. Lo unico que distingue «definida» de
 * «desplegada» es preguntarle a la base.
 *
 * ---------------------------------------------------------------------------
 * COMO
 * ---------------------------------------------------------------------------
 *
 * PostgREST publica su propio esquema OpenAPI en la raiz de `/rest/v1/`, con una
 * ruta `/rpc/<nombre>` por cada funcion expuesta. Se compara con los nombres que
 * aparecen en `.rpc('...')` dentro del codigo fuente.
 *
 * Requiere `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` — los dos ya
 * existen como secretos de GitHub Actions. **Sin credenciales SALE CON 0 pero
 * avisando en voz alta**: un verificador que se salta en silencio es peor que no
 * tenerlo, porque se lee como aprobado.
 *
 * Uso:  node scripts/check-rpc-contract.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIRS = ['app', 'components', 'lib', 'context', 'scripts'];
const EXT = new Set(['.ts', '.tsx', '.mjs']);

// Este mismo archivo queda fuera del escaneo.
//
// Se descubrio probandolo: sus comentarios citan nombres de RPC como ejemplo
// —incluido uno inexistente a proposito— y el escaner los tomaba por llamadas
// reales, marcandose a si mismo. Un verificador que se autodenuncia por su
// propia documentacion obliga a censurar los comentarios para que pase, que es
// justo al reves de lo que interesa.
const YO = 'check-rpc-contract.mjs';

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      // Los tests mockean Supabase: sus nombres de RPC no son contrato real.
      if (e === '__tests__' || e === 'node_modules') continue;
      walk(p, out);
    } else if (EXT.has(extname(p)) && e !== YO) {
      out.push(p);
    }
  }
  return out;
}

// El nombre acepta CUALQUIER caso, no solo snake_case.
//
// La primera version usaba `[a-z0-9_]+` y fallo su propia prueba: al inyectarle
// `.rpc('get_dashboard_stats_QUE_NO_EXISTE')` la ignoro y salio en verde. Un
// extractor que descarta lo que no encaja con su idea de nombre valido no avisa
// de nada — se limita a mirar hacia otro lado. Y `.rpc()` acepta el string que
// sea: si alguien escribe camelCase, la RPC no existira y el fallo es
// exactamente el que este script deberia cazar.
const RPC_RE = /\.rpc\(\s*['"`]([A-Za-z0-9_]+)['"`]/g;

// Contador independiente para detectar llamadas dinamicas — `.rpc(nombre)` con
// una variable — que este script NO puede resolver. Callarlas seria fingir una
// cobertura que no se tiene.
const DINAMICA_RE = /\.rpc\(\s*[^'"`\s)]/g;

const llamadas = new Map(); // nombre -> [archivo:linea]
const dinamicas = [];

for (const archivo of DIRS.flatMap(d => walk(d))) {
  readFileSync(archivo, 'utf8')
    .split('\n')
    .forEach((linea, i) => {
      for (const m of linea.matchAll(RPC_RE)) {
        if (!llamadas.has(m[1])) llamadas.set(m[1], []);
        llamadas.get(m[1]).push(`${archivo}:${i + 1}`);
      }
      if (DINAMICA_RE.test(linea)) dinamicas.push(`${archivo}:${i + 1}`);
      DINAMICA_RE.lastIndex = 0;
    });
}

if (llamadas.size === 0) {
  console.error('✖ 0 llamadas .rpc() encontradas. El extractor esta roto: el repo tiene decenas.');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.warn(
    `\n⚠️  OMITIDO — falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.\n` +
      `   Se encontraron ${llamadas.size} RPC en el codigo pero NO se comprobaron contra la base.\n` +
      `   Esto NO es un aprobado. En CI los dos secretos existen y la comprobacion corre.\n`
  );
  process.exit(0);
}

const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
if (!res.ok) {
  console.error(
    `✖ PostgREST devolvio HTTP ${res.status} al pedir su esquema. No se pudo verificar.`
  );
  process.exit(1);
}

const spec = await res.json();
const expuestas = new Set(
  Object.keys(spec.paths ?? {})
    .filter(p => p.startsWith('/rpc/'))
    .map(p => p.slice(5))
);

if (expuestas.size === 0) {
  console.error(
    '✖ El esquema de PostgREST no declaro ninguna RPC. Sospecha del verificador, no del codigo.'
  );
  process.exit(1);
}

const faltantes = [...llamadas.keys()].filter(n => !expuestas.has(n)).sort();

console.log(
  `Contrato de RPC — ${llamadas.size} invocadas en el codigo · ${expuestas.size} expuestas por la base`
);

// P5: declarar cobertura. Lo que el script no pudo mirar se dice, no se omite.
if (dinamicas.length > 0) {
  console.warn(
    `\n⚠️  ${dinamicas.length} llamada(s) .rpc() con nombre dinamico — NO verificadas:\n` +
      dinamicas.map(d => `      ${d}`).join('\n') +
      `\n   Este script solo resuelve literales. Esas quedan fuera de la garantia.\n`
  );
}

if (faltantes.length > 0) {
  console.error(`\n✖ ${faltantes.length} RPC INVOCADAS QUE NO EXISTEN:\n`);
  for (const n of faltantes) {
    console.error(`  ${n}`);
    for (const sitio of llamadas.get(n)) console.error(`      ${sitio}`);
  }
  console.error(`
  Cada una devuelve HTTP 404 (PGRST202) en tiempo de ejecucion. Si el llamador
  descarta el 'error' de la desestructuracion, el fallo es SILENCIOSO.

  Arreglo: crear la migracion que falta y APLICARLA. Que exista el .sql en
  supabase/migrations/ no basta — 004_dashboard_stats.sql existia y aun asi la
  funcion no estaba desplegada.
`);
  process.exit(1);
}

console.log('✓ Todas las RPC invocadas existen en la base.');
