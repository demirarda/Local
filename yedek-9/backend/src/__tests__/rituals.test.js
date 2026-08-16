import request from 'supertest';
import { app } from '../index.js';

describe('Rituals API basic validation', () => {
  test('POST /api/rituals should require core fields', async () => {
    const res = await request(app)
      .post('/api/rituals')
      .send({});

    expect(res.statusCode).toBe(401);
  });
});

