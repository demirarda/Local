/**
 * MOD rapor yüzeyleri — sonMD §5 (tek kaynak)
 * Live 4 buton: Bildir · Bildir ve ayrıl · Konum · Yardım (UI)
 */
export const REPORT_CATEGORIES = [
  'report_cat_uncomfortable',
  'report_cat_boundary',
  'report_cat_mismatch',
  'report_cat_other',
  'report_cat_csam',
  'report_cat_sexual_assault',
];

/** 11+ yüzey — rapor açılabilir entry points */
export const REPORT_SURFACES = [
  'user_profile',
  'friend_fl3',
  'memory',
  'quote',
  'ritual',
  'spark',
  'prelobby_message',
  'forum',
  'share2person',
  'venue_profile',
  'zone_profile',
  'venue_badge',
  'venue_event',
];

/** Live Ritual güvenlik şeridi — 4 aksiyon */
export const LIVE_SAFETY_ACTIONS = [
  'report',
  'report_and_leave',
  'share_location',
  'help_options',
];

export const MOD_IRON_RULES = {
  raw_report_touches_rs: false,
  rs_path: 'applyModAction_MOD_BYPASS_only',
  single_queue: true,
  leave_after_cannot_give_fb: true,
  leave_after_can_receive_fb: true,
};
