/**
 * son-part.md §5.4 — RS display helpers (null when hidden by privacy).
 */

export function isRsVisible(score, rsVisibleFlag) {
  if (rsVisibleFlag === false) return false;
  return score != null && Number.isFinite(Number(score));
}

export function formatRsLabel(score, { decimals = 1, prefix = 'RS ' } = {}) {
  if (!isRsVisible(score)) return null;
  return `${prefix}${Number(score).toFixed(decimals)}`;
}

export function rsOrNull(score) {
  if (score == null || !Number.isFinite(Number(score))) return null;
  return Number(score);
}
