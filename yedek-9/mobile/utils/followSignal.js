const HOURS = 60 * 60 * 1000;
const DAYS = 24 * HOURS;

const toDate = (value, fallback = Date.now()) => {
  const d = new Date(value || fallback);
  return Number.isNaN(d.getTime()) ? new Date(fallback) : d;
};

const hoursAgo = (value) => Math.max(0, Math.floor((Date.now() - toDate(value).getTime()) / HOURS));

export const enrichWithSignals = (items = []) =>
  (items || []).map((item) => {
    const posted = toDate(item?.postedAt || item?.created_at || item?.start_time);
    const followedSince = toDate(item?.entity?.followedSince || item?.entity?.followed_since, Date.now() - 30 * DAYS);
    const avgPostsPerWeek = Number(item?.entity?.avgPostsPerWeek || 1);
    const recentHours = hoursAgo(posted);

    const freshness = recentHours <= 24 ? 'new' : recentHours <= 72 ? 'fresh' : 'stale';
    const regularity = avgPostsPerWeek >= 2 ? 'regular' : 'casual';
    const followsDays = Math.max(1, Math.floor((Date.now() - followedSince.getTime()) / DAYS));

    return {
      ...item,
      postedAt: posted.toISOString(),
      entity: {
        ...item.entity,
        followedSince: followedSince.toISOString(),
        avgPostsPerWeek,
      },
      signals: {
        freshness,
        regularity,
        followsDays,
      },
    };
  });

export const entityBreakdown = (items = []) => {
  const base = { host: 0, venue: 0, creator: 0, partner: 0 };
  (items || []).forEach((item) => {
    const kind = item?.entity?.kind;
    if (base[kind] !== undefined) base[kind] += 1;
  });
  return base;
};

export const filterByKind = (items = [], kind = 'all') => {
  if (!kind || kind === 'all') return items;
  return (items || []).filter((item) => item?.entity?.kind === kind);
};

export const sortForFeed = (items = []) =>
  [...(items || [])].sort((a, b) => {
    const ta = toDate(a?.postedAt || a?.created_at || a?.start_time).getTime();
    const tb = toDate(b?.postedAt || b?.created_at || b?.start_time).getTime();
    return tb - ta;
  });
