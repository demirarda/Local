jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

import { buildQrModules } from '../utils/qrMatrix';
import {
  buildCheckinIntegrity,
  buildLocalTagQrPayload,
  parseLocalTagQrPayload,
} from '../utils/checkinIntegrity';

describe('LOCAL-TAG QR payload', () => {
  test('round-trips token', () => {
    const token = 'ab'.repeat(16);
    const payload = buildLocalTagQrPayload(token);
    expect(payload.startsWith('local-tag:')).toBe(true);
    expect(parseLocalTagQrPayload(payload)).toBe(token);
  });

  test('matrix has finder patterns', () => {
    const mod = buildQrModules(buildLocalTagQrPayload('aa'.repeat(16)));
    expect(mod.length).toBeGreaterThanOrEqual(21);
    expect(mod.length).toBe(mod[0].length);
    const dark = (x, y) => mod[y][x] === 1;
    expect(dark(0, 0)).toBe(true);
    expect(dark(6, 0)).toBe(true);
    expect(dark(0, 6)).toBe(true);
    expect(dark(mod.length - 1, 0)).toBe(true);
    expect(dark(0, mod.length - 1)).toBe(true);
  });
});

describe('T2 integrity flags', () => {
  test('clean GPS sends no fail flags', () => {
    const i = buildCheckinIntegrity({ mockLocation: false });
    expect(i.mock_location).toBe(false);
    expect(i.play_integrity).toBeUndefined();
    expect(i.root).toBe(false);
  });

  test('mock location marks Android Play Integrity fail + root', () => {
    const i = buildCheckinIntegrity({ mockLocation: true });
    expect(i.mock_location).toBe(true);
    expect(i.play_integrity).toBe(false);
    expect(i.root).toBe(true);
  });
});
