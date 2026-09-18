import { describe, test, expect } from '@jest/globals';
import { resolveRsForViewer } from '../services/rsVisibility.js';
import LOCAL_CONFIG, { rsRingOpacity } from '../config/localConfig.js';

describe('RS visibility (sonMD E3.5 + 24 Ağu placement/FAR)', () => {
  const live = { farPhase: 2, placementComplete: true };

  test('owner always sees own RS + ring when FAR≥1 and placement done', () => {
    const flags = new Map([['u2', true]]);
    const r = resolveRsForViewer('u1', 'u1', 7.2, flags, live);
    expect(r.rs_score).toBe(7.2);
    expect(r.rs_visible).toBe(true);
    expect(r.rs_public_raw).toBe(true);
    expect(r.rs_ring_opacity).toBe(rsRingOpacity(7.2));
  });

  test('other user hidden when not public', () => {
    const flags = new Map([['u2', false]]);
    const r = resolveRsForViewer('u1', 'u2', 8.1, flags, live);
    expect(r.rs_score).toBeNull();
    expect(r.rs_visible).toBe(false);
    expect(r.rs_ring_opacity).toBeNull();
  });

  test('other user sees ring only when opted in (no raw score)', () => {
    expect(LOCAL_CONFIG.rs.visibility.PUBLIC_RAW_SCORE).toBe(false);
    const flags = new Map([['u2', true]]);
    const r = resolveRsForViewer('u1', 'u2', 6.5, flags, live);
    expect(r.rs_score).toBeNull();
    expect(r.rs_visible).toBe(true);
    expect(r.rs_ring_opacity).toBe(rsRingOpacity(6.5));
    expect(r.rs_public_raw).toBe(false);
  });

  test('missing flag defaults to private', () => {
    const r = resolveRsForViewer('u1', 'u9', 5.0, new Map(), live);
    expect(r.rs_score).toBeNull();
    expect(r.rs_visible).toBe(false);
  });

  test('placement incomplete hides even from owner', () => {
    const r = resolveRsForViewer('u1', 'u1', 7.2, new Map(), {
      farPhase: 2,
      placementComplete: false,
    });
    expect(r.rs_visible).toBe(false);
    expect(r.rs_hidden_reason).toBe('placement');
  });

  test('FAR phase 0 hides from everyone (log-only)', () => {
    const r = resolveRsForViewer('u1', 'u1', 7.2, new Map(), {
      farPhase: 0,
      placementComplete: true,
    });
    expect(r.rs_visible).toBe(false);
    expect(r.rs_hidden_reason).toBe('far_phase_0');
    expect(r.rs_score).toBeNull();
  });

  test('ring opacity scales with score', () => {
    expect(rsRingOpacity(1)).toBeLessThan(rsRingOpacity(10));
    expect(rsRingOpacity(5)).toBeGreaterThan(0.1);
  });
});
