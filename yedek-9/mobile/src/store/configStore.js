import { create } from 'zustand';
import { DEFAULT_PUBLIC_CONFIG } from '../constants/localConfig';
import { fetchPublicConfig } from '../services/api';

function mergePublicConfig(remote) {
  if (!remote || typeof remote !== 'object') return DEFAULT_PUBLIC_CONFIG;
  return {
    ...DEFAULT_PUBLIC_CONFIG,
    ...remote,
    ritual: { ...DEFAULT_PUBLIC_CONFIG.ritual, ...(remote.ritual || {}) },
    checkin: {
      ...DEFAULT_PUBLIC_CONFIG.checkin,
      ...(remote.checkin || {}),
      gps_radius_meters: {
        ...DEFAULT_PUBLIC_CONFIG.checkin.gps_radius_meters,
        ...(remote.checkin?.gps_radius_meters || {}),
      },
    },
    presence: { ...DEFAULT_PUBLIC_CONFIG.presence, ...(remote.presence || {}) },
    badges: { ...DEFAULT_PUBLIC_CONFIG.badges, ...(remote.badges || {}) },
    venue: { ...DEFAULT_PUBLIC_CONFIG.venue, ...(remote.venue || {}) },
    regular: { ...DEFAULT_PUBLIC_CONFIG.regular, ...(remote.regular || {}) },
    rs_display: {
      ...DEFAULT_PUBLIC_CONFIG.rs_display,
      ...(remote.rs_display || {}),
      weights: {
        ...DEFAULT_PUBLIC_CONFIG.rs_display.weights,
        ...(remote.rs_display?.weights || {}),
      },
      bc: {
        ...DEFAULT_PUBLIC_CONFIG.rs_display.bc,
        ...(remote.rs_display?.bc || {}),
      },
    },
    ds_display: { ...DEFAULT_PUBLIC_CONFIG.ds_display, ...(remote.ds_display || {}) },
    fl_display: { ...DEFAULT_PUBLIC_CONFIG.fl_display, ...(remote.fl_display || {}) },
    stubs: {
      ...DEFAULT_PUBLIC_CONFIG.stubs,
      ...(remote.stubs || {}),
      venue_payment: {
        ...DEFAULT_PUBLIC_CONFIG.stubs.venue_payment,
        ...(remote.stubs?.venue_payment || {}),
      },
      csam: {
        ...(DEFAULT_PUBLIC_CONFIG.stubs.csam || {}),
        ...(remote.stubs?.csam || {}),
      },
    },
  };
}

const useConfigStore = create((set, get) => ({
  config: DEFAULT_PUBLIC_CONFIG,
  loaded: false,
  loading: false,

  initializeConfig: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const remote = await fetchPublicConfig();
      set({ config: mergePublicConfig(remote), loaded: true });
    } catch (_e) {
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },
}));

export default useConfigStore;
