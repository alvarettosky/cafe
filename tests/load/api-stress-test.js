import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 10 }, // Ramp up to 10 users
    { duration: '3m', target: 10 }, // Stay at 10 users
    { duration: '1m', target: 50 }, // Spike to 50 users
    { duration: '2m', target: 50 }, // Stay at 50 users
    { duration: '1m', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    errors: ['rate<0.1'],               // Error rate must be less than 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Test 1: Load homepage
  let res = http.get(`${BASE_URL}/`);
  check(res, {
    'homepage status is 200': (r) => r.status === 200,
    'homepage loads in <2s': (r) => r.timings.duration < 2000,
  }) || errorRate.add(1);

  sleep(1);

  // Test 2: Load analytics page
  res = http.get(`${BASE_URL}/analytics`);
  check(res, {
    'analytics status is 200': (r) => r.status === 200,
    'analytics loads in <3s': (r) => r.timings.duration < 3000,
  }) || errorRate.add(1);

  sleep(2);

  // Test 3: API endpoint - get metrics
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  res = http.post(
    `${BASE_URL}/api/metrics`,
    JSON.stringify({ period: 'today' }),
    params
  );

  check(res, {
    'metrics API status is 200': (r) => r.status === 200,
    'metrics API responds in <1s': (r) => r.timings.duration < 1000,
  }) || errorRate.add(1);

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
  const enableColors = options?.enableColors || false;

  let summary = `\n${indent}Test Summary:\n`;
  summary += `${indent}  Total Requests: ${data.metrics.http_reqs?.values?.count || 0}\n`;
  summary += `${indent}  Failed Requests: ${data.metrics.http_req_failed?.values?.passes || 0}\n`;
  summary += `${indent}  Average Duration: ${(data.metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms\n`;
  summary += `${indent}  95th Percentile: ${(data.metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)}ms\n`;

  return summary;
}
