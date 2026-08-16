import request from 'supertest';
import { app } from '../index.js';

describe('Feedback API basic validation', () => {
  test('POST /api/feedback should require ritual_id, from_user_id and feedback_type', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({});

    expect(res.statusCode).toBe(401);
  });

  test('POST /api/feedback should reject invalid feedback_type', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({
        ritual_id: 'ritual-1',
        from_user_id: 'user-1',
        feedback_type: 'invalid_type',
      });

    expect(res.statusCode).toBe(401);
  });

  test('POST /api/feedback should reject invalid q1_comfort value', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({
        ritual_id: 'ritual-1',
        from_user_id: 'user-1',
        feedback_type: 'p2r',
        q1_comfort: 'not_valid',
      });

    expect(res.statusCode).toBe(401);
  });
});


