import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  commitmentCountsTowardDailyCap,
  dailyCommitBucket,
} from '../services/ritualState.js';
import { getCheckinWindowInfo, getDoorCloseTime } from '../services/checkinService.js';
import LOCAL_CONFIG, { resolveCheckinRadiusMeters } from '../config/localConfig.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

describe('check-in sonMD %100 gaps', () => {
  test('K3: Instant / ≤30dk join does not count toward daily commit cap', () => {
    const now = new Date('2026-08-12T12:00:00Z');
    expect(
      commitmentCountsTowardDailyCap(
        { start_time: '2026-08-12T12:20:00Z', time_type: 'planned' },
        now
      )
    ).toBe(false);
    expect(
      commitmentCountsTowardDailyCap(
        { start_time: '2026-08-12T12:30:00Z', time_type: 'instant' },
        now
      )
    ).toBe(false);
    expect(
      commitmentCountsTowardDailyCap(
        { start_time: '2026-08-13T18:00:00Z', time_type: 'planned' },
        now
      )
    ).toBe(true);
  });

  test('K3: Series future instance counts toward daily cap', () => {
    const now = new Date('2026-08-12T12:00:00Z');
    expect(
      commitmentCountsTowardDailyCap(
        {
          start_time: '2026-08-13T18:00:00Z',
          time_type: 'planned',
          series_id: 'series-1',
        },
        now
      )
    ).toBe(true);
  });

  test('K3: 90dk planned join counts; Instant-kurma host does not', () => {
    const now = new Date('2026-08-12T12:00:00Z');
    const in90 = { start_time: '2026-08-12T13:30:00Z', time_type: 'planned' };
    expect(commitmentCountsTowardDailyCap(in90, now)).toBe(true);
    expect(commitmentCountsTowardDailyCap(in90, now, { role: 'host' })).toBe(false);
    expect(
      commitmentCountsTowardDailyCap(
        { start_time: '2026-08-12T13:30:00Z', time_type: 'instant' },
        now,
        { role: 'host' }
      )
    ).toBe(false);
    expect(
      commitmentCountsTowardDailyCap(
        { start_time: '2026-08-13T18:00:00Z', time_type: 'planned' },
        now,
        { role: 'host' }
      )
    ).toBe(true);
  });

  test('K3 event=1 shares a daily commit bucket', () => {
    expect(dailyCommitBucket({ id: 'a', event_group_id: 'eg1' })).toBe('eg:eg1');
    expect(dailyCommitBucket({ id: 'b', event_group_id: 'eg1' })).toBe(
      dailyCommitBucket({ id: 'a', event_group_id: 'eg1' })
    );
    expect(dailyCommitBucket({ id: 'solo' })).toBe('r:solo');
  });

  test('scheduled/ferry door uses min(formula, departure+pad)', () => {
    const start = new Date('2026-08-12T12:00:00Z');
    const ritual = {
      start_time: start,
      duration: 120,
      departure_at: '2026-08-12T12:05:00Z',
    };
    const close = getDoorCloseTime(ritual);
    const pad = Number(LOCAL_CONFIG.checkin.DEPARTURE_GATE_PAD_MIN || 5);
    expect(close.toISOString()).toBe(
      new Date(new Date(ritual.departure_at).getTime() + pad * 60000).toISOString()
    );
  });

  test('table open via first_sealed_at without keyword = code banned', () => {
    const info = getCheckinWindowInfo({
      start_time: new Date(Date.now() - 60000).toISOString(),
      duration: 60,
      first_sealed_at: new Date().toISOString(),
      checkin_keyword: null,
    });
    expect(info.table_open).toBe(true);
    expect(info.code_banned).toBe(true);
    expect(info.code_entry_active).toBe(false);
  });

  test('pivot checklist is present in config', () => {
    expect(Array.isArray(LOCAL_CONFIG.checkinPivotChecklist)).toBe(true);
    expect(LOCAL_CONFIG.checkinPivotChecklist.length).toBeGreaterThanOrEqual(10);
  });

  test('T2 integrity defaults to PENDING (not hard block)', () => {
    expect(LOCAL_CONFIG.checkin.INTEGRITY.BLOCK_ON_PLAY_INTEGRITY_FAIL).toBe(false);
    expect(LOCAL_CONFIG.checkin.INTEGRITY.BLOCK_ON_APP_ATTEST_FAIL).toBe(false);
    expect(Number(LOCAL_CONFIG.checkin.INTEGRITY.IMPOSSIBLE_SPEED_BLOCK_KMH || 0)).toBe(0);
  });

  test('T3 pending is opt-in (default false) — MOD correlation stays', () => {
    expect(LOCAL_CONFIG.checkin.T3_PENDING_ENABLED).toBe(false);
    expect(LOCAL_CONFIG.checkin.GPS_EDGE.MIN_HITS).toBeGreaterThan(0);
  });

  test('C5 totem broken fallback to code enabled', () => {
    expect(LOCAL_CONFIG.checkin.TOTEM_BROKEN_FALLBACK_TO_CODE).toBe(true);
  });

  test('digital relay ban + LOCAL-TAG proximity + fast-entry heuristic', () => {
    expect(LOCAL_CONFIG.relayBan.REJECT_DIGITAL_PASTE).toBe(true);
    expect(LOCAL_CONFIG.relayBan.TAG_REQUIRES_PROXIMITY).toBe(true);
    expect(Number(LOCAL_CONFIG.tag.PHYSICAL_RELAY_RADIUS_M)).toBeGreaterThan(0);
    expect(Number(LOCAL_CONFIG.relayBan.FAST_ENTRY_MS)).toBeGreaterThan(0);
  });

  test('funnel service exposes pending region map + T1/T2', () => {
    const src = readFileSync(join(root, 'services/checkinFunnelService.js'), 'utf8');
    expect(src).toContain('getPendingRegionMap');
    expect(src).toContain('pending_by_region');
    expect(src).toContain('t1_t2');
    expect(src).toContain('t1_gps_fail');
  });

  test('checkinService T3 gated + fast entry relay + city meta', () => {
    const src = readFileSync(join(root, 'services/checkinService.js'), 'utf8');
    expect(src).toContain('T3_PENDING_ENABLED');
    expect(src).toContain('fastEntrySuspect');
    expect(src).toContain('FAST_ENTRY_MS');
    expect(src).toContain('t3_edge');
    expect(src).toContain('city_id');
    expect(src).toContain("reasons.push('root')");
  });

  test('eventSubSeal marks corner opener', () => {
    const src = readFileSync(join(root, 'services/eventSubSealService.js'), 'utf8');
    expect(src).toContain('corner_opener');
    expect(src).toContain('Bu köşeyi sen açıyorsun');
  });

  test('window hours NULL fallback is 12 not 3', () => {
    expect(LOCAL_CONFIG.ritual.WINDOW_HOURS_DEFAULT).toBe(12);
    const ritualState = readFileSync(join(root, 'services/ritualState.js'), 'utf8');
    const completion = readFileSync(join(root, 'services/ritualCompletion.js'), 'utf8');
    const indexSrc = readFileSync(join(root, 'index.js'), 'utf8');
    expect(ritualState).not.toMatch(/COALESCE\(r\.live_window_hours,\s*3\)/);
    expect(completion).not.toMatch(/COALESCE\(r\.live_window_hours,\s*3\)/);
    expect(indexSrc).not.toMatch(/COALESCE\(live_window_hours,\s*3\)/);
    expect(indexSrc).toContain('defaultLiveWindowHours');
  });

  test('venues API: anon_sealed_count + totem-request', () => {
    const src = readFileSync(join(root, 'api/venues.js'), 'utf8');
    expect(src).toContain('anon_sealed_count');
    expect(src).toContain('totem-request');
    expect(src).toContain('totem_request');
  });

  test('yalancı-tanık deseni MOD sicili (C4)', () => {
    expect(LOCAL_CONFIG.witness.FALSE_WITNESS.MIN_SUSPECT_SUBJECTS).toBe(3);
    const modSrc = readFileSync(join(root, 'services/modEngine.js'), 'utf8');
    const sealSrc = readFileSync(join(root, 'services/firstSealService.js'), 'utf8');
    const funnelSrc = readFileSync(join(root, 'services/checkinFunnelService.js'), 'utf8');
    expect(modSrc).toContain("category_key = 'false_witness'");
    expect(modSrc).toContain('evaluateFalseWitnessPattern');
    expect(modSrc).toContain('maybeEnqueueFalseWitnessReview');
    expect(modSrc).toContain('false_witness_pattern');
    expect(modSrc).toContain('auto_apply: false');
    expect(sealSrc).toContain('maybeEnqueueFalseWitnessReview');
    expect(funnelSrc).toContain('false_witness_flag');
  });
});

