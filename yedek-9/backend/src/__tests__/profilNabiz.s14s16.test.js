/**
 * §14–§16 Profil / Nabız / i18n — v3 satır 369–412 kapanış
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import LOCAL_CONFIG from '../config/localConfig.js';
import STRING_TABLE, { t } from '../i18n/stringTable.js';
import { resolvePulseRingFill } from '../services/pulseService.js';
import { rejectUserRitualMinRs } from '../services/ritualAudienceGate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const mobileRoot = join(__dirname, '../../../mobile/src');

function readSrc(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function readMobile(rel) {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('§14–§16 pct100', () => {
  test('user ritual rejects min-RS; uni gates exist', () => {
    expect(rejectUserRitualMinRs({ min_rs: 6 }).ok).toBe(false);
    expect(rejectUserRitualMinRs({ university_gate: 'same_uni' }).ok).toBe(true);
    const create = readMobile('screens/CreateRitualScreen.js');
    expect(create).toContain("value: 'same_uni'");
    expect(create).toContain("value: 'uni_only'");
    expect(create).toContain('Şerit-B katılamaz');
    expect(create).toContain('min-RS yok');
  });

  test('PulseRing fill is RQ continuously; fallback occupancy', () => {
    expect(resolvePulseRingFill({ rqAverage: 0.85, ratio: 0.2 })).toBe(0.85);
    expect(resolvePulseRingFill({ rqAverage: null, ratio: 0.4 })).toBe(0.4);
    expect(LOCAL_CONFIG.pulse.BANDS).toEqual({ low: 0.4, mid: 0.7 });
    expect(LOCAL_CONFIG.pulse.MEMORY_RANK_MIX).toEqual({ upvote: 1, soz: 1.2, yanki: 0.8 });
    const ring = readMobile('components/PulseRing.js');
    expect(ring).toContain('resolvePulseRingFill');
    expect(ring).not.toContain('PRELOBBY — doluluk; RQ ezmez');
    const card = readMobile('components/RitualCard.js');
    expect(card).toContain('pulse?.value');
  });

  test('memory copy: Söz/Yankı · Comment/Echo · no Say · Rulo/Roll', () => {
    expect(t('soz', 'tr')).toBe('Söz');
    expect(t('soz', 'en')).toBe('Comment');
    expect(t('yanki', 'en')).toBe('Echo');
    expect(t('rulo', 'tr')).toBe('Rulo');
    expect(t('rulo', 'en')).toBe('Roll');
    expect(t('soz', 'en')).not.toBe('Say');
    const row = readMobile('components/MemoryActionRow.js');
    expect(row).toContain('t(\'soz\'');
    expect(row).toContain('<Text style={styles.action}>▼</Text>');
  });

  test('string table shape {key, EN, TR, route?} · concepts untranslated · masa street-only', () => {
    for (const row of Object.values(STRING_TABLE)) {
      expect(row.key).toBeTruthy();
      expect(row.EN).toBeTruthy();
      expect(row.TR).toBeTruthy();
    }
    expect(STRING_TABLE.soz.route).toBe('MemoryDetail');
    expect(STRING_TABLE.ritual.translate).toBe(false);
    expect(t('ritual', 'tr')).toBe('Ritual');
    expect(STRING_TABLE.street_masa_tonight.TR).toMatch(/masan/);
    expect(STRING_TABLE.first_seal_opened.TR).toBe('Ritual açıldı');
    expect(STRING_TABLE.checkin_find_table.TR).not.toMatch(/masada/);
    expect(STRING_TABLE.share_window.TR).toBe('Window');
    expect(STRING_TABLE.forum_after_window.TR).toMatch(/Masa bitince/);
  });

  test('passport DS own-only · Friends Venue/Brand inner tabs', () => {
    const passport = readMobile('screens/SocialPassportScreen.js');
    expect(passport).toContain('{isOwnPassport ? (');
    expect(passport).toContain("navigate('DSUserDashboard')");
    expect(passport).toContain("initialLevelTab: 'venue'");
    expect(passport).toContain("initialLevelTab: 'brand'");
    const friends = readMobile('screens/FriendsListScreen.js');
    expect(friends).toContain("id: 'venue', label: 'Venue'");
    expect(friends).toContain("id: 'brand', label: 'Brand'");
    expect(friends).toContain('brandConnections');
  });

  test('slot silent match + uni profile no student ritual CRUD', () => {
    const slots = readSrc('services/venueSlotService.js');
    expect(slots).toContain('eşleştirme SESSİZ');
    expect(slots).toContain('isSlotVisibleToViewer');
    const uni = readSrc('services/universityProfileService.js');
    expect(uni).toContain('Öğrenci Ritualsine yetki YOK');
    expect(uni).toContain('transfer_admin_to');
    expect(uni).not.toMatch(/deleteRitual|moderateRitual/);
  });
});
