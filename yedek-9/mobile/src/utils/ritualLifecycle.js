const LOCATION_TYPE_LABELS = {
  custom: 'Ozel mekan',
  venue: 'Mekan',
  zone: 'Bolge',
  moving: 'Hareketli nokta',
};

export function getLocationTypeLabel(locationType) {
  if (!locationType) return 'Ozel mekan';
  return LOCATION_TYPE_LABELS[String(locationType).toLowerCase()] || 'Ozel mekan';
}

export function isPrelobbyPhase(ritual) {
  if (!ritual) return false;
  const phase = ritual.lifecycle_phase || ritual.status;
  return phase === 'prelobby' || phase === 'active';
}

export function isLivePhase(ritual) {
  if (!ritual) return false;
  const phase = ritual.lifecycle_phase || ritual.status;
  return phase === 'live';
}

export function isWindowPhase(ritual) {
  if (!ritual) return false;
  const phase = ritual.lifecycle_phase || ritual.status;
  return phase === 'window' || phase === 'ended';
}

export function isArchivedPhase(ritual) {
  if (!ritual) return false;
  const phase = ritual.lifecycle_phase || ritual.status;
  return phase === 'archived' || phase === 'closed';
}

export function isExactDetailsUnlocked(ritual) {
  if (!ritual) return false;
  if (ritual.exact_details_unlocked === true) return true;
  if (ritual.viewer_prelobby?.exact_details_unlocked === true) return true;

  const unlockAt =
    ritual.exact_details_unlocked_at ||
    ritual.viewer_prelobby?.exact_details_unlocked_at ||
    ritual.prelobby_grace_ends_at ||
    ritual.viewer_prelobby?.grace_ends_at;

  if (!unlockAt) return false;
  return new Date(unlockAt).getTime() <= Date.now();
}

export function getGraceEndsAt(ritual) {
  return (
    ritual?.prelobby_grace_ends_at ||
    ritual?.viewer_prelobby?.grace_ends_at ||
    ritual?.viewer_prelobby?.exact_details_unlocked_at ||
    null
  );
}

export function getGraceCountdown(endsAt, nowMs = Date.now()) {
  if (!endsAt) {
    return { unlocked: false, totalSeconds: 0, label: 'Grace bekleniyor' };
  }
  const endMs = new Date(endsAt).getTime();
  const diffSec = Math.max(0, Math.ceil((endMs - nowMs) / 1000));
  if (diffSec <= 0) {
    return { unlocked: true, totalSeconds: 0, label: 'Tam konum acildi' };
  }
  const m = Math.floor(diffSec / 60);
  const s = diffSec % 60;
  return {
    unlocked: false,
    totalSeconds: diffSec,
    label: m > 0 ? `${m} dk ${String(s).padStart(2, '0')} sn` : `${s} sn`,
  };
}

export function getOuterLocationSummary(ritual) {
  const typeLabel = getLocationTypeLabel(ritual?.location_type);
  const area = ritual?.venue_name || ritual?.location_name || 'Mekan';
  const city = ritual?.host?.city || ritual?.venue_city || '';
  return city ? `${typeLabel} · ${area}, ${city}` : `${typeLabel} · ${area}`;
}

export function getMaskedLocationHint(isParticipant) {
  if (!isParticipant) {
    return 'Katildiktan sonra prelobby sohbeti acilir; tam pin grace sonrasi acilir';
  }
  return 'Tam pin ve host notlari grace suresi bitince acilir';
}
