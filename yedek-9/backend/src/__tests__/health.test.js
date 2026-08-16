import request from 'supertest';
import { app } from '../index.js';

describe('Health and root API endpoints', () => {
  test('GET /health should return status ok', async () => {
    const res = await request(app).get('/health');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
  });

  test('GET /api should return basic API info', async () => {
    const res = await request(app).get('/api');

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      message: 'LOCAL API',
      status: 'running',
    });
  });
});


