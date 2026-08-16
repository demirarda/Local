/** son-part.md §7 — ceza / askı yardımcıları */

export const JOIN_GRACE_MINUTES = 10;

export function isWithinJoinGrace(joinedAt, nowMs = Date.now()) {
  if (!joinedAt) return false;
  const joined = new Date(joinedAt).getTime();
  if (Number.isNaN(joined)) return false;
  return nowMs - joined <= JOIN_GRACE_MINUTES * 60 * 1000;
}

export function formatPenaltyUntil(until) {
  if (!until) return '';
  const end = new Date(until);
  if (Number.isNaN(end.getTime())) return '';
  return end.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getPenaltyBannerText(penalty) {
  if (!penalty) return null;
  if (penalty.is_penalty_suspended) {
    const until = formatPenaltyUntil(penalty.penalty_suspended_until);
    return until
      ? `No-show askısı aktif — Rituale katılamazsın · ${until}'e kadar`
      : 'No-show askısı aktif — Rituale katılamazsın';
  }
  if (penalty.is_host_banned) {
    const until = formatPenaltyUntil(penalty.host_ban_until);
    return until
      ? `Host-ban aktif — Ritual açamazsın · ${until}'e kadar`
      : 'Host-ban aktif — Ritual açamazsın';
  }
  return null;
}

export function getApiErrorMessage(error, fallback = 'İşlem başarısız') {
  if (!error) return fallback;
  if (error.code === 'PENALTY_SUSPENDED') {
    const until = formatPenaltyUntil(error.until);
    return until
      ? `No-show askısı aktif — Rituale katılamazsın. Bitiş: ${until}`
      : error.message || 'No-show askısı aktif — Rituale katılamazsın.';
  }
  if (error.code === 'HOST_BANNED') {
    const until = formatPenaltyUntil(error.until);
    return until
      ? `Host-ban aktif — Ritual açamazsın. Bitiş: ${until}`
      : error.message || 'Host-ban aktif — Ritual açamazsın.';
  }
  return error.message || fallback;
}
