/**
 * İçerik katmanı unit testleri — son-part.md §8
 */
import { describe, test, expect } from '@jest/globals';
import {
  validateSharePayload,
  sanitizeSharePayload,
} from '../services/shareService.js';
import LOCAL_CONFIG from '../config/localConfig.js';

describe('content layer (son-part.md §8)', () => {
  test('Share-2-Person rejects note-only messages', () => {
    const r = validateSharePayload({
      objectType: 'memory',
      objectId: null,
      note: 'hello alone',
    });
    expect(r.ok).toBe(false);
  });

  test('Share-2-Person allows object with optional note', () => {
    const r = validateSharePayload({
      objectType: 'memory',
      objectId: '00000000-0000-4000-8000-000000000001',
      note: 'bak bunu',
    });
    expect(r.ok).toBe(true);
    expect(r.note).toBe('bak bunu');
  });

  test('reaction types may omit object_id', () => {
    const r = validateSharePayload({
      objectType: 'reaction_geliyorum',
      objectId: null,
      note: null,
    });
    expect(r.ok).toBe(true);
  });

  test('public node types may omit object_id', () => {
    const r = validateSharePayload({
      objectType: 'ritual_send',
      objectId: null,
      note: 'katil',
    });
    expect(r.ok).toBe(true);
  });

  test('sanitizeSharePayload strips RS/DS keys', () => {
    const clean = sanitizeSharePayload({
      title: 'Rituel',
      rs_score: 7.2,
      ds_ema: 0.8,
      is_regular: true,
    });
    expect(clean.title).toBe('Rituel');
    expect(clean.rs_score).toBeUndefined();
    expect(clean.ds_ema).toBeUndefined();
    expect(clean.is_regular).toBeUndefined();
  });

  test('pulse TTL is 24h', () => {
    expect(LOCAL_CONFIG.content.PULSE_TTL_HOURS).toBe(24);
  });

  test('forum surface constants', () => {
    expect(LOCAL_CONFIG.content.FORUM_SURFACE_WHOLE).toBe('whole_window');
    expect(LOCAL_CONFIG.content.FORUM_SURFACE_MEMORIES).toBe('memories_only');
  });
});
