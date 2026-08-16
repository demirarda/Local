/**
 * LOCAL_Sistem_Anayasasi.md — yapısal %100 kapanış
 * Ops tavanı (KYC/CSAM/Stripe keys) kod boşluğu sayılmaz.
 */
import { describe, test, expect } from '@jest/globals';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import LOCAL_CONFIG, { blendIqFromRaw } from '../config/localConfig.js';
import { getPublicConfig } from '../services/publicConfigService.js';
import { getIdentityAcceptance } from '../services/identityAcceptance.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const services = join(__dirname, '../services');

const PILLAR_SERVICES = [
  'rsEngine.js',
  'dsEngine.js',
  'firstSealService.js',
  'checkinService.js',
  'penaltyService.js',
  'modEngine.js',
  'venueTrustAuraService.js',
  'regularService.js',
  'nightReportService.js',
  'eventGroupService.js',
  'underMinGate.js',
  'birthCancelService.js',
  'waveBSocial.js',
  'webShowcase.js',
];

describe('Sistem Anayasası pct100', () => {
  test('open.anayasa_* structural 100 lock', () => {
    expect(LOCAL_CONFIG.open.anayasa_product_complete).toBe(true);
    expect(LOCAL_CONFIG.open.anayasa_structural_pct).toBe(100);
    expect(LOCAL_CONFIG.open.anayasa_locked_at).toBeTruthy();
    expect(LOCAL_CONFIG.open.packages_product_complete).toBe(true);
    expect(LOCAL_CONFIG.open.anayasa_ops_ceiling).toEqual([
      'kyc_live_keys',
      'csam_live_provider',
      'stripe_live_keys',
    ]);
  });

  test('§1 RS weights + asymmetry + caps', () => {
    const rs = LOCAL_CONFIG.rs;
    expect(rs.INIT).toBe(5);
    expect(rs.K_UP).toBe(0.15);
    expect(rs.K_DOWN).toBe(0.3);
    expect(rs.CAP_POS).toBe(0.12);
    expect(rs.CAP_NEG).toBe(0.15);
    expect(rs.BYPASS_CAP_NEG).toBe(0.2);
    expect(rs.W_A).toBe(0.25);
    expect(rs.W_IQ).toBe(0.3);
    expect(rs.W_CF).toBe(0.15);
    expect(rs.W_MB).toBe(0.05);
    expect(rs.W_IF).toBe(0.2);
    expect(rs.CF_PEER).toBe(0.65);
    expect(rs.CF_SELF).toBe(0.35);
    expect(rs.IF_LATE_SLICE).toBe(0.25);
    expect(rs.IF_FEEDBACK_MISSING).toBe(0.3);
    expect(rs.BR_UPPER).toBe(8);
    expect(rs.BR_LOWER).toBe(3);
    expect(rs.BC.POS_AMP).toBe(1.25);
    expect(rs.BC.NEG_DAMP).toBe(0.7);
    expect(rs.BC.NEG_AMP).toBe(1.35);
  });

  test('A2 CONF / IQ blend n=1 ×0.40 · n=2 ×0.75', () => {
    expect(LOCAL_CONFIG.rs.IQ_BLEND_N1_NEUTRAL).toBe(0.6);
    expect(LOCAL_CONFIG.rs.IQ_BLEND_N1_RAW).toBe(0.4);
    expect(LOCAL_CONFIG.rs.IQ_BLEND_N2_NEUTRAL).toBe(0.25);
    expect(LOCAL_CONFIG.rs.IQ_BLEND_N2_RAW).toBe(0.75);
    expect(blendIqFromRaw(1, 1, 1)).toBeCloseTo(0.6 * 0.5 + 0.4 * 1, 5);
    expect(blendIqFromRaw(1, 2, 1)).toBeCloseTo(0.75 * 1 + 0.25 * 0.5, 5);
    expect(blendIqFromRaw(0.8, 3, 1)).toBeCloseTo(0.8, 5);
  });

  test('§2 check-in · §3 kilit · §7 no-show', () => {
    expect(LOCAL_CONFIG.keyword.CHECKIN_EARLY_OPEN_MIN).toBe(15);
    expect(LOCAL_CONFIG.checkin.KAPI_PCT).toBe(0.2);
    expect(LOCAL_CONFIG.ritual.CANCEL_FREE_THRESHOLD_PCT).toBe(0.25);
    expect(LOCAL_CONFIG.ritual.GRACE_MINUTES).toBe(10);
    expect(LOCAL_CONFIG.ritual.DURATION_MIN_MINUTES).toBe(30);
    expect(LOCAL_CONFIG.penalties.NOSHOW_RS).toEqual([0.08, 0.15, 0.2]);
    expect(LOCAL_CONFIG.penalties.LATE_CANCEL_RS[1]).toBe(0.06);
    expect(LOCAL_CONFIG.penalties.LATE_CANCEL_RS[3]).toBe(0.15);
  });

  test('§5 FL · §6 DS · §8 no-peer · §11 Regular', () => {
    expect(LOCAL_CONFIG.fl.FB_WEIGHTS).toEqual([1.0, 0.5, 0.0]);
    expect(LOCAL_CONFIG.ds.ALPHA).toBe(0.3);
    expect(LOCAL_CONFIG.ds.FL_W[3]).toBe(0.2);
    expect(LOCAL_CONFIG.rs.no_peer.NO_PEER_DAMPENER).toBe(0.35);
    expect(LOCAL_CONFIG.rs.no_peer.NO_PEER_CEILING).toBe(7.5);
    expect(LOCAL_CONFIG.regular.PARKED).toBe(false);
    expect(LOCAL_CONFIG.regular.N).toBe(4);
    expect(LOCAL_CONFIG.regular.WINDOW_D).toBe(45);
  });

  test('§9 MOD · §10 venue · §12 SPARK park · §13 paket', () => {
    expect(LOCAL_CONFIG.mod.L3_RS_BASE).toBe(-0.15);
    expect(LOCAL_CONFIG.mod.L3_RS_MAX).toBe(-0.3);
    expect(LOCAL_CONFIG.venue.MIN_DISPLAY_N).toBe(5);
    expect(LOCAL_CONFIG.zone.SPARK_ENABLED).toBe(false);
    expect(LOCAL_CONFIG.venue.PACKAGES_STUB.PRICE_OP).toBe(7900);
    expect(LOCAL_CONFIG.venue.PACKAGES_STUB.PRICE_HAKIM).toBe(19900);
    expect(LOCAL_CONFIG.venue.PACKAGES_STUB.OP_SLOTS).toBe(3);
    expect(LOCAL_CONFIG.venue.PACKAGES_STUB.HAKIM_SLOTS).toBe(5);
  });

  test('§13.5 kimlik + CSAM ürün tamam (ops tavanı ayrı)', () => {
    expect(LOCAL_CONFIG.open.kyc_provider_contract.treat_as_complete).toBe(true);
    expect(LOCAL_CONFIG.open.kyc_provider_contract.launch_accepted).toBe(true);
    expect(LOCAL_CONFIG.open.csam_product_complete).toBe(true);
    expect(LOCAL_CONFIG.open.csam_hold_enforced).toBe(true);
    const a = getIdentityAcceptance();
    expect(a.launch_status).toMatch(/^PASS_/);
    expect(a.open_kyc.treat_as_complete).toBe(true);
  });

  test('E3 privacy · web-vitrin · witness LEGACY', () => {
    expect(LOCAL_CONFIG.account_privacy.DEFAULT).toBe('OPEN');
    expect(LOCAL_CONFIG.account_privacy.CLOSED_LW_EXCEPTION).toBe(true);
    expect(LOCAL_CONFIG.stubs.WEB_SHOWCASE_ENABLED).toBe(false);
    expect(LOCAL_CONFIG.witness.ACTIVE_SCHEME).toBe('LEGACY_2_TIER');
    expect(LOCAL_CONFIG.witness.FUTURE_3_TIER_ENABLED).toBe(false);
    expect(LOCAL_CONFIG.rs.visibility.DEFAULT_PUBLIC).toBe(false);
    expect(LOCAL_CONFIG.rs.visibility.MIN_RITUALS_FOR_RING).toBe(10);
  });

  test('pillar services exist', () => {
    for (const name of PILLAR_SERVICES) {
      const path =
        name === 'webShowcase.js'
          ? join(__dirname, '../api/webShowcase.js')
          : join(services, name);
      expect(existsSync(path)).toBe(true);
    }
  });

  test('publicConfig exposes anayasa 100', () => {
    const cfg = getPublicConfig();
    expect(cfg.anayasa.product_complete).toBe(true);
    expect(cfg.anayasa.structural_pct).toBe(100);
    expect(cfg.anayasa.packages_product_complete).toBe(true);
    expect(cfg.anayasa.ops_ceiling).toHaveLength(3);
  });
});
