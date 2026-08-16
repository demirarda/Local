import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_MODE_KEY = '@local_theme_mode';

const useThemeStore = create((set, get) => ({
  mode: 'light', // light | dark
  initialized: false,

  initializeTheme: async () => {
    if (get().initialized) return;
    try {
      const saved = await AsyncStorage.getItem(THEME_MODE_KEY);
      if (saved === 'dark' || saved === 'light') {
        set({ mode: saved, initialized: true });
        return;
      }
    } catch (_e) {
      // ignore storage errors and keep default
    }
    set({ initialized: true });
  },

  setThemeMode: async (mode) => {
    const next = mode === 'dark' ? 'dark' : 'light';
    set({ mode: next });
    try {
      await AsyncStorage.setItem(THEME_MODE_KEY, next);
    } catch (_e) {
      // non-fatal
    }
  },

  toggleThemeMode: async () => {
    const current = get().mode;
    const next = current === 'dark' ? 'light' : 'dark';
    await get().setThemeMode(next);
  },
}));

export default useThemeStore;
