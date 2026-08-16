import request from 'supertest';
import { app } from '../index.js';

describe('Chat API basic validation', () => {
  test('POST /api/chat/:ritualId/messages should require user_id and message', async () => {
    const res = await request(app)
      .post('/api/chat/some-ritual-id/messages')
      .send({});

    expect(res.statusCode).toBe(401);
  });
});

