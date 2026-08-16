import request from 'supertest';
import { app } from '../index.js';

describe('Auth API basic validation', () => {
  test('POST /api/auth/register should validate required fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error).toContain('Missing required fields');
  });

  test('POST /api/auth/login should validate required fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error).toContain('Email and password are required');
  });
});


