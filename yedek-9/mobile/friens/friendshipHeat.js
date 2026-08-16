/**
 * Friendship Heat Utility
 *
 * Arkadaşlık "sıcaklığını" hesaplar — kullanıcının bir arkadaşla
 * son ne zaman ve ne sıklıkta ritüel paylaştığına bakarak.
 *
 * Heat levels:
 *   hot   - son 7 gün içinde ortak ritüel (canlı)
 *   warm  - son 30 gün içinde ortak ritüel (sıcak)
 *   cool  - son 90 gün içinde ortak ritüel (tanıdık)
 *   cold  - 90+ gün ortak ritüel yok (soğuyan)
 *
 * Closeness groups:
 *   close       - 10+ ortak ritüel VEYA heat === 'hot'
 *   acquaintance- 2-10 ortak ritüel
 *   new         - son 30 günde tanışılmış, 1-2 ortak ritüel
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const HEAT_LEVELS = {
  HOT: 'hot',
  WARM: 'warm',
  COOL: 'cool',
  COLD: 'cold',
};

export const CLOSENESS = {
  CLOSE: 'close',
  ACQUAINTANCE: 'acquaintance',
  NEW: 'new',
};

/**
 * Heat level hesaplama.
 * @param {string|Date} lastRitualDate - Son ortak ritüel tarihi
 * @returns {string} 'hot' | 'warm' | 'cool' | 'cold'
 */
export function calculateHeat(lastRitualDate) {
  if (!lastRitualDate) return HEAT_LEVELS.COLD;

  const last = new Date(lastRitualDate);
  const now = Date.now();
  const daysSince = (now - last.getTime()) / MS_PER_DAY;

  if (daysSince <= 7) return HEAT_LEVELS.HOT;
  if (daysSince <= 30) return HEAT_LEVELS.WARM;
  if (daysSince <= 90) return HEAT_LEVELS.COOL;
  return HEAT_LEVELS.COLD;
}

/**
 * Yakınlık grubu hesaplama.
 * @param {object} friend - { firstMetDate, lastRitualDate, sharedRitualCount }
 * @returns {string} 'close' | 'acquaintance' | 'new'
 */
export function calculateCloseness(friend) {
  const { firstMetDate, sharedRitualCount = 0 } = friend;
  const heat = calculateHeat(friend.lastRitualDate);

  // Son 30 günde tanışıldı + az ortak ritüel → yeni
  if (firstMetDate) {
    const daysSinceMet = (Date.now() - new Date(firstMetDate).getTime()) / MS_PER_DAY;
    if (daysSinceMet <= 30 && sharedRitualCount <= 2) {
      return CLOSENESS.NEW;
    }
  }

  // 10+ ritüel VEYA hot → yakın
  if (sharedRitualCount >= 10 || heat === HEAT_LEVELS.HOT) {
    return CLOSENESS.CLOSE;
  }

  return CLOSENESS.ACQUAINTANCE;
}

/**
 * Gün sayısını kullanıcı dostu formatta döner.
 * "3g", "14g", "2ay", "8ay"
 */
export function formatDaysSince(lastDate) {
  if (!lastDate) return '—';
  const days = Math.floor((Date.now() - new Date(lastDate).getTime()) / MS_PER_DAY);
  if (days === 0) return 'bugün';
  if (days < 30) return `${days}g`;
  if (days < 365) return `${Math.floor(days / 30)}ay`;
  return `${Math.floor(days / 365)}yıl`;
}

/**
 * Heat'e göre kullanıcıya gösterilecek etiket.
 */
export const HEAT_LABELS = {
  hot: 'CANLI',
  warm: 'SICAK',
  cool: 'TANIDIK',
  cold: 'SOĞUYAN',
};

/**
 * Heat'e göre pip count (dolu nokta sayısı).
 * 4 pip toplam, heat'e göre kaç tanesi renkli.
 */
export const HEAT_PIP_COUNT = {
  hot: 4,
  warm: 3,
  cool: 2,
  cold: 1,
};

/**
 * Bir arkadaş listesini zenginleştir — her birine heat + closeness ekler.
 *
 * @param {Array} friends - Backend'den gelen arkadaş listesi
 * @returns {Array} - [{ ...friend, heat, closeness }]
 */
export function enrichFriends(friends) {
  if (!friends) return [];
  return friends.map((friend) => ({
    ...friend,
    heat: calculateHeat(friend.lastRitualDate),
    closeness: calculateCloseness(friend),
  }));
}

/**
 * Arkadaşları yakınlık grubuna göre ayır.
 */
export function groupByCloseness(enrichedFriends) {
  return {
    close: enrichedFriends.filter((f) => f.closeness === CLOSENESS.CLOSE),
    acquaintance: enrichedFriends.filter((f) => f.closeness === CLOSENESS.ACQUAINTANCE),
    new: enrichedFriends.filter((f) => f.closeness === CLOSENESS.NEW),
  };
}

/**
 * Heat dağılım istatistiği (context strip için).
 */
export function heatDistribution(enrichedFriends) {
  const counts = { hot: 0, warm: 0, cool: 0, cold: 0 };
  enrichedFriends.forEach((f) => {
    if (counts[f.heat] != null) counts[f.heat]++;
  });
  return counts;
}
