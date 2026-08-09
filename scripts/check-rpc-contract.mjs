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
// `\s` incluye el salto de linea, y se recorre el archivo ENTERO en vez de
// linea a linea.
//
// La version anterior hacia `.split('\n').forEach(...)`, asi que una llamada
// partida en dos —que es justo como prettier formatea las largas—
//
//     const { data } = await supabase.rpc(
//       'get_customer_portal_dashboard',
//       { p_customer_id: id }
//     );
//
// no la veia. Y lo peor: tampoco la contaba como dinamica, de modo que
// desaparecia del informe sin dejar rastro y el script anunciaba «todas las RPC
// existen» habiendo mirado menos de las que hay. Es el mismo modo de fallo que
// ya se corrigio para los nombres con mayusculas: **descartar en silencio lo
// que no encaja con la idea que el extractor tiene de una llamada valida**.
const RPC_RE = /\.rpc\(\s*['"`]([A-Za-z0-9_]+)['"`]/g;

// Llamadas con nombre dinamico — `.rpc(nombre)` con una variable — que este
// script NO puede resolver. Callarlas seria fingir una cobertura que no se
// tiene, asi que se cuentan y se declaran aparte.
const DINAMICA_RE = /\.rpc\(\s*(?!['"`])[^\s)]/g;

/** Numero de linea (1-indexado) de un desplazamiento dentro del texto. */
const lineaDe = (texto, offset) => texto.slice(0, offset).split('\n').length;

const llamadas = new Map(); // nombre -> [archivo:linea]
const dinamicas = [];

for (const archivo of DIRS.flatMap(d => walk(d))) {
  const texto = readFileSync(archivo, 'utf8');

  for (const m of texto.matchAll(RPC_RE)) {
    if (!llamadas.has(m[1])) llamadas.set(m[1], []);
    llamadas.get(m[1]).push(`${archivo}:${lineaDe(texto, m.index)}`);
  }
  for (const m of texto.matchAll(DINAMICA_RE)) {
    dinamicas.push(`${archivo}:${lineaDe(texto, m.index)}`);
  }
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

// ---------------------------------------------------------------------------
// Segundo contrato: las COLUMNAS que la exportacion promete
// ---------------------------------------------------------------------------
//
// `lib/export.ts` declara, por tabla, las columnas que van al CSV/XLSX, y
// `app/api/export/route.ts` pide `.select('*')` y luego se queda solo con esas
// (`if (col in row)`). Una columna mal escrita **no da error**: desaparece del
// archivo sin decir nada.
//
// El 2026-08-09 esa lista nombraba `customers.name` (la real es `full_name`),
// `sales.total`/`profit` (son `total_amount`/`total_profit`) y cuatro columnas
// de `inventory` que no existen. O sea: **la exportacion de clientes salia sin
// el nombre del cliente**, y la de ventas sin los importes, desde siempre. El
// mismo patron que las RPC inexistentes, una capa mas abajo: lo que falta no
// avisa, solo falta.
{
  const fuente = readFileSync('lib/export.ts', 'utf8');
  const bloque = fuente.slice(
    fuente.indexOf('const columnMap'),
    fuente.indexOf('return columnMap')
  );

  // { tabla: [columnas] } tal como lo declara el mapa.
  const declaradas = new Map();
  for (const m of bloque.matchAll(/(\w+):\s*\[([^\]]*)\]/g)) {
    declaradas.set(
      m[1],
      [...m[2].matchAll(/'([^']+)'/g)].map(c => c[1])
    );
  }

  if (declaradas.size === 0) {
    console.error('\n✖ No se pudo leer el mapa de columnas de lib/export.ts. Sin corpus no hay');
    console.error('   veredicto: revisa el verificador antes que el codigo.');
    process.exit(1);
  }

  const inexistentes = [];
  for (const [tabla, columnas] of declaradas) {
    const propiedades = spec.definitions?.[tabla]?.properties;
    if (!propiedades) {
      inexistentes.push(`${tabla} — la TABLA no existe en la base`);
      continue;
    }
    for (const col of columnas) {
      if (!(col in propiedades)) inexistentes.push(`${tabla}.${col}`);
    }
  }

  const total = [...declaradas.values()].reduce((n, c) => n + c.length, 0);
  console.log(
    `Contrato de columnas — ${total} declaradas en lib/export.ts para ${declaradas.size} tablas`
  );

  if (inexistentes.length > 0) {
    console.error(
      `\n✖ ${inexistentes.length} COLUMNA(S) QUE LA EXPORTACION PROMETE Y NO EXISTEN:\n`
    );
    for (const c of inexistentes) console.error(`  ${c}`);
    console.error(`
  No rompen la exportacion: se caen del archivo en silencio. Un CSV de clientes
  sin la columna del nombre parece un CSV valido.
`);
    process.exit(1);
  }

  console.log('✓ Todas las columnas de la exportacion existen en la base.');
}