describe('check-in sonMD %100 mobile surfaces', () => {
  const mobileRoot = join(__dirname, '../../../mobile/src');

  test('RitualDetail uses getCheckinWindowInfo for start−15 CTA', () => {
    const src = readFileSync(join(mobileRoot, 'screens/RitualDetailScreen.js'), 'utf8');
    expect(src).toContain('getCheckinWindowInfo');
    expect(src).toContain('doorInfo.door_open');
  });

  test('RitualCheckIn culture copy + equal paths', () => {
    const src = readFileSync(join(mobileRoot, 'screens/RitualCheckInScreen.js'), 'utf8');
    expect(src).toContain('kodu sormak selam vermektir');
    expect(src).toContain('culturePath');
    expect(src).toContain('LOCAL-TAG');
    expect(src).toContain('instantStrip');
    expect(src).toContain('entry_ms');
    expect(src).toContain('digitalPaste');
  });

  test('LiveRitualHostAnnouncements has no onClaimEscrow', () => {
    const src = readFileSync(
      join(mobileRoot, 'components/LiveRitualHostAnnouncements.js'),
      'utf8'
    );
    expect(src).not.toContain('onClaimEscrow');
    expect(src).toContain('kodu sormak selam vermektir');
  });

  test('LiveRitualParticipants opener badge', () => {
    const src = readFileSync(join(mobileRoot, 'components/LiveRitualParticipants.js'), 'utf8');
    expect(src).toContain('Masayi acti');
    expect(src).toContain('is_opener');
    expect(src).not.toContain('isSealed || item.is_host');
  });

  test('RitualDetail host has no check-in skip', () => {
    const src = readFileSync(join(mobileRoot, 'screens/RitualDetailScreen.js'), 'utf8');
    expect(src).toContain('host da mühürler');
    expect(src).not.toContain('!viewerCheckedIn && !isHost');
    expect(src).not.toContain('viewerCheckedIn || isHost');
  });

  test('§2 kapı UI: kullanıcıya %/formül yok — kilit saati', () => {
    const src = readFileSync(join(mobileRoot, 'screens/RitualDetailScreen.js'), 'utf8');
    expect(src).not.toMatch(/%25/);
    expect(src).toContain('lock_moment_at');
    expect(src).toContain('Kilit anından');
  });

  test('RitualCheckIn first-seal copy + LOCAL-TAG QR + T2 flags', () => {
    const src = readFileSync(join(mobileRoot, 'screens/RitualCheckInScreen.js'), 'utf8');
    expect(src).toContain('MASAYI SEN AÇIYORSUN');
    expect(src).toContain('LocalTagQr');
    expect(src).toContain('buildCheckinIntegrity');
    expect(src).toContain('play_integrity');
    expect(src).toContain('app_attest');
    expect(src).toContain("t('checkin_find_table'");
    expect(src).not.toMatch(/su an \$\{tableCount\} kisi masada/);
  });

  test('§2 host_broadcast aliases host_announcement', () => {
    const src = readFileSync(join(root, 'api/chat.js'), 'utf8');
    expect(src).toContain("message_type === 'host_broadcast'");
    expect(src).toContain("message_type = 'host_announcement'");
    expect(src).toContain('CHAT_LOCKED_UNTIL_LOCK');
  });

  test('LiveRitual gates host without seal', () => {
    const src = readFileSync(join(mobileRoot, 'screens/LiveRitualScreen.js'), 'utf8');
    expect(src).not.toMatch(/if \(isHost\) return;/);
  });

  test('VenueManager unanswered + totem talebi + isimsiz mühür', () => {
    const src = readFileSync(join(mobileRoot, 'screens/VenueManagerScreen.js'), 'utf8');
    expect(src).toContain('unansweredCount');
    expect(src).toContain('requestVenueTotem');
    expect(src).toContain('isimsiz mühür');
  });
});

