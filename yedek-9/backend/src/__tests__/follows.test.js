import request from 'supertest';
import { app } from '../index.js';

describe('Follows API basic validation', () => {
  test('GET /api/follows should require user_id', async () => {
    const res = await request(app).get('/api/follows');

    expect(res.statusCode).toBe(401);
  });

  test('POST /api/follows should require follower_id and following_id', async () => {
    const res = await request(app)
      .post('/api/follows')
      .send({});

    expect(res.statusCode).toBe(401);
  });

  test('DELETE /api/follows/:followingId should require follower_id', async () => {
    const res = await request(app).delete('/api/follows/some-id');

    expect(res.statusCode).toBe(401);
  });

  test('GET /api/follows/check should require follower_id and following_id', async () => {
    const res = await request(app).get('/api/follows/check');

    expect(res.statusCode).toBe(401);
  });
});

