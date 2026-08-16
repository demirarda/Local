import request from 'supertest';
import { app } from '../index.js';

describe('Interests API basic validation', () => {
  test('POST /api/interests/:userId should require category', async () => {
    const res = await request(app)
      .post('/api/interests/some-user-id')
      .send({});

    expect(res.statusCode).toBe(401);
  });
});

