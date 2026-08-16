import { describe, test, expect } from '@jest/globals';
import {
  resolvePushScreen,
  nextUpvoteNotifyMilestone,
  isWithinQuietHours,
  PUSH_SILENT_TYPES,
  notifyBadgeApproaching,
  notifyFlChange,
  notifyDsTierPrivate,
  notifyPublicMemoryFollow,
} from '../services/notifications.js';
import LOCAL_CONFIG from '../config/localConfig.js';

describe('NOTIF v1 (son-part.md §11)', () => {
  test('share_object opens Conversation', () => {
    expect(resolvePushScreen('share_object', {})).toBe('Conversation');
  });

  test('forum types open RitualForum', () => {
    expect(resolvePushScreen('forum_comment', {})).toBe('RitualForum');
    expect(resolvePushScreen('forum_repost', {})).toBe('RitualForum');
  });

  test('penalty types open NotificationCenter', () => {
    expect(resolvePushScreen('penalty_suspension', {})).toBe('NotificationCenter');
  });

  test('data.screen override wins', () => {
    expect(resolvePushScreen('share_object', { screen: 'RitualDetail' })).toBe('RitualDetail');
  });

  test('upvote milestone at threshold', () => {
    const t = LOCAL_CONFIG.notifications.FORUM_UPVOTE_THRESHOLD;
    expect(t).toBe(10);
    expect(LOCAL_CONFIG.notifications.FORUM_UPVOTE_STEP).toBe(10);
    expect(nextUpvoteNotifyMilestone(0, t - 1)).toBeNull();
    expect(nextUpvoteNotifyMilestone(0, t)).toBe(t);
    expect(nextUpvoteNotifyMilestone(t, t + 1)).toBeNull();
    expect(nextUpvoteNotifyMilestone(t, t + LOCAL_CONFIG.notifications.FORUM_UPVOTE_STEP)).toBe(
      t + LOCAL_CONFIG.notifications.FORUM_UPVOTE_STEP
    );
  });

  test('downvote never in push defaults', () => {
    expect(LOCAL_CONFIG.notifications.PUSH_DEFAULTS.memory_downvote).toBe(false);
  });

  test('silent types skip push but resolve screens', () => {
    expect(PUSH_SILENT_TYPES.has('fl_change')).toBe(true);
    expect(PUSH_SILENT_TYPES.has('ds_tier')).toBe(true);
    expect(PUSH_SILENT_TYPES.has('public_memory_follow')).toBe(true);
    expect(PUSH_SILENT_TYPES.has('badge_approaching')).toBe(false);
    expect(resolvePushScreen('ds_tier', {})).toBe('DSUserDashboard');
    expect(resolvePushScreen('badge_approaching', {})).toBe('BadgeGallery');
  });

  test('quiet hours wraps midnight', () => {
    expect(isWithinQuietHours('22:00', '08:00', new Date('2026-01-01T23:00:00'))).toBe(true);
    expect(isWithinQuietHours('22:00', '08:00', new Date('2026-01-01T12:00:00'))).toBe(false);
  });

  test('§11 silent handlers exist', () => {
    expect(typeof notifyBadgeApproaching).toBe('function');
    expect(typeof notifyFlChange).toBe('function');
    expect(typeof notifyDsTierPrivate).toBe('function');
    expect(typeof notifyPublicMemoryFollow).toBe('function');
  });
});