describe('check-in sonMD §4 lokasyon %100', () => {
  test('migration 121 registers is_home + route_id', () => {
    const runner = readFileSync(join(root, '../scripts/run-migrations.js'), 'utf8');
    expect(runner).toContain('121_lokasyon_pct100.sql');
    const sql = readFileSync(join(root, 'migrations/121_lokasyon_pct100.sql'), 'utf8');
    expect(sql).toContain('is_home');
    expect(sql).toContain('route_id');
  });

  test('tarifeli one-shot + hat Aura', () => {
    const createSrc = readFileSync(join(root, 'api/rituals.js'), 'utf8');
    const seriesSrc = readFileSync(join(root, 'services/seriesService.js'), 'utf8');
    const zoneSrc = readFileSync(join(root, 'services/zoneService.js'), 'utf8');
    const valSrc = readFileSync(join(root, 'services/ritualCreateValidation.js'), 'utf8');
    expect(valSrc).toContain('ROUTE_ONE_SHOT');
    expect(createSrc).toContain('assertScheduledOneShot');
    expect(createSrc).toContain('getOrCreateLineZone');
    expect(seriesSrc).toContain('ROUTE_ONE_SHOT');
    expect(zoneSrc).toContain('getOrCreateLineZone');
    expect(zoneSrc).toContain("'p2r','p2v','p2z','rq'");
  });

  test('home empty door collapses without host penalty', () => {
    const checkinSrc = readFileSync(join(root, 'services/checkinService.js'), 'utf8');
    const penaltySrc = readFileSync(join(root, 'services/penaltyService.js'), 'utf8');
    expect(checkinSrc).toContain('collapseHomeEmptyDoor');
    expect(checkinSrc).toContain('is_home');
    expect(penaltySrc).toContain('home_empty_door');
    const homeFn = penaltySrc.slice(
      penaltySrc.indexOf('export async function collapseHomeEmptyDoor'),
      penaltySrc.indexOf('export async function recordHostNoShowSignal')
    );
    expect(homeFn).toContain('home_empty_door');
    expect(homeFn).not.toContain('rs-bypass');
  });

  test('masa totem Operator+ / event-set gate', () => {
    const venuesSrc = readFileSync(join(root, 'api/venues.js'), 'utf8');
    const pkgSrc = readFileSync(join(root, 'services/venuePackageService.js'), 'utf8');
    const cfgSrc = readFileSync(join(root, 'config/localConfig.js'), 'utf8');
    expect(cfgSrc).toContain("'masa_totem'");
    expect(pkgSrc).toContain('assertCanAddTableTotem');
    expect(pkgSrc).toContain('TABLE_TOTEM_OPERATOR_REQUIRED');
    expect(venuesSrc).toContain('assertCanAddTableTotem');
    expect(venuesSrc).toContain('can_add_table_totem');
  });

  test('mobile: ev toggle + scheduled one-shot + masa lock copy', () => {
    const mobileRoot = join(__dirname, '../../../mobile/src');
    const createSrc = readFileSync(join(mobileRoot, 'screens/CreateRitualScreen.js'), 'utf8');
    const portalSrc = readFileSync(join(mobileRoot, 'screens/VenuePortalsScreen.js'), 'utf8');
    expect(createSrc).toContain('is_home');
    expect(createSrc).toContain('route_id');
    expect(createSrc).toContain('Rota tek seferdir');
    expect(portalSrc).toContain('Operatör+ veya event-set');
  });
});

