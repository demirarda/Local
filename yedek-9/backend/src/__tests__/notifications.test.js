import request from 'supertest';
import { app } from '../index.js';

describe('Notifications API basic validation', () => {
  test('POST /api/notifications/register should require user_id and token', async () => {
    const res = await request(app)
      .post('/api/notifications/register')
      .send({});

    expect(res.statusCode).toBe(401);
  });

  test('DELETE /api/notifications/unregister should require user_id and token', async () => {
    const res = await request(app)
      .delete('/api/notifications/unregister')
      .send({});

    expect(res.statusCode).toBe(401);
  });

  test('GET /api/notifications should require user_id', async () => {
    const res = await request(app).get('/api/notifications');

    expect(res.statusCode).toBe(401);
  });

  test('PATCH /api/notifications/:id/read should require user_id', async () => {
    const res = await request(app)
      .patch('/api/notifications/some-id/read')
      .send({});

    expect(res.statusCode).toBe(401);
  });

  test('PATCH /api/notifications/read-all should require user_id', async () => {
    const res = await request(app)
      .patch('/api/notifications/read-all')
      .send({});

    expect(res.statusCode).toBe(401);
  });
});

