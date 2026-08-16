/**
 * World geo catalog — @countrystatecity/countries (ODbL)
 * 250 ülke · 150k+ şehir. Lazy-load; ülke bazında cache.
 */
import {
  getCountries,
  getCountryByCode,
  getAllCitiesOfCountry,
} from '@countrystatecity/countries';

const cityCache = new Map(); // iso2 → { at, cities }
const CITY_CACHE_MS = 1000 * 60 * 60; // 1h

let countriesCache = null;

/** LOCAL ürün isimleri ↔ dataset isimleri */
const CITY_ALIASES = {
  milano: ['milan', 'milano'],
  milan: ['milan', 'milano'],
  istanbul: ['istanbul', 'constantinople'],
  eskisehir: ['eskisehir', 'eskişehir'],
  izmir: ['izmir', 'smyrna'],
};

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export async function listWorldCountries() {
  if (countriesCache) return countriesCache;
  const rows = await getCountries();
  countriesCache = (rows || [])
    .map((c) => ({
      iso2: c.iso2,
      iso3: c.iso3,
      name: c.name,
      native: c.native || c.name,
      emoji: c.emoji || '',
      phonecode: c.phonecode,
      capital: c.capital,
      region: c.region,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  return countriesCache;
}

export async function getWorldCountry(iso2) {
  const code = String(iso2 || '').toUpperCase();
  if (!code) return null;
  const meta = await getCountryByCode(code);
  if (!meta) return null;
  return {
    iso2: meta.iso2,
    iso3: meta.iso3,
    name: meta.name,
    native: meta.native || meta.name,
    emoji: meta.emoji || '',
    capital: meta.capital,
    region: meta.region,
  };
}

async function loadCities(iso2) {
  const code = String(iso2 || '').toUpperCase();
  const hit = cityCache.get(code);
  if (hit && Date.now() - hit.at < CITY_CACHE_MS) return hit.cities;

  const rows = await getAllCitiesOfCountry(code);
  const cities = (rows || [])
    .map((c) => ({
      id: c.id,
      name: c.name,
      native: c.native || null,
      state_code: c.state_code,
      latitude: c.latitude ? Number(c.latitude) : null,
      longitude: c.longitude ? Number(c.longitude) : null,
      timezone: c.timezone || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));

  cityCache.set(code, { at: Date.now(), cities });
  return cities;
}

/**
 * @param {string} iso2
 * @param {{ q?: string, limit?: number, offset?: number }} opts
 */
export async function listWorldCities(iso2, opts = {}) {
  const all = await loadCities(iso2);
  const q = norm(opts.q);
  let filtered = all;
  if (q) {
    const aliases = CITY_ALIASES[q] || [q];
    filtered = all.filter((c) => {
      const n = norm(c.name);
      const nat = norm(c.native);
      return aliases.some((a) => n.includes(a) || (nat && nat.includes(a))) || n.includes(q) || (nat && nat.includes(q));
    });
  }
  const limit = Math.min(Math.max(Number(opts.limit) || 80, 1), 300);
  const offset = Math.max(Number(opts.offset) || 0, 0);
  const slice = filtered.slice(offset, offset + limit);
  return {
    total: filtered.length,
    limit,
    offset,
    has_more: offset + limit < filtered.length,
    cities: slice,
  };
}

export function matchLocalCityName(worldName, localName) {
  const a = norm(worldName);
  const b = norm(localName);
  if (!a || !b) return false;
  if (a === b) return true;
  const aliasA = CITY_ALIASES[a] || [a];
  const aliasB = CITY_ALIASES[b] || [b];
  return aliasA.some((x) => aliasB.includes(x));
}
