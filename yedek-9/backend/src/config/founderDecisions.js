/**
 * son-part1.md §10 — founder kararları (v1.0 uygulama snapshot)
 * ❓ maddeleri mevcut kod davranışına göre çözüldü; varsayımla kapatılmadı.
 */

export const FOUNDER_DECISIONS_VERSION = '1.0.0';

/** @type {ReadonlyArray<{ id: number, question: string, resolution: string, code_refs: string[] }>} */
export const FOUNDER_DECISIONS = [
  {
    id: 1,
    question: 'T_r alt sınırı [0, 0.75] clamp?',
    resolution: 'T_r = clamp(P_r − W_IF·IF, 0, 1); P_r önce S_POS_MAX (0.75) ile clamp. Pipeline delta cap ±0.12/−0.15.',
    code_refs: ['localConfig.js:computeTruthSignalFromComponents', 'rsEngine.js'],
  },
  {
    id: 2,
    question: 'Q1 (P2R) kişisel RS bileşeni?',
    resolution: 'Kişisel RS motoruna girmez. Venue Trust/Aura ayrı display katmanı (tek yönlü akış).',
    code_refs: ['venueTrustAuraService.js', 'son-part.md §0'],
  },
  {
    id: 3,
    question: 'IQ cold start (n=0,1,2)?',
    resolution: 'n=0 → 0.50 nötr; n=1 → 0.60·0.5+0.40·raw (founder: bir tanık > hiç tanık); n=2 → 0.75·raw+0.25·0.5; n≥3 → raw×conf blend.',
    code_refs: ['localConfig.js:blendIqFromRaw'],
  },
  {
    id: 4,
    question: 'Host check-in / keyword açınca otomatik check-in?',
    resolution: 'Host keyword reveal ayrı endpoint; host check-in otomatik sayılmaz. Host no-show Ritual collapse.',
    code_refs: ['checkinService.js:revealCheckinKeyword', 'checkinService.js:collapseRitualHostNoShow'],
  },
  {
    id: 5,
    question: 'Window süresi start_at mi duration bitişi mi?',
    resolution: 'Window duration bitişinden başlar (live_window_hours). Memory yalnızca window fazında.',
    code_refs: ['ritualCompletion.js', 'memories.js:validateRitualMemoryCreate', 'ritualState.js'],
  },
  {
    id: 6,
    question: 'MIN_RITUAL_SIZE altı Ritual start_at?',
    resolution: 'Kapasite min 3 ile oluşturulur; start_at auto-cancel ayrı cron yok — katılım/iptal akışı ile yönetilir.',
    code_refs: ['ritualCreateValidation.js', 'LOCAL_CONFIG.ritual.MIN_SIZE'],
  },
  {
    id: 7,
    question: 'Trust/Aura ölçeği (prior=5.0)?',
    resolution: 'Display 0–10 skala; kategori prior 5.0 (VEN_PRIOR). P2R/P2V internal 0–1, display ×10.',
    code_refs: ['venueTrustAuraService.js', 'LOCAL_CONFIG.venue.PRIOR'],
  },
  {
    id: 8,
    question: 'Geç kalma AIS 0.85 + late IF birlikte?',
    resolution: 'Bilinçli: AIS düşer (computeAis) ve IF_late_slice ayrı IF bileşenine eklenir.',
    code_refs: ['localConfig.js:computeAis', 'localConfig.js:aisFromAttendanceRow', 'rsEngine.js:IF_LATE_SLICE'],
  },
  {
    id: 9,
    question: 'RS optional public vs Share-2-Person yasağı?',
    resolution: 'Profilde RS gösterilebilir (RSTransparency); Share-2-Person nesne olarak RS paylaşılmaz.',
    code_refs: ['shareService.js', 'RSTransparencyScreen.js'],
  },
  {
    id: 10,
    question: 'MAX_WINDOW_CAPACITY ve DS tier eşikleri?',
    resolution: 'MAX_WINDOW_CAPACITY=12; TIER_THRESHOLDS=[0.35,0.5,0.65,0.8] — localConfig §12.',
    code_refs: ['localConfig.js:ds', 'dsEngine.js'],
  },
  {
    id: 11,
    question: 'Recurring instance üretimi?',
    resolution: 'v1 stub: recurringRitualStub haftalık child spawn + recurring_instance bildirimi.',
    code_refs: ['recurringRitualStub.js', 'LOCAL_CONFIG.stubs.RECURRING_RITUALS_ENABLED'],
  },
  {
    id: 12,
    question: 'Check-in ham koordinat saklama (KVKK)?',
    resolution: 'Doğrulama sonrası encrypted blob + attendance lat/lng; production’da encryptJsonAtRest.',
    code_refs: ['checkinService.js:encryptJsonAtRest', 'migration 058'],
  },
];

export function getFounderDecisionsSummary() {
  return {
    version: FOUNDER_DECISIONS_VERSION,
    resolved_count: FOUNDER_DECISIONS.length,
    decisions: FOUNDER_DECISIONS,
  };
}

export default FOUNDER_DECISIONS;
