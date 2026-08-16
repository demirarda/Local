const MS_PER_HOUR = 1000 * 60 * 60;

export const CURATION_SIGNALS = {
  SUPER_EVENT: 'super-event',
  EDITORS_PICK: 'editors-pick',
  PREMIUM: 'premium',
  PARTNER: 'partner',
  SPECIAL_GUEST: 'special-guest',
  LIMITED: 'limited',
  TRENDING: 'trending',
};

export const ACCESS_TYPES = {
  FREE: 'free',
  PAID: 'paid',
  INVITE_ONLY: 'invite-only',
  RS_GATED: 'rs-gated',
};

export const AVAIL_STATES = {
  OPEN: 'open',
  ALMOST_FULL: 'almost-full',
  FULL: 'full',
  WAITLIST_ONLY: 'waitlist-only',
};

export function calculateAvailState(taken, total) {
  if (total === 0) return AVAIL_STATES.OPEN;
  const ratio = taken / total;
  if (ratio >= 1) return AVAIL_STATES.WAITLIST_ONLY;
  if (ratio >= 0.95) return AVAIL_STATES.FULL;
  if (ratio >= 0.6) return AVAIL_STATES.ALMOST_FULL;
  return AVAIL_STATES.OPEN;
}

export function availPercent(taken, total) {
  if (!total) return 0;
  return Math.min(100, Math.round((taken / total) * 100));
}

export function formatAvailText(taken, total, waitlistCount = 0) {
  const state = calculateAvailState(taken, total);
  const remaining = Math.max(0, total - taken);
  switch (state) {
    case AVAIL_STATES.OPEN:
      return { main: `${remaining} yer boş`, sub: `${total} kişilik` };
    case AVAIL_STATES.ALMOST_FULL:
      return { main: `${remaining} yer kaldı`, sub: 'dolmak üzere' };
    case AVAIL_STATES.FULL:
      return { main: `Son ${remaining} yer`, sub: 'hizlica dolduruluyor' };
    case AVAIL_STATES.WAITLIST_ONLY:
      return { main: 'Etkinlik doldu', sub: waitlistCount > 0 ? `${waitlistCount} kişi bekleme listesinde` : 'bekleme listesi açık' };
    default:
      return { main: '', sub: '' };
  }
}

export function formatViewerCount(viewers = 0) {
  if (viewers < 2) return null;
  return { text: `${viewers} kişi şu anda bakıyor`, active: viewers >= 3, hot: viewers >= 10 };
}

export function isTrending(item) {
  if (!item) return false;
  const stats = item.liveStats || {};
  return (stats.viewsLastHour || 0) >= 50 || (stats.bookingsLastHour || 0) >= 10;
}

export function isLimitedUrgent(item) {
  if (!item) return false;
  if (item.registrationClosesAt) {
    const hoursLeft = (new Date(item.registrationClosesAt).getTime() - Date.now()) / MS_PER_HOUR;
    if (hoursLeft > 0 && hoursLeft <= 4) return true;
  }
  const { taken = 0, total = 0 } = item.availability || {};
  if (total > 0 && total - taken <= 3 && total - taken > 0) return true;
  return false;
}

export function formatLimitedText(item) {
  if (item.registrationClosesAt) {
    const hoursLeft = (new Date(item.registrationClosesAt).getTime() - Date.now()) / MS_PER_HOUR;
    if (hoursLeft > 0 && hoursLeft <= 4) return `SON ${Math.ceil(hoursLeft)} SAAT`;
  }
  const { taken = 0, total = 0 } = item.availability || {};
  const remaining = total - taken;
  if (remaining > 0 && remaining <= 3) return `SON ${remaining} YER`;
  return 'LIMITED';
}

export function enrichWithAvailability(items) {
  if (!items) return [];
  return items.map((item) => {
    const { taken = 0, total = 0, waitlist = 0 } = item.availability || {};
    const availState = calculateAvailState(taken, total);
    const percent = availPercent(taken, total);
    const viewerStatus = formatViewerCount(item.liveStats?.currentViewers || 0);
    return {
      ...item,
      _computed: {
        availState,
        availPercent: percent,
        availText: formatAvailText(taken, total, waitlist),
        viewerStatus,
        isTrending: isTrending(item),
        isLimited: isLimitedUrgent(item),
        limitedText: isLimitedUrgent(item) ? formatLimitedText(item) : null,
      },
    };
  });
}

export function totalLiveStats(items) {
  return items.reduce(
    (acc, item) => {
      acc.totalViewers += item.liveStats?.currentViewers || 0;
      if (item._computed?.isTrending) acc.trendingCount++;
      if (item._computed?.availState === AVAIL_STATES.WAITLIST_ONLY) acc.soldOutCount++;
      return acc;
    },
    { totalViewers: 0, trendingCount: 0, soldOutCount: 0 }
  );
}

export function priorityScore(item) {
  let score = 0;
  const signals = item.curationSignals || [];
  if (signals.includes(CURATION_SIGNALS.SUPER_EVENT)) score += 100;
  if (item._computed?.isLimited) score += 60;
  if (item._computed?.isTrending) score += 40;
  if (signals.includes(CURATION_SIGNALS.PREMIUM)) score += 30;
  if (signals.includes(CURATION_SIGNALS.PARTNER)) score += 20;
  if (signals.includes(CURATION_SIGNALS.EDITORS_PICK)) score += 15;
  if (signals.includes(CURATION_SIGNALS.SPECIAL_GUEST)) score += 10;
  if (item._computed?.availState === AVAIL_STATES.WAITLIST_ONLY) score -= 20;
  return score;
}
