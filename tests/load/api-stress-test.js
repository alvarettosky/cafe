import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Un 401 sin sesion es la respuesta CORRECTA de /api/export, no un fallo de red.
// Sin esto, http_req_failed reportaba 33% (1 de cada 3 requests) en corridas sanas
// y la metrica quedaba inservible como senal.
http.setResponseCallback(http.expectedStatuses(200));
const EXPECT_401 = http.expectedStatuses(401);

// El Rate registra el acierto Y el fallo de cada bloque. Registrar solo los fallos
// (`check(...) || errorRate.add(1)`) hacia que el rate valiera 1.0 en cuanto un
// unico check fallara: el umbral declarado del 10% era en realidad "cero fallos".
const errorRate = new Rate('errors');

// La latencia se vigila por percentil, no con un check por request. Un check
// `duration < N` es un umbral sobre el PEOR request de la corrida (p100), y la
// cola de este backend mide 11-16x el p95 de forma estable, tambien en las
// noches verdes (medido en los runs #103-#106): con 11.000 requests por noche,
// el p100 siempre acaba superando cualquier techo fijo.
const homepageDuration = new Trend('homepage_duration', true);
const loginDuration = new Trend('login_duration', true);
const exportApiDuration = new Trend('export_api_duration', true);

export const options = {
  // p(99) no entra en el summary por defecto; sin esto handleSummary lo
  // reporta como 0.00 aunque el threshold si lo evalue.
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  stages: [
    { duration: '1m', target: 10 }, // Ramp up to 10 users
    { duration: '3m', target: 10 }, // Stay at 10 users
    { duration: '1m', target: 50 }, // Spike to 50 users
    { duration: '2m', target: 50 }, // Stay at 50 users
    { duration: '1m', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    // Calibrado sobre 4 noches reales en CI (runs #103-#106, runner GitHub ->
    // Vercel): p95 global observado 74.2 / 75.8 / 82.3 / 97.3 ms.
    // 300 ms = 3.1x el peor observado -> dispara ante una degradacion de 3x.
    http_req_duration: ['p(95)<300', 'p(99)<2000'],

    // Medidos en CI (run #107): homepage 26.8, login 26.9, export 117.3 ms. El
    // export es ~4.4x los otros dos y concentra la cola (su max fue 950 ms, el
    // maximo global de la corrida), de ahi el techo mas alto. Son una red laxa a
    // proposito y con UNA sola noche de datos: cenirlos pide varias corridas, y
    // el gate efectivo es el p(95) global, que sube igual si un endpoint se degrada.
    homepage_duration: ['p(95)<300'],
    login_duration: ['p(95)<300'],
    export_api_duration: ['p(95)<800'],

    // Ahora que el rate es una fraccion real: 1% de los ~11.000 checks de una
    // noche (3.674 iteraciones x 3) son ~110 fallos, no uno suelto.
    errors: ['rate<0.01'],
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Test 1: Homepage SSR delivery (auth redirect is client-side, SSR returns 200)
  let res = http.get(`${BASE_URL}/`);
  homepageDuration.add(res.timings.duration);
  errorRate.add(
    !check(res, {
      'homepage status is 200': r => r.status === 200,
    })
  );

  sleep(1);

  // Test 2: Login page - publicly accessible, always returns full content
  res = http.get(`${BASE_URL}/login`);
  loginDuration.add(res.timings.duration);
  errorRate.add(
    !check(res, {
      'login page status is 200': r => r.status === 200,
    })
  );

  sleep(1);

  // Test 3: API export endpoint without auth (validates API layer responds under load)
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    responseCallback: EXPECT_401,
  };

  res = http.post(
    `${BASE_URL}/api/export`,
    JSON.stringify({ tables: ['inventory'], format: 'csv' }),
    params
  );
  exportApiDuration.add(res.timings.duration);
  errorRate.add(
    !check(res, {
      'export API responds (401 without auth)': r => r.status === 401,
    })
  );

  sleep(1);
}

export function handleSummary(data) {
  return {
    'test-results/load/summary.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options?.indent || '';
  const m = data.metrics;
  const pct = v => (v * 100).toFixed(2);
  // `http_req_failed.values.passes` cuenta los requests que FALLARON (el Rate
  // registra `true` en el fallo). La etiqueta anterior, "Failed Requests", se
  // leia como total y reportaba 3674 fallos en corridas que estaban sanas.
  const failed = m.http_req_failed?.values?.passes || 0;
  const total = m.http_reqs?.values?.count || 0;
  const p = (metric, q) => (metric?.values?.[q] || 0).toFixed(2);

  let summary = `\n${indent}Test Summary:\n`;
  summary += `${indent}  Total Requests: ${total}\n`;
  summary += `${indent}  Unexpected-status Requests: ${failed}`;
  summary += ` (${pct(m.http_req_failed?.values?.rate || 0)}%)\n`;
  summary += `${indent}  Checks failed: ${m.checks?.values?.fails || 0}`;
  summary += ` of ${(m.checks?.values?.passes || 0) + (m.checks?.values?.fails || 0)}\n`;
  summary += `${indent}  Average Duration: ${p(m.http_req_duration, 'avg')}ms\n`;
  summary += `${indent}  95th Percentile: ${p(m.http_req_duration, 'p(95)')}ms\n`;
  summary += `${indent}  99th Percentile: ${p(m.http_req_duration, 'p(99)')}ms\n`;
  summary += `${indent}  Slowest Request: ${p(m.http_req_duration, 'max')}ms\n`;
  summary += `${indent}  p95 by endpoint - homepage: ${p(m.homepage_duration, 'p(95)')}ms`;
  summary += ` | login: ${p(m.login_duration, 'p(95)')}ms`;
  summary += ` | export API: ${p(m.export_api_duration, 'p(95)')}ms\n`;

  return summary;
}
