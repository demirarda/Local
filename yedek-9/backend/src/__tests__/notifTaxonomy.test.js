import { describe, it, expect } from '@jest/globals';
import {
  notifyExactDetailsUnlocked,
  notifyFeedbackClosing,
  notifyRitualCancelled,
  notifyLateArrivalJoin,
  notifySeatingStatusChange,
  notifyBadgeApproval,
  notifySuggestionResolved,
  notifyCheckinOpen,
  notifyDoorClosing,
  notifyRecurringInstance,
  notifyVenueMemoryArchived,
  notifyPrelobbyMessage,
  notifyPenaltySuspensionEnd,
  notifyPenaltyHostBanEnd,
  notifyReplacementRequired,
  notifyVenueRitualStarted,
  notifyVenueRitualEnded,
  notifyQuoteDiscussionInvite,
  notifyBadgeApproaching,
  notifyFlChange,
  notifyDsTierPrivate,
  notifyPublicMemoryFollow,
  resolvePushScreen,
  isWithinQuietHours,
} from '../services/notifications.js';
import LOCAL_CONFIG from '../config/localConfig.js';

describe('NOTIF taxonomy v1', () => {
  const wiredTypes = [
    'checkin_open',
    'door_closing',
    'keyword_opened',
    'exact_details_unlocked',
    'window_opened',
    'feedback_closing',
    'join_confirmed',
    'recurring_instance',
    'venue_memory_archived',
    'seating_status_change',
    'badge_approval',
    'late_arrival_join',
    'ritual_cancelled',
    'prelobby_message',
    'quote_discussion_invite',
    'penalty_suspension_end',
    'penalty_host_ban_end',
    'replacement_required',
    'venue_ritual_started',
    'venue_ritual_ended',
    'badge_approaching',
    'fl_change',
    'ds_tier',
    'public_memory_follow',
  ];

  it('exports handlers for all ritual-cycle types', () => {
    expect(typeof notifyCheckinOpen).toBe('function');
    expect(typeof notifyDoorClosing).toBe('function');
    expect(typeof notifyExactDetailsUnlocked).toBe('function');
    expect(typeof notifyFeedbackClosing).toBe('function');
    expect(typeof notifyRitualCancelled).toBe('function');
    expect(typeof notifyLateArrivalJoin).toBe('function');
    expect(typeof notifyRecurringInstance).toBe('function');
    expect(typeof notifyVenueMemoryArchived).toBe('function');
    expect(typeof notifySeatingStatusChange).toBe('function');
    expect(typeof notifyBadgeApproval).toBe('function');
    expect(typeof notifySuggestionResolved).toBe('function');
    expect(typeof notifyPrelobbyMessage).toBe('function');
    expect(typeof notifyPenaltySuspensionEnd).toBe('function');
    expect(typeof notifyReplacementRequired).toBe('function');
    expect(typeof notifyVenueRitualStarted).toBe('function');
    expect(typeof notifyQuoteDiscussionInvite).toBe('function');
    expect(typeof notifyBadgeApproaching).toBe('function');
    expect(typeof notifyFlChange).toBe('function');
    expect(typeof notifyDsTierPrivate).toBe('function');
    expect(typeof notifyPublicMemoryFollow).toBe('function');
  });

  it('resolvePushScreen maps new types to screens', () => {
    for (const type of wiredTypes) {
      const screen = resolvePushScreen(type, {});
      expect(screen).toBeTruthy();
    }
  });

  it('badge catalog maps to 6 families (§9)', () => {
    expect(LOCAL_CONFIG.badges.CATEGORIES).toHaveLength(6);
    const cats = new Set(LOCAL_CONFIG.badges.CATALOG.map((b) => b.spec_category));
    expect(cats.has('location')).toBe(true);
    expect(cats.has('region')).toBe(true);
    expect(cats.has('behavior')).toBe(true);
    expect(cats.has('content')).toBe(true);
    expect(cats.has('special')).toBe(true);
    expect(cats.has('venue') || cats.has('milestone')).toBe(true);
    expect(LOCAL_CONFIG.badges.CATALOG.length).toBeGreaterThanOrEqual(24);
  });
});
