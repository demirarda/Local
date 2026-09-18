import { useCallback } from 'react';
import useLanguageStore from '../store/languageStore';
import { t } from './stringTable';

/** Subscribe to the active language and resolve string-table keys. */
export default function useT() {
  const lang = useLanguageStore((s) => s.lang);
  return useCallback((key, vars) => t(key, lang, vars), [lang]);
}

export function useLang() {
  return useLanguageStore((s) => s.lang);
}
