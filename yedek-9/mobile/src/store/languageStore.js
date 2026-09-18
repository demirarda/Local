import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANG_KEY = '@local_language';
export const SUPPORTED_LANGS = Object.freeze(['tr', 'en']);

function detectDeviceLang() {
  try {
    const locale = String(Intl.DateTimeFormat().resolvedOptions().locale || '').toLowerCase();
    if (locale.startsWith('en')) return 'en';
    if (locale.startsWith('tr')) return 'tr';
  } catch (_e) {
    // keep product default
  }
  return 'tr';
}

function normalizeLang(value) {
  const code = String(value || '').toLowerCase().slice(0, 2);
  return SUPPORTED_LANGS.includes(code) ? code : 'tr';
}

const useLanguageStore = create((set, get) => ({
  lang: 'tr',
  initialized: false,

  initializeLanguage: async () => {
    if (get().initialized) return get().lang;
    try {
      const saved = await AsyncStorage.getItem(LANG_KEY);
      if (saved === 'tr' || saved === 'en') {
        set({ lang: saved, initialized: true });
        return saved;
      }
    } catch (_e) {
      // ignore storage errors and fall through to device default
    }
    const next = detectDeviceLang();
    set({ lang: next, initialized: true });
    return next;
  },

  setLang: async (lang) => {
    const next = normalizeLang(lang);
    set({ lang: next });
    try {
      await AsyncStorage.setItem(LANG_KEY, next);
    } catch (_e) {
      // non-fatal
    }
    return next;
  },
}));

export default useLanguageStore;
