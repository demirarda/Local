/**
 * Ritual join gates — LOCAL v2 §14
 * User rituals: NO min-RS. Allowed: badge · category · university_gate · capacity
 */
import LOCAL_CONFIG from '../config/localConfig.js';
import { userMeetsBadgeRequirement } from './badgeEngine.js';

const UNI_GATES = new Set(['same_uni', 'uni_only']);

export function normalizeUniversityGate(raw) {
  if (raw == null || raw === '' || raw === false) return null;
  const v = String(raw).trim().toLowerCase();
  if (v === 'same_uni' || v === 'same_university' || v === 'sadece_universitem') return 'same_uni';
  if (v === 'uni_only' || v === 'university_only' || v === 'sadece_universiteliler') return 'uni_only';
  return null;
}

/**
 * §14 — reject min-RS on user ritual create/patch
 */
export function rejectUserRitualMinRs(body = {}) {
  if (body.min_rs != null || body.min_rs_threshold != null) {
    return {
      ok: false,
      error: 'min-RS koşulu kullanıcı Ritualsinde yok (§14). Koşullar: badge · kategori · üni · kapasite.',
    };
  }
  return { ok: true };
}

export async function assertRitualAudienceGates(db, userId, ritual) {
  const gate = normalizeUniversityGate(ritual.university_gate);
  if (gate) {
    const u = await db.query(
      `SELECT university, identity_track, email_verified
       FROM users WHERE id = $1`,
      [userId]
    );
    const viewer = u.rows[0] || {};
    const isTrackB = viewer.identity_track === 'identity';
    const hasUni =
      Boolean(viewer.university) &&
      Boolean(viewer.email_verified) &&
      !isTrackB;

    if (gate === 'uni_only') {
      // Şerit-B katılamaz
      if (!hasUni) {
        return {
          ok: false,
          code: 'UNI_ONLY_GATE',
          error: 'Bu Ritual yalnız üniversitelilere açık (Şerit-B katılamaz).',
        };
      }
    }

    if (gate === 'same_uni') {
      if (!hasUni) {
        return {
          ok: false,
          code: 'SAME_UNI_GATE',
          error: 'Bu Ritual yalnız host’un üniversitesine açık.',
        };
      }
      const host = await db.query(
        `SELECT university, identity_track, email_verified FROM users WHERE id = $1`,
        [ritual.host_id]
      );
      const hostUni = host.rows[0]?.university;
      if (
        !hostUni ||
        String(hostUni).toLowerCase() !== String(viewer.university).toLowerCase()
      ) {
        return {
          ok: false,
          code: 'SAME_UNI_GATE',
          error: 'Bu Ritual yalnız aynı üniversiteye açık.',
        };
      }
    }
  }

  if (ritual.required_badge_slug) {
    const meets = await userMeetsBadgeRequirement(
      userId,
      ritual.required_badge_slug,
      'novice'
    );
    if (!meets) {
      return {
        ok: false,
        code: 'BADGE_GATE',
        error: `Bu Ritual için rozet gerekli: ${ritual.required_badge_slug}`,
      };
    }
  }

  // §14: min_rs on user rituals is ignored (deprecated)
  return { ok: true };
}

export { UNI_GATES, LOCAL_CONFIG };
