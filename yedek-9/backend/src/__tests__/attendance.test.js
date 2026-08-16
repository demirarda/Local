import request from 'supertest';
import { app } from '../index.js';

describe('Attendance API basic validation', () => {
  test('POST /api/attendance/checkin should require ritual_id and user_id', async () => {
    const res = await request(app)
      .post('/api/attendance/checkin')
      .send({});

    expect(res.statusCode).toBe(401);
  });

  test('POST /api/attendance/cancel should require ritual_id and user_id', async () => {
    const res = await request(app)
      .post('/api/attendance/cancel')
      .send({});

    expect(res.statusCode).toBe(401);
  });

  test('POST /api/attendance/leave should require ritual_id and user_id', async () => {
    const res = await request(app)
      .post('/api/attendance/leave')
      .send({});

    expect(res.statusCode).toBe(401);
  });
});

