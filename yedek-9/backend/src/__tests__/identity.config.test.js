/**
 * LOCAL Build Doc §1 — identity gate + KYC stub provider
 */
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import LOCAL_CONFIG from '../config/localConfig.js';
import { getActiveKycProvider } from '../services/kycProvider.js';
import {
  isIdentityGateSatisfied,
  resolveIdentityTrack,
  shouldShowUniLabel,
  publicUniversityField,
} from '../utils/identityPresentation.js';
import {
  getIdentityAcceptance,
  IDENTITY_GATED_WRITES,
  IDENTITY_IRON_RULES,
} from '../services/identityAcceptance.js';
import { getNameChangeDays, getUsernameChangeDays } from '../services/identityNamePolicy.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('identity config (§1)', () => {
  test('ACTIVE_PROVIDER stub · gallery kapalı · NFC primary · ≤60s', () => {
    expect(LOCAL_CONFIG.identity.ACTIVE_PROVIDER).toBe('stub');
    expect(LOCAL_CONFIG.identity.PROVIDERS).toEqual(['stub', 'techsign', 'ihs']);
    expect(LOCAL_CONFIG.identity.TARGET_S).toBe(60);
    expect(LOCAL_CONFIG.identity.GALLERY_UPLOAD_ALLOWED).toBe(false);
    expect(LOCAL_CONFIG.identity.NFC_PRIMARY).toBe(true);
    expect(LOCAL_CONFIG.identity.FALLBACK_PATH).toBe('card_photo_selfie');
    expect(LOCAL_CONFIG.identity.DOCUMENTS).toEqual(['TCKK', 'PASSPORT', 'EU_ID']);
    expect(LOCAL_CONFIG.identity.LIVENESS_PASSIVE_S).toBe(3);
    expect(LOCAL_CONFIG.identity.USERNAME_CHANGE_D).toBe(90);
    expect(LOCAL_CONFIG.identity.NAME_CHANGE_D).toBe(90);
  });

  test('open.kyc_provider_contract documents stub status', () => {
    const c = LOCAL_CONFIG.open.kyc_provider_contract;
    expect(c).toBeTruthy();
    expect(c.status).toBe('pass_stub_launch');
    expect(c.active).toBe('stub');
    expect(c.launch_accepted).toBe(true);
    expect(c.treat_as_complete).toBe(true);
    expect(c.still_open).toBe(true);
    expect(c.launch_unblocks).toBe(true);
    expect(c.phase2_code_ready).toBe(true);
    expect(c.candidates).toEqual(['techsign', 'ihs']);
    expect(Array.isArray(c.phase2_checklist)).toBe(true);
    expect(c.phase2_checklist.length).toBeGreaterThanOrEqual(4);
  });
});

describe('identity stub acceptance', () => {
  test('acceptance snapshot PASS_STUB · live adapter ready', () => {
    const a = getIdentityAcceptance();
    expect(a.launch_status).toBe('PASS_STUB');
    expect(a.active_provider).toBe('stub');
    expect(a.gallery_upload_allowed).toBe(false);
    expect(a.nfc_primary).toBe(true);
    expect(a.username_change_d).toBe(90);
    expect(a.name_change_d).toBe(90);
    expect(a.iron_rules).toEqual(IDENTITY_IRON_RULES);
    expect(a.iron_rules.stub_accepted_for_launch).toBe(true);
    expect(a.iron_rules.live_provider_status).toBe('HTTP_ADAPTER_READY');
    expect(a.iron_rules.pii_retained).toBe(false);
    expect(a.open_kyc.launch_accepted).toBe(true);
    expect(a.open_kyc.treat_as_complete).toBe(true);
    expect(a.open_kyc.still_open).toBe(true);
    expect(a.open_kyc.launch_unblocks).toBe(true);
    expect(a.open_kyc.phase2_code_ready).toBe(true);
    expect(a.open_kyc.phase2_checklist.length).toBeGreaterThanOrEqual(4);
    expect(a.live_readiness.live_mode).toBe(false);
    expect(IDENTITY_GATED_WRITES.length).toBeGreaterThanOrEqual(6);
  });

  test('critical write routes mount requireIdentityVerified', () => {
    const files = [
      join(__dirname, '../api/rituals.js'),
      join(__dirname, '../api/attendance.js'),
      join(__dirname, '../api/memories.js'),
      join(__dirname, '../api/feedback.js'),
    ];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      expect(src).toMatch(/requireIdentityVerified/);
    }
  });

  test('KYC complete sets name_locked', () => {
    const src = readFileSync(join(__dirname, '../services/identityService.js'), 'utf8');
    expect(src).toMatch(/name_locked = true/);
  });

  test('GET /identity/acceptance exists', () => {
    const src = readFileSync(join(__dirname, '../api/identity.js'), 'utf8');
    expect(src).toMatch(/\/acceptance/);
    expect(src).toMatch(/getIdentityAcceptance/);
    expect(src).toMatch(/kyc-webhook/);
    expect(src).toMatch(/live-readiness/);
  });

  test('name policy days from config', () => {
    expect(getNameChangeDays()).toBe(90);
    expect(getUsernameChangeDays()).toBe(90);
  });
});

