/**
 * Forum askı gate — son-part.md §7.2 Local World iz bırakamaz
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../services/penaltyService.js', () => ({
  assertCanJoinRitual: jest.fn(),
}));

const { assertCanJoinRitual } = await import('../services/penaltyService.js');
const { assertForumWritable } = await import('../services/forumService.js');

describe('forum penalty gate (§7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('blocks forum write when user is penalty suspended', async () => {
    assertCanJoinRitual.mockResolvedValue({
      ok: false,
      code: 'PENALTY_SUSPENDED',
      message: 'No-show askısı aktif — ritüele katılamazsın.',
    });

    const result = await assertForumWritable('ritual-1', 'user-1');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.code).toBe('PENALTY_SUSPENDED');
  });
});