describe('check-in sonMD §5 K-seti %100', () => {
  test('create/publish host commit + waitlist/replacement K1', () => {
    const ritualsSrc = readFileSync(join(root, 'api/rituals.js'), 'utf8');
    const waitSrc = readFileSync(join(root, 'services/waitlistService.js'), 'utf8');
    const penaltySrc = readFileSync(join(root, 'services/penaltyService.js'), 'utf8');
    const stateSrc = readFileSync(join(root, 'services/ritualState.js'), 'utf8');
    expect(stateSrc).toContain('assertCanHostCommit');
    expect(stateSrc).toContain('listDailyCommitBuckets');
    expect(ritualsSrc).toContain('assertCanHostCommit');
    expect(waitSrc).toContain('assertCanJoinRitualConstraints');
    expect(penaltySrc).toContain('assertCanJoinRitualConstraints');
  });

  test('K4 daily leave files daily_leave_pattern without auto_apply', () => {
    const attSrc = readFileSync(join(root, 'api/attendance.js'), 'utf8');
    const modSrc = readFileSync(join(root, 'services/modEngine.js'), 'utf8');
    expect(LOCAL_CONFIG.modSignals.DAILY_LEAVE_MOD_SIGNAL).toBe(6);
    expect(attSrc).toContain('maybeEnqueueDailyLeaveReview');
    expect(attSrc).not.toContain('maybeEnqueueSilentExitReview');
    expect(modSrc).toContain("category_key = 'daily_leave_pattern'");
    const fn = modSrc.slice(
      modSrc.indexOf('export async function maybeEnqueueDailyLeaveReview'),
      modSrc.indexOf('export function falseWitnessPatternHit')
    );
    expect(fn).toContain('auto_apply: false');
    expect(fn).not.toContain('rs-bypass');
  });

  test('§7 Regular decay uses DECAY_D not WINDOW_D', () => {
    const src = readFileSync(join(root, 'services/regularService.js'), 'utf8');
    expect(src).toContain('computeIsRegular');
    expect(src).toContain('DECAY_D');
    expect(LOCAL_CONFIG.regular.DECAY_D).toBe(60);
  });

  test('§7 P2H not asked in opener ritual', () => {
    const mobileRoot = join(__dirname, '../../../mobile/src');
    const fbSrc = readFileSync(join(root, 'api/feedback.js'), 'utf8');
    const uiSrc = readFileSync(join(mobileRoot, 'screens/RitualFeedbackScreen.js'), 'utf8');
    expect(fbSrc).toContain('P2H_OPENER_RITUAL');
    expect(uiSrc).not.toContain('P2H — Hostu degerlendir');
    expect(uiSrc).not.toContain("feedback_type: 'p2host'");
  });

  test('§7 presence ticket does not gate witness/tag/reveal', () => {
    const src = readFileSync(join(root, 'api/rituals.js'), 'utf8');
    expect(src).not.toContain('assertPresenceTicket');
    expect(src).not.toContain('presence ticket required');
  });

  test('§7 Aura/P2V observations require sealed check-in', () => {
    const auraSrc = readFileSync(join(root, 'services/venueTrustAuraService.js'), 'utf8');
    const fbSrc = readFileSync(join(root, 'api/feedback.js'), 'utf8');
    expect(auraSrc).toContain('ra.checkin_at IS NOT NULL');
    expect(fbSrc).toContain("COALESCE(checkin_phase, 'sealed') = 'sealed'");
  });
});