describe('identityPresentation', () => {
  test('gate: Track A or Track B', () => {
    expect(isIdentityGateSatisfied({ email_verified: true })).toBe(true);
    expect(isIdentityGateSatisfied({ identity_verified: true })).toBe(true);
    expect(isIdentityGateSatisfied({})).toBe(false);
  });

  test('Track B never shows uni label', () => {
    const u = {
      identity_track: 'identity',
      identity_verified: true,
      university: 'Bogazici',
    };
    expect(resolveIdentityTrack(u)).toBe('identity');
    expect(shouldShowUniLabel(u)).toBe(false);
    expect(publicUniversityField(u)).toBeNull();
  });

  test('Track A shows uni when visible', () => {
    const u = {
      identity_track: 'university',
      email_verified: true,
      university: 'Bogazici',
      uni_label_visible: true,
    };
    expect(shouldShowUniLabel(u)).toBe(true);
    expect(publicUniversityField(u)).toBe('Bogazici');
  });
});

describe('kycProvider stub', () => {
  test('startSession: gallery false · nfc primary · no user-facing stub banner', async () => {
    const p = getActiveKycProvider();
    expect(p.id).toBe('stub');
    const s = await p.startSession({ userId: 'u1', documentType: 'TCKK' });
    expect(s.gallery_upload_allowed).toBe(false);
    expect(s.nfc_required).toBe(true);
    expect(s.paths.primary).toBe('nfc');
    expect(s.paths.fallback).toBe('card_photo_selfie');
    expect(s.stub).toBe(true);
    expect(s.show_provider_banner).toBe(false);
    expect(s.launch_path).toBe('PASS_STUB');
  });

  test('completeSession: durable hash · pii_retained false', async () => {
    const p = getActiveKycProvider();
    const ok = await p.completeSession({
      sessionId: 's1',
      documentType: 'TCKK',
      documentNumberHint: 'TCKK:A1234567',
      livenessOk: true,
      faceMatchOk: true,
      ageYears: 22,
      path: 'nfc',
    });
    expect(ok.ok).toBe(true);
    expect(ok.age_ok).toBe(true);
    expect(ok.identity_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(ok.pii_retained).toBe(false);

    const fail = await p.completeSession({
      sessionId: 's2',
      documentNumberHint: 'x',
      livenessOk: true,
      faceMatchOk: true,
    });
    expect(fail.ok).toBe(false);
    expect(fail.error_code).toBe('DURABLE_IDENTITY_REQUIRED');
  });

  test('completeSession rejects raw media blobs', async () => {
    const { looksLikeRawMediaBlob, getActiveKycProvider: getP } = await import(
      '../services/kycProvider.js'
    );
    expect(looksLikeRawMediaBlob('data:image/png;base64,AAAA')).toBe(true);
    const p = getP();
    const r = await p.completeSession({
      sessionId: 's3',
      documentNumberHint: 'data:image/jpeg;base64,' + 'x'.repeat(80),
      livenessOk: true,
      faceMatchOk: true,
    });
    expect(r.ok).toBe(false);
    expect(r.error_code).toBe('PII_MEDIA_REJECTED');
    expect(r.pii_retained).toBe(false);
  });
});
