/**
 * k6 Stress Test - High Load Scenario
 * Tests system behavior under extreme load
 * 
 * Run: k6 run load-tests/k6-stress.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const pulseResponseTime = new Trend('pulse_response_time');

// Test configuration - Stress test
export const options = {
  stages: [
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '2m', target: 50 },   // Stay at 50 users
    { duration: '1m', target: 100 }, // Ramp up to 100 users
    { duration: '2m', target: 100 }, // Stay at 100 users
    { duration: '1m', target: 200 }, // Ramp up to 200 users
    { duration: '3m', target: 200 }, // Stay at 200 users (stress)
    { duration: '1m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% should be below 2s under stress
    http_req_failed: ['rate<0.05'],   // Allow up to 5% errors under stress
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CITIES = ['Milano', 'Istanbul', 'Berlin', 'Paris', 'London'];

export default function () {
  const city = CITIES[Math.floor(Math.random() * CITIES.length)];
  const userId = `test-user-${Math.floor(Math.random() * 1000)}`;

  // Primary test: Pulse endpoint (most critical)
  const pulseParams = {
    headers: { 'Content-Type': 'application/json' },
    params: { city, viewer_id: userId },
  };
  
  const pulseStart = Date.now();
  const pulseResponse = http.get(`${BASE_URL}/api/rituals/pulse`, pulseParams);
  const pulseDuration = Date.now() - pulseStart;
  
  pulseResponseTime.add(pulseDuration);
  
  check(pulseResponse, {
    'pulse status is 200': (r) => r.status === 200,
    'pulse response time acceptable': (r) => r.timings.duration < 3000,
  }) || errorRate.add(1);

  sleep(Math.random() * 2 + 0.5); // Random sleep between 0.5-2.5s

  // Secondary test: Health check (lighter load)
  if (Math.random() > 0.7) { // 30% of requests
    const healthCheck = http.get(`${BASE_URL}/health`);
    check(healthCheck, {
      'health check status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }

  sleep(Math.random() * 1 + 0.5); // Random sleep between 0.5-1.5s
}
