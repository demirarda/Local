/**
 * §11 NOTIF — push tap routing (backend resolvePushScreen ↔ React Navigation)
 */

export function navigateFromNotification(navigationRef, data = {}) {
  if (!navigationRef?.current) return;

  const screen = data.screen;
  const ritualId = data.ritual_id || data.ritualId;
  const venueId = data.venue_id || data.venueId;
  const userId = data.from_user_id || data.sender_id || data.friend_id || data.creator_id;
  const userName = data.from_name || data.friend_name || data.creator_name;

  navigationRef.current.navigate('Main', { screen: 'Pulse' });

  setTimeout(() => {
    const nav = navigationRef.current;
    if (!nav) return;

    switch (screen) {
      case 'Conversation':
        if (userId) nav.navigate('Conversation', { userId, userName });
        break;
      case 'RitualForum':
        if (ritualId) nav.navigate('RitualForum', { ritualId });
        break;
      case 'WaitingRoom':
        if (ritualId) nav.navigate('WaitingRoom', { ritualId });
        break;
      case 'RitualFeedback':
        if (ritualId) nav.navigate('RitualFeedback', { ritualId });
        break;
      case 'RitualDetail':
        if (ritualId) nav.navigate('RitualDetail', { ritualId });
        break;
      case 'RitualCheckIn':
        if (ritualId) nav.navigate('RitualCheckIn', { ritualId });
        break;
      case 'BadgeGallery':
        nav.navigate('BadgeGallery', { initialTab: 'earned' });
        break;
      case 'VenueManager':
        if (venueId) nav.navigate('VenueManager', { venueId });
        break;
      case 'VenueSlots':
        if (venueId) nav.navigate('VenueSlots', { venueId });
        break;
      case 'VenueDetail':
        if (venueId) nav.navigate('VenueDetail', { venueId });
        break;
      case 'VenueArchive':
        if (venueId) nav.navigate('VenueArchive', { venueId });
        break;
      case 'VenueApply':
        nav.navigate('VenueApply');
        break;
      case 'DSUserDashboard':
        nav.navigate('DSUserDashboard');
        break;
      case 'FriendsList':
        nav.navigate('FriendsList', { userId: data.viewer_id, initialTab: 'friends' });
        break;
      case 'YourMemories':
        nav.navigate('YourMemories');
        break;
      case 'NotificationCenter':
        nav.navigate('NotificationCenter');
        break;
      default: {
        const nType = String(data.type || '').toLowerCase();
        if (nType.includes('feedback') || nType.includes('rs')) {
          if (ritualId) nav.navigate('RitualFeedback', { ritualId });
        } else if (ritualId) {
          nav.navigate('RitualDetail', { ritualId });
        } else if (venueId) {
          nav.navigate('VenueDetail', { venueId });
        }
        break;
      }
    }
  }, 400);
}
