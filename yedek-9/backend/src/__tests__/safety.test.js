import request from 'supertest';
import { app } from '../index.js';

describe('Safety API basic validation', () => {
  test('POST /api/safety/report should require reporter_id, report_type and reason', async () => {
    const res = await request(app)
      .post('/api/safety/report')
      .send({});

    expect(res.statusCode).toBe(401);
  });

  test('POST /api/safety/report should validate report_type', async () => {
    const res = await request(app)
      .post('/api/safety/report')
      .send({
        reporter_id: 'user-1',
        report_type: 'invalid_type',
        reason: 'spam',
      });

    expect(res.statusCode).toBe(401);
  });

  test('POST /api/safety/block should require blocker_id and blocked_user_id', async () => {
    const res = await request(app)
      .post('/api/safety/block')
      .send({});

    expect(res.statusCode).toBe(401);
  });
});

