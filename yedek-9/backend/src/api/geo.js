/**
 * GET /api/geo — dünya ülke/şehir kataloğu
 * Kaynak: @countrystatecity/countries (ODbL — attribution)
 */
import express from 'express';
import pool from '../config/database.js';
import {
  listWorldCountries,
  getWorldCountry,
  listWorldCities,
  matchLocalCityName,
} from '../services/worldGeoService.js';

const router = express.Router();

/** GET /api/geo/countries */
router.get('/countries', async (_req, res) => {
  try {
    const countries = await listWorldCountries();
    return res.json({
      success: true,
      data: countries,
      meta: {
        source: 'countrystatecity/countries',
        license: 'ODbL-1.0',
        attribution: 'https://github.com/dr5hn/countries-states-cities-database',
        count: countries.length,
      },
    });
  } catch (error) {
    console.error('GET /geo/countries', error);
    return res.status(500).json({ success: false, error: 'Ülke listesi alınamadı' });
  }
});

/**
 * GET /api/geo/cities?country=TR&q=ist&limit=80&offset=0
 * LOCAL cities tablosu ile ACTIVE/COMING birleşimi
 */
router.get('/cities', async (req, res) => {
  try {
    const iso2 = String(req.query.country || req.query.iso2 || '').toUpperCase();
    if (!iso2 || iso2.length !== 2) {
      return res.status(400).json({
        success: false,
        error: 'country (ISO2) gerekli — örn. TR, IT, GB',
      });
    }

    const country = await getWorldCountry(iso2);
    if (!country) {
      return res.status(404).json({ success: false, error: 'Ülke bulunamadı' });
    }

    const q = String(req.query.q || '').trim();
    const page = await listWorldCities(iso2, {
      q,
      limit: req.query.limit,
      offset: req.query.offset,
    });

    let localRows = [];
    try {
      const r = await pool.query(
        `SELECT id, name, country, status, teaser_copy, notify_enabled, is_active
         FROM cities
         WHERE country ILIKE $1
            OR country ILIKE $2
            OR LOWER(name) = ANY($3::text[])`,
        [
          country.name,
          country.native || country.name,
          ['milano', 'milan', 'istanbul', 'ankara', 'izmir', 'eskisehir', 'london', 'paris', 'berlin'],
        ]
      );
      localRows = r.rows;
    } catch {
      localRows = [];
    }

    const cities = page.cities.map((c) => {
      const local = localRows.find((l) => matchLocalCityName(c.name, l.name));
      const status = local?.status || 'WORLD';
      const isComing = status === 'COMING';
      return {
        world_id: c.id,
        id: local?.id || null,
        name: local?.name || c.name,
        native: c.native,
        country: country.name,
        country_iso2: iso2,
        state_code: c.state_code,
        latitude: c.latitude,
        longitude: c.longitude,
        status,
        is_coming: isComing,
        is_local: Boolean(local),
        teaser:
          local?.teaser_copy ||
          (isComing ? 'LOCAL henüz şehrinde değil — açılınca haber verelim.' : null),
        notify_enabled: local?.notify_enabled !== false,
      };
    });

    // LOCAL-only şehirler (dataset’te farklı isim) — arama boşken üste ekle
    if (!q) {
      const extras = localRows
        .filter((l) => !cities.some((c) => matchLocalCityName(c.name, l.name)))
        .filter((l) => {
          const cn = String(l.country || '').toLowerCase();
          return (
            cn.includes(String(country.name).toLowerCase()) ||
            cn.includes(String(country.native || '').toLowerCase()) ||
            (iso2 === 'IT' && /ital/i.test(l.country || '')) ||
            (iso2 === 'TR' && /türk|turk/i.test(l.country || ''))
          );
        })
        .map((l) => ({
          world_id: null,
          id: l.id,
          name: l.name,
          native: null,
          country: country.name,
          country_iso2: iso2,
          state_code: null,
          latitude: null,
          longitude: null,
          status: l.status || 'ACTIVE',
          is_coming: l.status === 'COMING',
          is_local: true,
          teaser: l.teaser_copy,
          notify_enabled: l.notify_enabled !== false,
        }));
      cities.unshift(...extras);
    }

    return res.json({
      success: true,
      data: {
        country,
        total: page.total,
        limit: page.limit,
        offset: page.offset,
        has_more: page.has_more,
        cities,
      },
    });
  } catch (error) {
    console.error('GET /geo/cities', error);
    return res.status(500).json({ success: false, error: 'Şehir listesi alınamadı' });
  }
});

export default router;
