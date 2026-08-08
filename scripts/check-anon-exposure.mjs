#!/usr/bin/env node
/**
 * Comprueba que NINGUNA tabla ni vista de `public` devuelve datos a un cliente
 * anonimo, usando la misma clave publica que viaja en el bundle de produccion.
 *
 * ---------------------------------------------------------------------------
 * POR QUE EXISTE
 * ---------------------------------------------------------------------------
 *
 * El 2026-08-07 se descubrio que cuatro VISTAS (`customer_segments`,
 * `inventory_movement_summary`, `inventory_from_variants`,
 * `inventory_for_pricing`) devolvian filas a cualquiera con la clave
 * publishable: se habian creado sin `security_invoker`, asi que se evaluaban
 * con los permisos de su propietario y saltaban el RLS de las tablas base.
 * `customer_segments` exponia nombre, telefono, email y valor de vida de los
 * clientes. Lo cerro `030_cerrar_vistas_security_definer.sql`.
 *
 * Ninguna puerta existente podia verlo, y por un motivo estructural:
 *
 *   - `pg_class.relrowsecurity` y `pg_policies` describen TABLAS. Una vista no
 *     tiene RLS propio, asi que no aparece en ninguno de los dos.
 *   - 027 y 029 revisaron tablas y funciones. Las vistas no son ni una cosa
 *     ni la otra: eran un tipo de objeto entero sin vigilar.
 *   - `check-rpc-contract.mjs` mira funciones, no lectura de datos.
 *   - lint, tsc, vitest y build no hablan con la base.
 *
 * La leccion que este script convierte en codigo: **revisar el mecanismo que
 * conoces no dice nada del que no estas mirando.** Por eso aqui no se
 * enumeran objetos "sospechosos": se pregunta a la base QUE HAY y se prueba
 * TODO lo que haya, para que un objeto nuevo quede cubierto sin que nadie se
 * acuerde de anadirlo.
 *
 * ---------------------------------------------------------------------------
 * COMO
 * ---------------------------------------------------------------------------
 *
 *   1. DESCUBRE con `SUPABASE_SERVICE_ROLE_KEY`: PostgREST publica su esquema
 *      OpenAPI en la raiz de `/rest/v1/`, y con la clave de servicio lista los
 *      25 objetos de `public` (21 tablas + 4 vistas). Con la clave anonima ese
 *      mismo endpoint devuelve 0 objetos — por eso el descubrimiento no puede
 *      hacerse con ella.
 *   2. PRUEBA cada objeto con la clave PUBLICA (`NEXT_PUBLIC_SUPABASE_ANON_KEY`,
 *      o `~/.config/cafe-mirador/anon.key` en local). Es literalmente lo que
 *      tiene a mano cualquiera que abra el bundle de la web.
 *   3. FALLA si algun objeto devuelve una sola fila.
 *
 * ---------------------------------------------------------------------------
 * EL CONTROL POSITIVO NO ES OPCIONAL
 * ---------------------------------------------------------------------------
 *
 * Al investigar la fuga, la primera sonda uso la clave de `.env.local`, que es
 * una **legacy desactivada el 2026-07-27**. Todas las peticiones devolvieron
 * 401 y el resultado se habria leido como "nada expuesto". Era ceguera, no
 * seguridad.
 *
 * Por eso este script EXIGE que al menos un objeto responda 200 antes de
 * emitir veredicto. Si todo da 401, la conclusion no es "cerrado": es
 * **SONDA MUERTA**, y sale con error. Un cero solo vale cuando se ha
 * demostrado que la sonda podia ver algo.
 *
 * Uso:
 *   node scripts/check-anon-exposure.mjs
 *   node scripts/check-anon-exposure.mjs --autotest   # se prueba a si mismo
 */

const ALLOWLIST = new Set([
  // Objetos que PUEDEN devolver datos a un anonimo, con su motivo.
  // Hoy esta vacia a proposito: el portal de cliente llega como `anon` pero
  // solo invoca RPC (`grep "\\.from('" app/portal` no devuelve nada), asi que
  // ninguna tabla ni vista necesita lectura anonima.
]);

// Lo que este verificador NO mira, dicho en voz alta para que nadie lo lea
// como cobertura que no tiene:
//   - Funciones ejecutables por `anon` (las cubre 029 con su lista blanca de 13
//     y `mcp__supabase__get_advisors`).
//   - Storage buckets.
//   - Escritura anonima (INSERT/UPDATE/DELETE): aqui solo se prueba lectura.
const NO_MIRA = [
  'funciones RPC ejecutables por anon (ver 029 y get_advisors)',
  'buckets de Storage',
  'escritura anonima: solo se comprueba SELECT',
  'objetos que PostgREST aun no ha recargado en su cache de esquema',
];

