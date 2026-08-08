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
 *      objetos de `public`. Con la clave anonima ese mismo endpoint devuelve 0
 *      objetos — por eso el descubrimiento no puede hacerse con ella.
 *   2. CONTRASTA el corpus descubierto con `anon-baseline.json` (ver abajo).
 *   3. PRUEBA cada objeto con la clave PUBLICA (`NEXT_PUBLIC_SUPABASE_ANON_KEY`,
 *      o `~/.config/cafe-mirador/anon.key` en local). Es literalmente lo que
 *      tiene a mano cualquiera que abra el bundle de la web.
 *   4. FALLA si algun objeto devuelve una sola fila, si aparece un objeto
 *      alcanzable que no estaba declarado, o si el corpus encoge.
 *
 * ---------------------------------------------------------------------------
 * TRES COSAS QUE ESTE SCRIPT APRENDIO A LA MALA
 * ---------------------------------------------------------------------------
 *
 * 1. **El control positivo no es opcional.** La primera sonda de la
 *    investigacion uso la clave de `.env.local`, una legacy desactivada el
 *    2026-07-27: todas las peticiones devolvieron 401 y el resultado se habria
 *    leido como "nada expuesto". Por eso se exige haber ALCANZADO la base
 *    antes de emitir veredicto.
 *
 * 2. **Vacio no es lo mismo que protegido.** Una tabla recien creada siempre
 *    esta vacia; si `anon` puede leerla, el dia que entren filas seran
 *    publicas y ninguna corrida intermedia lo habria dicho. Por eso NO basta
 *    con "no devolvio filas": el conjunto de objetos ALCANZABLES (los que
 *    responden 200, aunque sea con `[]`) se compara contra una linea base
 *    declarada, y cualquiera nuevo hace fallar el gate.
 *
 * 3. **Lo que no se prueba no se puede aprobar.** El corpus sale del esquema
 *    de PostgREST, que se cachea. Si el descubrimiento devuelve menos objetos
 *    de los declarados, el veredicto no es "todo bien": es que la sonda no vio
 *    todo, y eso falla.
 *
 * Uso:
 *   node scripts/check-anon-exposure.mjs
 *   node scripts/check-anon-exposure.mjs --autotest    # se prueba a si mismo
 *   node scripts/check-anon-exposure.mjs --strict      # faltar credenciales = fallo
 *   node scripts/check-anon-exposure.mjs --actualizar-linea-base
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RUTA_LINEA_BASE = join(AQUI, 'anon-baseline.json');

// Lo que este verificador NO mira, dicho en voz alta para que nadie lo lea
// como cobertura que no tiene:
const NO_MIRA = [
  'funciones RPC ejecutables por anon (ver 029 y get_advisors)',
  'buckets de Storage',
  'escritura anonima: solo se comprueba SELECT',
  'RLS entre roles AUTENTICADOS (aprobado vs no aprobado): aqui solo se sondea como anon',
];

/**
 * Clasifica UNA respuesta. Aislada a proposito: es lo que el autotest ejerce.
 *
 * ⚠️ EL ORDEN IMPORTA. El codigo de estado se mira ANTES que el texto: una
 * clave muerta nunca devuelve 200, asi que un 200 con filas es siempre FUGA
 * aunque el contenido de una fila contenga por casualidad "Invalid API key"
 * (`customers.notes`, `inventory_movements.reason` y las observaciones de
 * ventas son texto libre que escribe una persona). Al reves, la fuga se
 * disfrazaba de sonda muerta.
 *
 * @returns {'FUGA'|'OK_VACIO'|'OK_SIN_PRIVILEGIO'|'SONDA_MUERTA'|'INDETERMINADO'}
 */
export function clasificar(status, body) {
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

  const texto = typeof body === 'string' ? body : JSON.stringify(body ?? '');

  // Una clave legacy desactivada o invalida devuelve 401 con estos mensajes.
  // Contarlo como "cerrado" dejaria que una credencial muerta aprobara la base.
  if (/legacy api keys are disabled/i.test(texto)) return 'SONDA_MUERTA';
  if (/invalid api key|no api key found/i.test(texto)) return 'SONDA_MUERTA';

  // 42501 = permission denied. Es el estado bueno: no hay ni privilegio.
  if ((status === 401 || status === 403) && /42501|permission denied/i.test(texto)) {
    return 'OK_SIN_PRIVILEGIO';
  }

  // Todo lo demas es "no pude verlo", que NO es lo mismo que "no hay nada".
  return 'INDETERMINADO';
}

