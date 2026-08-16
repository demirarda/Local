import request from 'supertest';
import { app } from '../index.js';

describe('Users API basic validation', () => {
  test('GET /api/users/:id/profile-in-ritual should require ritual_id and viewer_id query params', async () => {
    const res = await request(app).get('/api/users/some-user-id/profile-in-ritual');

    expect(res.statusCode).toBe(401);
  });
});

