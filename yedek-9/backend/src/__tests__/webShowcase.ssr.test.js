/**
 * §12 WEB-VİTRİN smoke — /w/* SSR + OG alanları, kişi profili yok, salt-okunur
 */
import express from 'express';
import request from 'supertest';
import LOCAL_CONFIG from '../config/localConfig.js';
import webShowcaseRouter, { seoMeta, showcaseBaseUrl } from '../api/webShowcase.js';
import { buildOgCard, missingOgFields } from '../services/ogCardService.js';

function buildApp() {
  const app = express();
  app.use('/w', webShowcaseRouter);
  return app;
}

describe('§12 web showcase SSR/OG', () => {
  it('showcase flag is off until prova (v3)', () => {
    expect(LOCAL_CONFIG.stubs.WEB_SHOWCASE_ENABLED).toBe(false);
  });

  it('og card carries every required field', () => {
    const og = buildOgCard({ title: 'Masa', description: 'Kadıköy', url: '/w/ritual/1' });
    expect(missingOgFields(og)).toEqual([]);
    expect(og.site_name).toBe('LOCAL');
    expect(og.twitter_card).toBe('summary');
    expect(buildOgCard({ imageUrl: 'https://cdn.local.app/a.jpg' }).twitter_card).toBe(
      'summary_large_image'
    );
  });

  it('seoMeta resolves canonical + og url absolutely', () => {
    const seo = seoMeta({ title: 'Kahve', description: 'Masa', url: '/w/venue/kahve' });
    expect(seo.canonical).toBe(`${showcaseBaseUrl()}/w/venue/kahve`);
    expect(seo.og.url).toBe(seo.canonical);
    expect(seo.title).toBe('Kahve');
    expect(seo.description).toBe('Masa');
    expect(missingOgFields(seo.og)).toEqual([]);
  });

  it('serves /w as 503 stub when flag off', async () => {
    const res = await request(buildApp()).get('/w');
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('WEB_SHOWCASE_OFF');
    expect(res.body.cta.app_store).toBeTruthy();
  });

  it('has no person profile routes', async () => {
    const app = buildApp();
    const user = await request(app).get('/w/user/abc');
    const people = await request(app).get('/w/people/abc');
    expect(user.statusCode).toBe(404);
    expect(people.statusCode).toBe(404);
    expect(user.body.cta.play_store).toBeTruthy();
  });

  it('rejects every write method (read-only vitrin)', async () => {
    const app = buildApp();
    for (const method of ['post', 'put', 'patch', 'delete']) {
      const res = await request(app)[method]('/w/pulse');
      expect(res.statusCode).toBe(405);
    }
  });
});