describe('check-in sonMD §8 dört cephe %100', () => {
  test('C2 dense canyon radius star does not loosen custom 30', () => {
    expect(LOCAL_CONFIG.checkin.GPS_RADIUS_METERS.custom).toBe(30);
    expect(LOCAL_CONFIG.checkin.GPS_RADIUS_METERS.venue).toBe(50);
    expect(LOCAL_CONFIG.checkin.GPS_RADIUS_METERS.venue_dense).toBe(75);
    expect(
      resolveCheckinRadiusMeters({ locationType: 'custom', ritualRadius: 30 })
    ).toBe(30);
    expect(
      resolveCheckinRadiusMeters({
        locationType: 'custom',
        ritualRadius: 30,
        denseCanyon: true,
      })
    ).toBe(30);
    expect(
      resolveCheckinRadiusMeters({
        locationType: 'venue',
        ritualRadius: 50,
        denseCanyon: true,
      })
    ).toBe(75);
    expect(
      resolveCheckinRadiusMeters({
        locationType: 'venue',
        ritualRadius: 50,
        venueGpsRadiusM: 90,
        denseCanyon: true,
      })
    ).toBe(90);
  });

  test('C2 pending alarm band + Android education copy', () => {
    expect(LOCAL_CONFIG.checkin.PENDING_SEAL_WATCH).toBe(0.1);
    expect(LOCAL_CONFIG.checkin.PENDING_SEAL_ALARM).toBe(0.15);
    expect(LOCAL_CONFIG.checkin.ANDROID_LOCATION_EDUCATION).toMatch(/Hassas konum/);
  });

  test('funnel records door_view join door_abandon + unsealed sitting + white-glove', () => {
    const funnelSrc = readFileSync(join(root, 'services/checkinFunnelService.js'), 'utf8');
    const ritualsSrc = readFileSync(join(root, 'api/rituals.js'), 'utf8');
    const venuesSrc = readFileSync(join(root, 'api/venues.js'), 'utf8');
    const modSrc = readFileSync(join(root, 'api/mod.js'), 'utf8');
    expect(funnelSrc).toContain('door_abandon');
    expect(funnelSrc).toContain('getUnsealedSittingReport');
    expect(funnelSrc).toContain('enqueueTotemOpsRequest');
    expect(funnelSrc).toContain('createCheckinFieldNote');
    expect(funnelSrc).toContain('view_to_join');
    expect(funnelSrc).toContain('gate_abandon');
    expect(ritualsSrc).toContain("event: 'join'");
    expect(ritualsSrc).toContain('checkin-funnel');
    expect(venuesSrc).toContain('enqueueTotemOpsRequest');
    expect(venuesSrc).toContain('dense_canyon');
    expect(modSrc).toContain('includeOps');
    expect(modSrc).toContain('checkin-field-notes');
    expect(modSrc).toContain('totem-ops');
  });

  test('migration 122 registers dense canyon + ops queue + field notes', () => {
    const runner = readFileSync(join(root, '../scripts/run-migrations.js'), 'utf8');
    expect(runner).toContain('122_dort_cephe_pct100.sql');
    const sql = readFileSync(join(root, 'migrations/122_dort_cephe_pct100.sql'), 'utf8');
    expect(sql).toContain('dense_canyon');
    expect(sql).toContain('gps_radius_m');
    expect(sql).toContain('totem_ops_queue');
    expect(sql).toContain('checkin_field_notes');
  });

  test('mobile: door funnel + Android GPS education + funnel panel + dense canyon', () => {
    const mobileRoot = join(__dirname, '../../../mobile/src');
    const checkinSrc = readFileSync(join(mobileRoot, 'screens/RitualCheckInScreen.js'), 'utf8');
    const detailSrc = readFileSync(join(mobileRoot, 'screens/RitualDetailScreen.js'), 'utf8');
    const modSrc = readFileSync(join(mobileRoot, 'screens/ModerationScreen.js'), 'utf8');
    const floorSrc = readFileSync(join(mobileRoot, 'screens/VenueFloorPlanScreen.js'), 'utf8');
    const apiSrc = readFileSync(join(mobileRoot, 'services/api.js'), 'utf8');
    expect(checkinSrc).toContain("recordCheckinFunnelClient(ritualId, 'door_view'");
    expect(checkinSrc).toContain("recordCheckinFunnelClient(ritualId, 'door_abandon'");
    expect(checkinSrc).toContain("Platform.OS === 'android'");
    expect(checkinSrc).toContain('androidLocationEducation');
    expect(detailSrc).toContain("surface: 'detail'");
    expect(modSrc).toContain("id: 'funnel'");
    expect(modSrc).toContain('unsealed_sitting');
    expect(modSrc).toContain('totem_ops_queue');
    expect(modSrc).toContain('createCheckinFieldNote');
    expect(floorSrc).toContain('dense_canyon');
    expect(floorSrc).toContain('gps_radius_m');
    expect(apiSrc).toContain('recordCheckinFunnelClient');
    expect(apiSrc).toContain('fetchCheckinFunnel');
    expect(apiSrc).toContain('patchTotemOps');
  });
});
