import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import LOCAL_CONFIG from '../config/localConfig.js';
import { auraWordForChip, toIdentityNoun } from '../i18n/auraCopyMap.js';
import { composeVenueCharacterCard } from '../services/discoveryProfileService.js';
import {
  formatSellerLabel,
  buildMembershipBadge,
  membershipVitrineDefaultOn,
} from '../services/venueMembershipService.js';
import { getPublicConfig } from '../services/publicConfigService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('§12 vitrin kilitleri', () => {
  test('1 eligible P2V = 1 gece gözlemi', () => {
    expect(LOCAL_CONFIG.venue.MIN_ANSWERS_PER_OBS).toBe(1);
  });

  test('copy-map: ekip ilgiliydi → ilgili ekip · P2V chip kimlik', () => {
    expect(toIdentityNoun('ekip ilgiliydi')).toBe('ilgili ekip');
    expect(auraWordForChip('p2v_g_5')).toBe('ilgili ekip');
    expect(auraWordForChip('p2v_y_3')).toBe('gürültü-sever');
  });

  test('n<5: Trust cümlesi + Aura tür etiketi · kelime yok', () => {
    const card = composeVenueCharacterCard({
      venueId: 'v1',
      name: 'Roast',
      city: 'Kadıköy',
      categoryTag: 'Kafe',
      trustDisplay: {
        score: null,
        score_hidden: true,
        public_label: 'Yeni mekan — LOCAL beş kez tanır, sonra konuşur',
        n_eff: 2,
      },
      auraDisplay: { hidden: true, words: ['sohbetli'] },
      topChips: [{ chip_id: 'p2v_g_5', count: 23 }],
    });
    expect(card.trust.score).toBeNull();
    expect(card.trust.public_label).toMatch(/beş kez/);
    expect(card.aura.words).toEqual([]);
    expect(card.aura.label).toBe('Kafe');
    expect(card.chips_under_scores).toEqual([]);
  });

  test('n≥5: Aura kelimeleri kartta', () => {
    const card = composeVenueCharacterCard({
      categoryTag: 'Kafe',
      trustDisplay: { score: 8.1, score_hidden: false, n_eff: 12 },
      auraDisplay: { hidden: false, words: ['sıcak', 'sohbetli', 'gürültü-sever'] },
      topChips: [{ chip_id: 'p2v_g_5', count: 23 }],
    });
    expect(card.trust.score).toBe(8.1);
    expect(card.aura.words).toEqual(['sıcak', 'sohbetli', 'gürültü-sever']);
    expect(card.chips_under_scores[0].label).toBe('ilgili ekip');
    expect(card.chips_under_scores[0].count).toBe(23);
  });

  test('üyelik vitrini default açık · seller künyesi · launch-direkt', () => {
    expect(membershipVitrineDefaultOn()).toBe(true);
    expect(LOCAL_CONFIG.venue.SELLER_AT_VENUE).toBe(true);
    expect(LOCAL_CONFIG.venue.ORG_TO_ORG).toBe(true);
    expect(formatSellerLabel({ seller_name: 'Elif', seller_verified: true })).toBe('Satıcı: Elif ✓');
    expect(formatSellerLabel({})).toBeNull();
    expect(buildMembershipBadge([{ active: true }, { active: true }], true)).toEqual({
      label: 'Üyelik & Kredi satışta · 2 plan',
      plan_count: 2,
      screen: 'VenueMembership',
    });
    expect(buildMembershipBadge([{ active: true }], false)).toBeNull();
    const pub = getPublicConfig();
    expect(pub.venue.membership_vitrine_default).toBe(true);
    expect(pub.venue.seller_at_venue).toBe(true);
    expect(pub.venue.org_to_org).toBe(true);
  });

  test('enroll RS/DS yazmaz', () => {
    const src = readFileSync(join(__dirname, '../services/venueMembershipService.js'), 'utf8');
    expect(src).not.toMatch(/rsEngine|computeUserRS|updateRS/);
    expect(src).toMatch(/rs_touch: false/);
  });
});
