import { describe, test, expect } from '@jest/globals';
import { parseVatNumber, assertApplicationProof, checkVatNumber } from '../services/viesCheckService.js';

describe('VIES / belge', () => {
  test('parses EU and non-EU VAT', () => {
    const it = parseVatNumber('IT 00743110157');
    expect(it.ok).toBe(true);
    expect(it.eu).toBe(true);
    expect(it.countryCode).toBe('IT');
    const tr = parseVatNumber('TR1234567890');
    expect(tr.ok).toBe(true);
    expect(tr.eu).toBe(false);
  });

  test('AB dışı VAT belgesiz reddedilir', () => {
    const r = assertApplicationProof({
      vies_vat: 'TR1234567890',
      proof_url: null,
      viesResult: { eu: false, needs_document: true },
    });
    expect(r.ok).toBe(false);
  });

  test('geçerli VIES belgesiz kabul', () => {
    const r = assertApplicationProof({
      vies_vat: 'IT00743110157',
      proof_url: null,
      viesResult: { eu: true, ok: true },
    });
    expect(r.ok).toBe(true);
  });

  test('test env stubs EU VIES as ok', async () => {
    const r = await checkVatNumber('IT00743110157');
    expect(r.stub).toBe(true);
    expect(r.ok).toBe(true);
  });
});
