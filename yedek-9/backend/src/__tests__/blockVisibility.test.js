import { describe, test, expect } from '@jest/globals';
import {
  excludeBlockedUsersSql,
  filterBlockedAuthors,
} from '../services/blockVisibility.js';

describe('blockVisibility — sonMD Sosyal §3', () => {
  test('excludeBlockedUsersSql injects NOT EXISTS with viewer param', () => {
    const { sql, params, nextIndex } = excludeBlockedUsersSql('m.user_id', 'viewer-1', 2);
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain('blocks');
    expect(sql).toContain('$2');
    expect(params).toEqual(['viewer-1']);
    expect(nextIndex).toBe(3);
  });

  test('excludeBlockedUsersSql no-op without viewer', () => {
    const { sql, params, nextIndex } = excludeBlockedUsersSql('m.user_id', null, 1);
    expect(sql).toBe('');
    expect(params).toEqual([]);
    expect(nextIndex).toBe(1);
  });

  test('filterBlockedAuthors drops either-way peers', () => {
    const blocked = new Set(['b1', 'b2']);
    const rows = [
      { id: 1, user_id: 'ok' },
      { id: 2, user_id: 'b1' },
      { id: 3, user_id: 'b2' },
    ];
    expect(filterBlockedAuthors(rows, blocked).map((r) => r.id)).toEqual([1]);
  });
});
