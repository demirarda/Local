/**
 * k6 Load Test - Basic API Endpoints
 * Tests critical endpoints under load
 * 
 * Run: k6 run load-tests/k6-basic.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 10 },    // Stay at 10 users
    { duration: '30s', target: 50 },  // Ramp up to 50 users
    { duration: '2m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 100 },  // Ramp up to 100 users
    { duration: '2m', target: 100 },  // Stay at 100 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'],   // Error rate should be less than 1%
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Test 1: Health Check
  const healthCheck = http.get(`${BASE_URL}/health`);
  check(healthCheck, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 100ms': (r) => r.timings.duration < 100,
  }) || errorRate.add(1);

  sleep(0.5);

  // Test 2: Detailed Health Check
  const detailedHealth = http.get(`${BASE_URL}/health/detailed`);
  check(detailedHealth, {
    'detailed health status is 200': (r) => r.status === 200,
    'detailed health has database status': (r) => JSON.parse(r.body).checks.database !== undefined,
    'detailed health has redis status': (r) => JSON.parse(r.body).checks.redis !== undefined,
  }) || errorRate.add(1);

  sleep(0.5);

  // Test 3: Pulse Rituals (most critical endpoint)
  const pulseParams = {
    headers: { 'Content-Type': 'application/json' },
    params: { city: 'Milano', viewer_id: 'test-user-1' },
  };
  const pulseResponse = http.get(`${BASE_URL}/api/rituals/pulse`, pulseParams);
  check(pulseResponse, {
    'pulse status is 200': (r) => r.status === 200,
    'pulse response time < 1000ms': (r) => r.timings.duration < 1000,
    'pulse has live_now array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.live_now !== undefined;
      } catch (e) {
        return false;
      }
    },
  }) || errorRate.add(1);

  sleep(1);

  // Test 4: API Root
  const apiRoot = http.get(`${BASE_URL}/api`);
  check(apiRoot, {
    'api root status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(0.5);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-tests/results.json': JSON.stringify(data),
  };
}
