import request from 'supertest';
import { app } from '../index.js';

describe('CityRhythm API smoke tests', () => {
  test('GET /api/city-rhythm/browse should respond with success', async () => {
    const res = await request(app).get('/api/city-rhythm/browse');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });

  test('GET /api/city-rhythm/browse without viewer returns only open entry rituals in SQL filter path', async () => {
    const res = await request(app).get('/api/city-rhythm/browse?city=Milano&limit=5');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    const rows = res.body.data || [];
    for (const row of rows) {
      expect(String(row.entry_type || 'open').toLowerCase()).toBe('open');
    }
  });
});

