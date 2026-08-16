/**
 * §1 Kimlik kapısı — launch stub acceptance snapshot
 * Canlı KYC provider OPEN-FOUNDER; stub path launch için kabul.
 */
import LOCAL_CONFIG from '../config/localConfig.js';
import { getActiveKycProviderName, getKycLiveReadiness } from './kycProvider.js';

/** Write surfaces that must run requireIdentityVerified */
export const IDENTITY_GATED_WRITES = [
  'POST /rituals',
  'POST /rituals/:id/join',
  'POST /rituals/:id/publish',
  'POST /attendance/checkin',
  'POST /memories',
  'POST /feedback',
  'POST /feedback/batch',
];

export const IDENTITY_IRON_RULES = {
  unverified_cannot_write: true,
  pii_retained: false,
  gallery_upload_allowed: false,
  nfc_primary: true,
  once_in_lifetime: true,
  re_register_blocked_by_hash: true,
  l4_blacklist_blocks_reregister: true,
  stub_accepted_for_launch: true,
  live_provider_status: 'HTTP_ADAPTER_READY',
};

export function getIdentityAcceptance() {
  const id = LOCAL_CONFIG.identity || {};
  const open = LOCAL_CONFIG.open?.kyc_provider_contract || {};
  const live = getKycLiveReadiness();
  return {
    launch_status: live.live_mode ? 'PASS_LIVE' : 'PASS_STUB',
    active_provider: getActiveKycProviderName(),
    providers: [...(id.PROVIDERS || [])],
    gallery_upload_allowed: id.GALLERY_UPLOAD_ALLOWED === true,
    nfc_primary: id.NFC_PRIMARY !== false,
    fallback_path: id.FALLBACK_PATH || 'card_photo_selfie',
    documents: [...(id.DOCUMENTS || [])],
    target_s: id.TARGET_S ?? 60,
    liveness_passive_s: id.LIVENESS_PASSIVE_S ?? 3,
    username_change_d: id.USERNAME_CHANGE_D ?? 90,
    name_change_d: id.NAME_CHANGE_D ?? 90,
    culture_lines: [...(id.CULTURE_LINES || [])],
    gated_writes: IDENTITY_GATED_WRITES,
    iron_rules: IDENTITY_IRON_RULES,
    live_readiness: live,
    open_kyc: {
      status: live.live_mode ? 'live_configured' : open.status || 'stub',
      active: getActiveKycProviderName(),
      candidates: open.candidates || ['techsign', 'ihs'],
      note: open.note || 'DPA pending',
      launch_accepted: open.launch_accepted === true || open.status === 'pass_stub_launch',
      treat_as_complete: open.treat_as_complete === true,
      launch_unblocks: open.launch_unblocks !== false,
      still_open: open.still_open === true,
      still_open_reason: open.still_open_reason || null,
      phase2_code_ready: open.phase2_code_ready === true,
      phase2_checklist: open.phase2_checklist || [
        'Choose Techsign or IHS',
        'Sign DPA',
        'Sandbox API key + webhook secret',
        'Set KYC_PROVIDER + KYC_*_BASE_URL + KYC_*_API_KEY',
        'Map vendor paths if needed (START_PATH / COMPLETE_PATH)',
      ],
    },
  };
}
