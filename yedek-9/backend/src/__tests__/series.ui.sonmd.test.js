import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { timeTypeBadgeTr } from '../services/seriesService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../../..');

function readMobile(rel) {
  return readFileSync(join(root, 'mobile/src', rel), 'utf8');
}

describe('§7 UI adı Seri — recurring kullanıcıya görünmez', () => {
  test('timeTypeBadgeTr maps recurring/series → Seri', () => {
    expect(timeTypeBadgeTr('recurring')).toBe('Seri');
    expect(timeTypeBadgeTr('series')).toBe('Seri');
    expect(timeTypeBadgeTr('instant', { sparkBorn: true })).toBe('Anlık');
    expect(timeTypeBadgeTr('fixed')).toBe('Planlı');
  });

  test('Pulse chip / filtre / kart Seri; Tekrarlanan yok', () => {
    const tags = readMobile('constants/pulseSocialTags.js');
    expect(tags).toMatch(/RECURRING:\s*'SERİ'/);
    expect(tags).not.toMatch(/TEKRARLANAN/);

    const pulse = readMobile('screens/PulseScreen.js');
    expect(pulse).toContain("'Seri'");
    expect(pulse).not.toMatch(/Tekrarlanan/);

    const week = readMobile('components/PulseThisWeekExactContent.js');
    expect(week).toContain('Bu Hafta Seri');
    expect(week).not.toMatch(/Duzenli Rituals|Tekrarlanan/);

    const rec = readMobile('components/PulseRecurringExactContent.js');
    expect(rec).not.toMatch(/Tekrarlanan/);

    const morning = readMobile('components/PulseMorningExactContent.js');
    expect(morning).not.toMatch(/tekrarlanan/i);
  });

  test('CreateRitual + notif copy uses Seri, not Tekrarlayan', () => {
    const create = readMobile('screens/CreateRitualScreen.js');
    expect(create).toContain("label: 'Seri'");
    expect(create).not.toMatch(/Tekrarlayan/);

    const notif = readFileSync(join(__dirname, '../services/notifications.js'), 'utf8');
    expect(notif).toMatch(/notifyRecurringInstance[\s\S]*'Seri'/);
    expect(notif).not.toMatch(/Tekrarlayan Ritual/);
  });
});
