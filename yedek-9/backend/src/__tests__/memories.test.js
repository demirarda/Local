import request from 'supertest';
import { app } from '../index.js';

describe('Memories API basic validation', () => {
  test('GET /api/memories/eligibility should require ritual_id and user_id', async () => {
    const res = await request(app).get('/api/memories/eligibility');

    expect(res.statusCode).toBe(401);
  });
});

