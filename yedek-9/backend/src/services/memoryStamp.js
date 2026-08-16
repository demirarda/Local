/**
 * §3 — immutable visual stamp helpers
 * UI: "NBA GOAT · Çardak · 12 Tem"
 */

const TR_MONTHS_SHORT = [
  'Oca',
  'Sub',
  'Mar',
  'Nis',
  'May',
  'Haz',
  'Tem',
  'Agu',
  'Eyl',
  'Eki',
  'Kas',
  'Ara',
];

export function formatStampDay(dateLike) {
  const dt = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return null;
  return `${dt.getDate()} ${TR_MONTHS_SHORT[dt.getMonth()]}`;
}

/**
 * @param {object} ritualRow
 * @param {Date|string|null} [capturedAt]
 */
export function buildStampLabel(ritualRow, capturedAt = null) {
  const day = formatStampDay(capturedAt || ritualRow?.start_time || new Date());
  return (
    [ritualRow?.title, ritualRow?.location_name || ritualRow?.custom_location_name, day]
      .filter(Boolean)
      .join(' · ') || null
  );
}

/** Reject client attempts to declare gallery origin when window gallery is closed. */
export function assertCameraCaptureSource(body = {}, cfg = {}) {
  const galleryAllowed = cfg.GALLERY_IN_WINDOW === true;
  if (galleryAllowed) return null;
  const raw = String(body.capture_source || body.source || '').toLowerCase();
  if (raw === 'gallery' || raw === 'library' || body.from_gallery === true) {
    return 'gallery_forbidden_in_window';
  }
  return null;
}
