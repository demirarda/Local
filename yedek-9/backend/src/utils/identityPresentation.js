/**
 * LOCAL v2 §1 — uni-label / track presentation helpers
 * Track A: university email verified → may show 🎓 uni-tag
 * Track B: identity KYC → uni-tag field absent (never render empty)
 */

export function resolveIdentityTrack(user = {}) {
  if (user.identity_track === 'university' || user.identity_track === 'identity') {
    return user.identity_track;
  }
  if (user.email_verified && user.university) return 'university';
  if (user.identity_verified) return 'identity';
  return null;
}

export function isIdentityGateSatisfied(user = {}) {
  return Boolean(user.email_verified || user.identity_verified);
}

/** Doc remnant: users.verified = Track A OR Track B */
export function isUserVerifiedFlag(user = {}) {
  return isIdentityGateSatisfied(user);
}

/**
 * Track B: never show uni label (even if university column somehow set).
 * Track A: show only when uni_label_visible !== false and university present.
 */
export function shouldShowUniLabel(user = {}) {
  const track = resolveIdentityTrack(user);
  if (track !== 'university') return false;
  if (!user.university) return false;
  return user.uni_label_visible !== false;
}

export function publicUniversityField(user = {}) {
  return shouldShowUniLabel(user) ? user.university : null;
}

export function identityStatusPayload(user = {}) {
  const track = resolveIdentityTrack(user);
  const verified = isUserVerifiedFlag(user);
  const show = shouldShowUniLabel(user);
  return {
    verified,
    track,
    age_ok: Boolean(user.age_ok || track === 'university'),
    identity_verified: Boolean(user.identity_verified),
    email_verified: Boolean(user.email_verified),
    uni_label_visible: track === 'university' ? user.uni_label_visible !== false : false,
    show_uni_label: show,
    university: show ? user.university : null,
  };
}
