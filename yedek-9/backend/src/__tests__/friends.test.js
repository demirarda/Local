import request from 'supertest';
import { app } from '../index.js';

describe('Friends API basic validation', () => {
  test('GET /api/friends should require user_id', async () => {
    const res = await request(app).get('/api/friends');

    expect(res.statusCode).toBe(401);
  });

  test('POST /api/friends should require user_id and friend_id', async () => {
    const res = await request(app)
      .post('/api/friends')
      .send({});

    expect(res.statusCode).toBe(401);
  });

  test('DELETE /api/friends/:id should require user_id', async () => {
    const res = await request(app).delete('/api/friends/some-id');

    expect(res.statusCode).toBe(401);
  });

  test('GET /api/friends/pending should require user_id', async () => {
    const res = await request(app).get('/api/friends/pending');

    expect(res.statusCode).toBe(401);
  });
});

