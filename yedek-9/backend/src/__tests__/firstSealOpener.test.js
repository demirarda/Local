import { describe, test, expect } from '@jest/globals';
import { pickFirstSealOpenerId } from '../utils/firstSealOpener.js';

describe('pickFirstSealOpenerId — §1 race', () => {
  const ritual = { host_id: 'host-1' };
  const sameSec = new Date('2026-08-14T10:00:00.200Z');
  const sameSecGuest = new Date('2026-08-14T10:00:00.800Z');

  test('same-second GREEN host wins opener credit', () => {
    expect(
      pickFirstSealOpenerId(
        ritual,
        'guest-1',
        { checkin_attempt_at: sameSec, checkin_phase: null },
        sameSecGuest
      )
    ).toBe('host-1');
  });

  test('PENDING host does not steal opener credit', () => {
    expect(
      pickFirstSealOpenerId(
        ritual,
        'guest-1',
        { checkin_attempt_at: sameSec, checkin_phase: 'pending_witness' },
        sameSecGuest
      )
    ).toBe('guest-1');
  });

  test('first writer wins when host has not attempted', () => {
    expect(pickFirstSealOpenerId(ritual, 'guest-1', null, sameSecGuest)).toBe('guest-1');
  });

  test('host acting as sealer stays opener', () => {
    expect(pickFirstSealOpenerId(ritual, 'host-1', null, sameSec)).toBe('host-1');
  });
});
