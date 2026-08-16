import request from 'supertest';
import { app } from '../index.js';

describe('Verifications API basic validation', () => {
  test('GET /api/verifications/venue should require venue_name and city', async () => {
    const res = await request(app).get('/api/verifications/venue');

    expect(res.statusCode).toBe(400);
  });

  test('POST /api/verifications/host should require user_id', async () => {
    const res = await request(app)
      .post('/api/verifications/host')
      .send({});

    expect(res.statusCode).toBe(401);
  });

  test('POST /api/verifications/venue should require venue_name and city', async () => {
    const res = await request(app)
      .post('/api/verifications/venue')
      .send({});

    expect(res.statusCode).toBe(401);
  });
});