/** Un objeto es ALCANZABLE por anon si la peticion llega a la base y responde. */
export function esAlcanzable(veredicto) {
  return veredicto === 'FUGA' || veredicto === 'OK_VACIO';
}

function autotest() {
  const casos = [
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
    // El caso que ordena el status ANTES que el texto:
    [
      200,
      [{ id: 1, notes: 'el cliente reporta Invalid API key al entrar' }],
      'FUGA',
      'una fuga cuyo TEXTO menciona una clave invalida sigue siendo fuga',
    ],
    [
      200,
      [{ id: 2, reason: 'Legacy API keys are disabled, se rehizo el movimiento' }],
      'FUGA',
      'idem con el mensaje de clave legacy dentro de una fila',
    ],
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

  // Control de falsos positivos: nada que no sea un 200 con filas debe ser FUGA.
  const falsosPositivos = casos.filter(
    ([s, b, esp]) => esp !== 'FUGA' && clasificar(s, b) === 'FUGA'
  );
  if (falsosPositivos.length) {
    console.log(`  ✗ ${falsosPositivos.length} falsos positivos`);
    fallos += falsosPositivos.length;
  } else {
    console.log('  ✓ ningun falso positivo sobre los casos buenos');
  }

  // Un 200 SIEMPRE cuenta como alcanzado: es lo que sostiene el control positivo.
  if (!esAlcanzable('OK_VACIO') || !esAlcanzable('FUGA') || esAlcanzable('SONDA_MUERTA')) {
    console.log('  ✗ esAlcanzable no distingue "llegue a la base" de "no llegue"');
    fallos++;
  } else {
    console.log('  ✓ esAlcanzable cuenta 200 (con y sin filas) y descarta las claves muertas');
  }

  console.log(
    fallos === 0
      ? '\n✅ AUTOTEST OK — detecta el caso malo y no dispara con los buenos'
      : `\n❌ AUTOTEST FALLA (${fallos})`
  );
  return fallos === 0 ? 0 : 1;
}

function leerClaveLocal() {
  try {
    return readFileSync(`${homedir()}/.config/cafe-mirador/anon.key`, 'utf8').trim();
  } catch {
    return '';
  }
}

function leerLineaBase() {
  try {
    return JSON.parse(readFileSync(RUTA_LINEA_BASE, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--autotest')) process.exit(autotest());

  // En CI faltar credenciales NO puede ser un aprobado: los secretos no se
  // inyectan en PRs desde forks, y este repositorio es publico, asi que sin
  // modo estricto el paso saldria verde sin haber tocado la base.
  const estricto = args.includes('--strict') || process.env.CI === 'true';
  const actualizarBase = args.includes('--actualizar-linea-base');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || leerClaveLocal();

  if (!url || !servicio || !anon) {
    const faltan = [
      !url && 'NEXT_PUBLIC_SUPABASE_URL',
      !servicio && 'SUPABASE_SERVICE_ROLE_KEY',
      !anon && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ].filter(Boolean);
    console.log(`\n⚠️  NO SE COMPROBO NADA — faltan: ${faltan.join(', ')}.`);
    console.log('   Esto NO es un aprobado: no se sabe si algun objeto expone datos.');
    if (estricto) {
      console.error('\n❌ Modo estricto (--strict o CI=true): un verificador que no puede correr');
      console.error('   no puede dar por buena la base. Revisa los secretos del entorno.');
      process.exit(1);
    }
    console.log('   (fuera de CI se sale con 0 para no romper un commit sin conexion)\n');
    process.exit(0);
  }

  const cab = k => ({ apikey: k, Authorization: `Bearer ${k}` });

  // 1. Descubrir.
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
    veredictos.set(obj, clasificar(r.status, await r.text()));
  }

  const fugas = objetos.filter(o => veredictos.get(o) === 'FUGA');
  const dudosos = objetos.filter(o => veredictos.get(o) === 'INDETERMINADO');
  const muertas = objetos.filter(o => veredictos.get(o) === 'SONDA_MUERTA');
  const alcanzables = objetos.filter(o => esAlcanzable(veredictos.get(o)));

  // 3. LAS FUGAS SE REPORTAN PRIMERO, pase lo que pase con el resto.
  //    Antes el guard del control positivo se evaluaba antes que esto, asi que
  //    un colapso total del RLS (todo devuelve filas ⇒ cero OK_VACIO) se
  //    imprimia como "sonda muerta" y no se nombraba ni un objeto.
  if (fugas.length) {
    console.error(`\n❌ FUGA: ${fugas.length} objetos devuelven datos a un anonimo:`);
    for (const o of fugas) console.error(`   - ${o}`);
    console.error(
      '\n   Revisa si es una vista sin `security_invoker` (ver 030) o un GRANT a anon.'
    );
  }

  // 4. Control positivo: hay que haber ALCANZADO la base. Un 401 de permiso
  //    tambien prueba que la peticion llego, asi que cuenta.
  const llegoALaBase =
    alcanzables.length > 0 || objetos.some(o => veredictos.get(o) === 'OK_SIN_PRIVILEGIO');
  if (muertas.length > 0 || !llegoALaBase) {
    console.error('\n❌ SONDA MUERTA — la clave publica no esta autenticando contra la base.');
    console.error(`   ${muertas.length} respuestas de clave invalida/legacy.`);
    console.error('   Un "no hay nada expuesto" sacado de aqui seria ceguera, no seguridad.');
    process.exit(1);
  }

  // 5. Linea base: vacio NO es lo mismo que protegido.
  const base = leerLineaBase();
  if (actualizarBase) {
    const nueva = {
      medido: new Date().toISOString().slice(0, 10),
      nota: 'Objetos que PostgREST expone y, de ellos, los que anon alcanza (200, aunque sea []). Un objeto alcanzable nuevo exige revision consciente: si esta vacio hoy, sus filas de manana serian publicas.',
      objetos,
      alcanzables_por_anon: alcanzables,
    };
    writeFileSync(RUTA_LINEA_BASE, JSON.stringify(nueva, null, 2) + '\n');
    console.log(
      `\n📝 Linea base reescrita: ${objetos.length} objetos, ${alcanzables.length} alcanzables.`
    );
    process.exit(0);
  }

  let derivaBase = false;
  if (!base) {
    console.error(
      `\n❌ Falta ${RUTA_LINEA_BASE}. Generala con --actualizar-linea-base y revisala.`
    );
    derivaBase = true;
  } else {
    const nuevosAlcanzables = alcanzables.filter(o => !base.alcanzables_por_anon.includes(o));
    const desaparecidos = base.objetos.filter(o => !objetos.includes(o));
    if (nuevosAlcanzables.length) {
      console.error(
        `\n❌ ${nuevosAlcanzables.length} objeto(s) ALCANZABLES por anon sin declarar:`
      );
      for (const o of nuevosAlcanzables) console.error(`   - ${o}`);
      console.error('   Hoy pueden estar vacios; sus filas de manana serian publicas.');
      derivaBase = true;
    }
    if (desaparecidos.length) {
      console.error(`\n❌ ${desaparecidos.length} objeto(s) de la linea base NO aparecieron en el`);
      console.error('   descubrimiento. O se borraron, o el cache de esquema de PostgREST va');
      console.error('   por detras — y lo que no se prueba no se puede aprobar:');
      for (const o of desaparecidos) console.error(`   - ${o}`);
      derivaBase = true;
    }
  }

  if (dudosos.length) {
    console.error(
      `\n❌ ${dudosos.length} objetos INDETERMINADOS (no pude verlos, que no es lo mismo que "no hay nada"):`
    );
    for (const o of dudosos) console.error(`   - ${o}`);
  }

  console.log(
    `\nAlcanzados por anon: ${alcanzables.length} · sin privilegio: ${objetos.length - alcanzables.length - dudosos.length}`
  );
  console.log(`Este verificador NO mira: ${NO_MIRA.join(' · ')}`);

  if (fugas.length || dudosos.length || derivaBase) process.exit(1);
  console.log('\n✅ Ningun objeto de public devuelve datos a un anonimo.\n');
}

// Solo se ejecuta cuando se invoca como script. Sin este guard, importar
// `clasificar` desde un test dispararia la comprobacion entera contra la red.
// `pathToFileURL` y no una plantilla `file://${argv[1]}`: la segunda no maneja
// rutas con `#`, `?` o `%`, y un desajuste ahi haria que el script no corriera
// y saliera con 0 — el verde falso exacto contra el que avisa la cabecera.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => {
    console.error('❌ El verificador reviento:', e.message);
    process.exit(1);
  });
}
