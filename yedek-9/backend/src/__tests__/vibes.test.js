import request from 'supertest';
import { app } from '../index.js';

describe('Vibes API basic validation', () => {
  test('POST /api/vibes should require user_id and vibe', async () => {
    const res = await request(app)
      .post('/api/vibes')
      .send({});

    expect(res.statusCode).toBe(401);
  });

  test('DELETE /api/vibes should require user_id and vibe', async () => {
    const res = await request(app)
      .delete('/api/vibes')
      .send({});

    expect(res.statusCode).toBe(401);
  });
});