// ⚠️ LIMITACION MEDIDA, no supuesta (2026-08-07). Al probar la deteccion con una
// vista trampa expuesta a `anon`, la primera corrida dio VERDE: PostgREST cachea
// su esquema, seguia publicando 25 objetos y el 26 no llegaba a probarse. Con
// `NOTIFY pgrst, 'reload schema'` aparecieron los 26 y el gate fallo como debia.
//
// Consecuencia practica: este verificador ve lo que PostgREST expone AHORA, no
// lo que hay en `pg_class`. En CI eso basta —corre mucho despues del DDL— pero
// justo tras aplicar una migracion puede ir un paso por detras.
//
// Y la leccion que casi cuesta el hallazgo: la primera prueba de deteccion se
// habria apuntado como "el gate no detecto nada" cuando lo que fallaba era que
// **la trampa nunca llego a estar puesta**. Antes de creerse un control
// negativo, hay que comprobar que el sabotaje entro de verdad.

/**
 * Clasifica UNA respuesta. Aislada a proposito: es lo que el autotest ejerce.
 * @returns {'FUGA'|'OK_VACIO'|'OK_SIN_PRIVILEGIO'|'SONDA_MUERTA'|'INDETERMINADO'}
 */
export function clasificar(status, body) {
  const texto = typeof body === 'string' ? body : JSON.stringify(body ?? '');

  // Una clave legacy desactivada devuelve 401 con este mensaje. Si se contara
  // como "cerrado", una credencial muerta pondria todo el gate en verde.
  if (/legacy api keys are disabled/i.test(texto)) return 'SONDA_MUERTA';
  if (/invalid api key|no api key found/i.test(texto)) return 'SONDA_MUERTA';

  if (status === 200) {
    let filas;
    try {
      filas = typeof body === 'string' ? JSON.parse(body) : body;
    } catch {
      return 'INDETERMINADO';
    }
    if (!Array.isArray(filas)) return 'INDETERMINADO';
    return filas.length > 0 ? 'FUGA' : 'OK_VACIO';
  }

  // 42501 = permission denied. Es el estado bueno: no hay ni privilegio.
  if ((status === 401 || status === 403) && /42501|permission denied/i.test(texto)) {
    return 'OK_SIN_PRIVILEGIO';
  }

  // Todo lo demas es "no pude verlo", que NO es lo mismo que "no hay nada".
  return 'INDETERMINADO';
}

function autotest() {
  const casos = [
    // [status, body, esperado, por que importa]
    [200, [{ id: 1, full_name: 'x' }], 'FUGA', 'una fila devuelta es la fuga que motivo el script'],
    [200, [], 'OK_VACIO', 'vacio con la sonda viva es el estado bueno'],
    [
      401,
      { code: '42501', message: 'permission denied for view customer_segments' },
      'OK_SIN_PRIVILEGIO',
      'lo que devuelve la base despues de 030',
    ],
    [
      401,
      { message: 'Legacy API keys are disabled' },
      'SONDA_MUERTA',
      'el falso verde que se vivio el 2026-08-07',
    ],
    [401, { message: 'Invalid API key' }, 'SONDA_MUERTA', 'clave rota: tampoco es un aprobado'],
    [500, 'Internal Server Error', 'INDETERMINADO', 'no pude verlo != no hay nada'],
    [200, 'esto no es json', 'INDETERMINADO', 'respuesta ilegible no se cuenta como vacia'],
  ];

  let fallos = 0;
  for (const [status, body, esperado, motivo] of casos) {
    const real = clasificar(status, body);
    const ok = real === esperado;
    if (!ok) fallos++;
    console.log(
      `  ${ok ? '✓' : '✗'} ${status} -> ${real}${ok ? '' : ` (esperado ${esperado})`}  · ${motivo}`
    );
  }

  // Control de falsos positivos: el clasificador NO debe marcar FUGA en nada
  // que no sea una respuesta 200 con filas.
  const falsosPositivos = casos.filter(
    ([s, b, esp]) => esp !== 'FUGA' && clasificar(s, b) === 'FUGA'
  );
  if (falsosPositivos.length) {
    console.log(`  ✗ ${falsosPositivos.length} falsos positivos`);
    fallos += falsosPositivos.length;
  } else {
    console.log('  ✓ ningun falso positivo sobre los casos buenos');
  }

  console.log(
    fallos === 0
      ? '\n✅ AUTOTEST OK — detecta el caso malo y no dispara con los buenos'
      : `\n❌ AUTOTEST FALLA (${fallos})`
  );
  return fallos === 0 ? 0 : 1;
}

