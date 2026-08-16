import { describe, test, expect } from '@jest/globals';
import LOCAL_CONFIG from '../config/localConfig.js';
import {
  DELETE_CONFIRM_PHRASE,
  FORMER_MEMBER_NAME,
  deleteOwnAccount,
} from '../services/accountDeletionService.js';
import {
  NOTIF_CATEGORY_COLUMNS,
  NOTIF_TYPE_CATEGORY,
} from '../services/notifications.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

describe('Sosyal Ürün Temelleri %100 gaps', () => {
  test('account deletion constants locked', () => {
    expect(DELETE_CONFIRM_PHRASE).toBe('SIL');
    expect(FORMER_MEMBER_NAME).toBe('Eski üye');
  });

  test('deleteOwnAccount rejects wrong confirm phrase', async () => {
    const r = await deleteOwnAccount({ userId: 'x', confirmPhrase: 'hayir' });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('CONFIRM_PHRASE_REQUIRED');
  });

  test('migration 120 registered', () => {
    const runner = readFileSync(join(root, 'scripts/run-migrations.js'), 'utf8');
    expect(runner).toContain('120_sosyal_pct100_gaps.sql');
    expect(
      readFileSync(join(root, 'src/migrations/120_sosyal_pct100_gaps.sql'), 'utf8')
    ).toContain('notify_cat_ritual_door');
  });

  test('6 notification categories mapped', () => {
    expect(Object.keys(NOTIF_CATEGORY_COLUMNS)).toEqual([
      'ritual_door',
      'mention_soz',
      'friendship',
      'series_venue',
      'consent_safety',
      'product_digest',
    ]);
    expect(NOTIF_TYPE_CATEGORY.mention).toBe('mention_soz');
    expect(NOTIF_TYPE_CATEGORY.checkin_open).toBe('ritual_door');
    expect(NOTIF_TYPE_CATEGORY.weekly_digest).toBe('product_digest');
    expect(NOTIF_TYPE_CATEGORY.penalty_warning).toBe('consent_safety');
  });

  test('messaging reactions + edit window still CORE', () => {
    expect(LOCAL_CONFIG.messaging.EDIT_WINDOW_MIN).toBe(5);
    expect(LOCAL_CONFIG.messaging.REACTIONS).toHaveLength(6);
  });

  test('mobile MemoryActionRow hides downvote count (v3 §15)', () => {
    const src = readFileSync(
      join(root, '../mobile/src/components/MemoryActionRow.js'),
      'utf8'
    );
    expect(src).toMatch(/▼<\/Text>|▼`/);
    expect(src).not.toContain('▼ {Number(downvotes)');
  });

  test('users API exposes delete account route', () => {
    const src = readFileSync(join(root, 'src/api/users.js'), 'utf8');
    expect(src).toContain("router.delete('/:id/account'");
    expect(src).toContain('cat_ritual_door');
    expect(src).toContain('deleteOwnAccount');
  });

  test('privacy screen wires Hesabi Sil', () => {
    const src = readFileSync(
      join(root, '../mobile/src/screens/PrivacySettingsScreen.js'),
      'utf8'
    );
    expect(src).toContain('handleDeleteAccount');
    expect(src).toContain('deleteOwnAccount');
  });
});
