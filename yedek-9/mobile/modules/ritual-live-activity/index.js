import { requireNativeModule, Platform } from 'expo-modules-core';

let NativeModule = null;

function getModule() {
  if (Platform.OS !== 'ios') return null;
  if (!NativeModule) {
    try {
      NativeModule = requireNativeModule('RitualLiveActivity');
    } catch (_e) {
      NativeModule = null;
    }
  }
  return NativeModule;
}

export function isLiveActivitySupported() {
  const mod = getModule();
  if (!mod?.isSupported) return false;
  try {
    return mod.isSupported();
  } catch (_e) {
    return false;
  }
}

export async function startLiveActivity(payload = {}) {
  const mod = getModule();
  if (!mod?.start) {
    return { ok: false, reason: 'module_unavailable' };
  }
  return mod.start({
    ritualId: String(payload.ritual_id || ''),
    title: payload.title || 'Rituel',
    phase: payload.phase || 'live',
    brandMark: payload.brand_mark || 'L',
    endsAt: payload.ends_at || new Date(Date.now() + (payload.remaining_seconds || 0) * 1000).toISOString(),
    remainingSeconds: Number(payload.remaining_seconds) || 0,
  });
}

export async function updateLiveActivity(payload = {}) {
  const mod = getModule();
  if (!mod?.update) {
    return { ok: false, reason: 'module_unavailable' };
  }
  return mod.update({
    ritualId: String(payload.ritual_id || ''),
    title: payload.title || 'Rituel',
    phase: payload.phase || 'live',
    brandMark: payload.brand_mark || 'L',
    endsAt: payload.ends_at || new Date(Date.now() + (payload.remaining_seconds || 0) * 1000).toISOString(),
    remainingSeconds: Number(payload.remaining_seconds) || 0,
  });
}

export async function endLiveActivity() {
  const mod = getModule();
  if (!mod?.end) {
    return { ok: false, reason: 'module_unavailable' };
  }
  return mod.end();
}
