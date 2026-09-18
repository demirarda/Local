/**
 * VIES / belge — AB KDV doğrulama; AB dışı için belge zorunlu.
 * REST: https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number
 */
export const EU_VAT_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES', 'FI', 'FR',
  'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO',
  'SE', 'SI', 'SK', 'XI',
]);

const VIES_URL = 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number';

export function parseVatNumber(raw) {
  const compact = String(raw || '').toUpperCase().replace(/[\s.\-]/g, '');
  if (!compact) return { ok: false, empty: true };
  const m = compact.match(/^([A-Z]{2})([A-Z0-9]{8,12})$/);
  if (!m) return { ok: false, empty: false, error: 'VAT formatı geçersiz (örn. IT00743110157)' };
  const countryCode = m[1] === 'GR' ? 'EL' : m[1];
  const vatNumber = m[2];
  return {
    ok: true,
    empty: false,
    countryCode,
    vatNumber,
    eu: EU_VAT_COUNTRIES.has(countryCode),
    formatted: `${countryCode}${vatNumber}`,
  };
}

export async function checkVatNumber(raw, { fetchImpl = fetch } = {}) {
  const parsed = parseVatNumber(raw);
  if (parsed.empty) {
    return { ok: null, eu: false, needs_document: true, skipped: true, parsed };
  }
  if (!parsed.ok) {
    return { ok: false, eu: false, error: parsed.error, parsed };
  }
  if (!parsed.eu) {
    return {
      ok: null,
      eu: false,
      needs_document: true,
      parsed,
      error: null,
      note: 'AB dışı KDV — VIES yok, belge (proof_url) zorunlu',
    };
  }
  if (process.env.NODE_ENV === 'test' || process.env.VIES_STUB === '1') {
    return { ok: true, eu: true, stub: true, parsed, name: null, address: null };
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetchImpl(VIES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ countryCode: parsed.countryCode, vatNumber: parsed.vatNumber }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: null, eu: true, unreachable: true, parsed, error: `VIES HTTP ${res.status}` };
    }
    const valid = Boolean(json.valid);
    return {
      ok: valid,
      eu: true,
      parsed,
      name: json.name || null,
      address: json.address || null,
      error: valid ? null : 'VIES: bu KDV numarası geçerli değil',
    };
  } catch (e) {
    return {
      ok: null,
      eu: true,
      unreachable: true,
      parsed,
      error: e.name === 'AbortError' ? 'VIES zaman aşımı' : (e.message || 'VIES erişilemedi'),
    };
  }
}

export function assertApplicationProof({ vies_vat, proof_url, viesResult }) {
  const vies = viesResult || {};
  if (vies.eu && vies.ok === false) {
    return { ok: false, error: vies.error || 'VIES: VAT geçersiz' };
  }
  if (vies.needs_document && !proof_url) {
    return { ok: false, error: 'AB dışı / VAT yok — işletme belgesi (PDF/foto) yükle' };
  }
  if (!vies_vat && !proof_url) {
    return { ok: false, error: 'VIES VAT veya belge yüklemesi zorunlu' };
  }
  if (vies.unreachable && !proof_url) {
    return { ok: false, error: 'VIES şu an yanıt vermiyor — belge yükle veya sonra dene' };
  }
  return { ok: true };
}