async function leerClaveLocal() {
  try {
    const { readFileSync } = await import('node:fs');
    const { homedir } = await import('node:os');
    return readFileSync(`${homedir()}/.config/cafe-mirador/anon.key`, 'utf8').trim();
  } catch {
    return '';
  }
}

async function main() {
  if (process.argv.includes('--autotest')) process.exit(autotest());

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (await leerClaveLocal());

  if (!url || !servicio || !anon) {
    console.log(
      '\n⚠️  OMITIDO — falta NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o la clave publica.'
    );
    console.log(
      '   NO se comprobo si algun objeto expone datos a un anonimo. Esto NO es un aprobado.'
    );
    console.log('   En CI los tres existen y la comprobacion corre.\n');
    process.exit(0);
  }

  const cab = k => ({ apikey: k, Authorization: `Bearer ${k}` });

  // 1. Descubrir. Con la clave anonima esto devuelve 0 objetos: hace falta la
  //    de servicio, y por eso el gate no puede correr solo con la publica.
  const esquema = await fetch(`${url}/rest/v1/`, { headers: cab(servicio) }).then(r => r.json());
  const objetos = Object.keys(esquema.definitions ?? {}).sort();
  if (objetos.length === 0) {
    console.error('❌ El descubrimiento devolvio 0 objetos. Sin corpus no hay veredicto posible.');
    process.exit(1);
  }
  console.log(`\nDescubiertos ${objetos.length} objetos en public (tablas + vistas).`);

  // 2. Probar cada uno con la clave publica.
  const veredictos = new Map();
  for (const obj of objetos) {
    const r = await fetch(`${url}/rest/v1/${obj}?select=*&limit=1`, { headers: cab(anon) });
    const cuerpo = await r.text();
    veredictos.set(obj, clasificar(r.status, cuerpo));
  }

  // 3. Control positivo OBLIGATORIO antes de emitir veredicto.
  const vio = [...veredictos.values()].filter(v => v === 'OK_VACIO').length;
  const muertas = [...veredictos.values()].filter(v => v === 'SONDA_MUERTA').length;
  if (muertas > 0 || vio === 0) {
    console.error('\n❌ SONDA MUERTA — la clave publica no esta autenticando contra la base.');
    console.error(
      `   ${muertas} respuestas de clave invalida/legacy, ${vio} objetos alcanzados con exito.`
    );
    console.error('   Un "no hay nada expuesto" sacado de aqui seria ceguera, no seguridad.');
    process.exit(1);
  }

  const fugas = objetos.filter(o => veredictos.get(o) === 'FUGA' && !ALLOWLIST.has(o));
  const dudosos = objetos.filter(o => veredictos.get(o) === 'INDETERMINADO');

  console.log(
    `Control positivo: ${vio} objetos respondieron 200 con lista vacia (la sonda ve la base).`
  );
  console.log(
    `Sin privilegio  : ${[...veredictos.values()].filter(v => v === 'OK_SIN_PRIVILEGIO').length}`
  );
  console.log(`\nEste verificador NO mira: ${NO_MIRA.join(' · ')}`);

  if (dudosos.length) {
    console.error(
      `\n❌ ${dudosos.length} objetos INDETERMINADOS (no pude verlos, que no es lo mismo que "no hay nada"):`
    );
    for (const o of dudosos) console.error(`   - ${o}`);
  }
  if (fugas.length) {
    console.error(
      `\n❌ FUGA: ${fugas.length} objetos devuelven datos a un anonimo con la clave publica:`
    );
    for (const o of fugas) console.error(`   - ${o}`);
    console.error(
      '\n   Revisa si es una vista sin `security_invoker` (ver 030) o un GRANT a anon.'
    );
  }

  if (fugas.length || dudosos.length) process.exit(1);
  console.log('\n✅ Ningun objeto de public devuelve datos a un anonimo.\n');
}

// Solo se ejecuta cuando se invoca como script. Sin este guard, importar
// `clasificar` desde un test dispararia la comprobacion entera contra la red.
const invocadoDirectamente =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (invocadoDirectamente) {
  main().catch(e => {
    console.error('❌ El verificador reviento:', e.message);
    process.exit(1);
  });
}
