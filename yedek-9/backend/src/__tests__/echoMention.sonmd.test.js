import { describe, test, expect } from '@jest/globals';
import { extractMentionHandles } from '../services/mentionService.js';
import { toAudience } from '../services/waveBSocial.js';
import LOCAL_CONFIG from '../config/localConfig.js';

describe('echo guard + mention extract (launch P1)', () => {
  test('ECHO_CANNOT_RAISE is enabled', () => {
    expect(LOCAL_CONFIG.memory_audience.ECHO_CANNOT_RAISE).toBe(true);
  });

  test('audience mapping for echo surfaces', () => {
    expect(toAudience('solo')).toBe('WINDOW');
    expect(toAudience('CIRCLE')).toBe('CIRCLE');
    expect(toAudience('all')).toBe('CITY');
  });

  test('extractMentionHandles finds @handles', () => {
    expect(extractMentionHandles('selam @Ada_1 ve @bob')).toEqual(['ada_1', 'bob']);
    expect(extractMentionHandles('no mentions here')).toEqual([]);
  });

  test('mention default permission is masa', () => {
    expect(LOCAL_CONFIG.mention.DEFAULT_PERMISSION).toBe('masa');
    expect(LOCAL_CONFIG.mention.MAX_PER_MESSAGE).toBe(5);
  });
});
