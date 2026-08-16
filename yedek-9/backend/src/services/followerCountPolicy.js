/**
 * Follower-count placement — sonMD 🔒 liste-içi
 * Profil DTO vanity alanlarını temizler; sayı yalnız liste meta'sında.
 */
import LOCAL_CONFIG from '../config/localConfig.js';

export function isFollowerCountListOnly() {
  return LOCAL_CONFIG.account_privacy?.FOLLOWER_COUNT_IN_LIST_ONLY !== false;
}

/** Profil/public kart — followers_count / following_count asla vanity rozet değil */
export function stripFollowerCountsFromProfile(dto = {}) {
  if (!dto || typeof dto !== 'object') return dto;
  if (!isFollowerCountListOnly()) return dto;
  const out = { ...dto };
  delete out.followers_count;
  delete out.followersCount;
  delete out.following_count;
  delete out.followingCount;
  delete out.follower_count;
  delete out.followerCount;
  out.follower_count_placement = 'list_only';
  out.profile_shows_follower_count = false;
  return out;
}

export function listCountMeta(count) {
  return {
    count: Number(count) || 0,
    count_placement: isFollowerCountListOnly() ? 'list_only' : 'profile_ok',
    profile_shows_count: !isFollowerCountListOnly(),
  };
}
