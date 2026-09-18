import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import useLanguageStore, { SUPPORTED_LANGS } from '../store/languageStore';

const NATIVE_LABELS = { tr: 'Türkçe', en: 'English' };
const SHORT_LABELS = { tr: 'TR', en: 'EN' };

export default function LanguageToggle({ compact = false, style }) {
  const lang = useLanguageStore((s) => s.lang);
  const setLang = useLanguageStore((s) => s.setLang);
  const labels = compact ? SHORT_LABELS : NATIVE_LABELS;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact, style]}>
      {SUPPORTED_LANGS.map((code) => {
        const on = lang === code;
        return (
          <TouchableOpacity
            key={code}
            onPress={() => setLang(code)}
            style={[styles.pill, compact && styles.pillCompact, on && styles.pillOn]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={NATIVE_LABELS[code]}
          >
            <Text style={[styles.pillText, compact && styles.pillTextCompact, on && styles.pillTextOn]}>
              {labels[code]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: '#E8EDF4',
    borderRadius: 999,
    padding: 3,
    gap: 2,
  },
  wrapCompact: { padding: 2 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  pillCompact: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 40,
    alignItems: 'center',
  },
  pillOn: { backgroundColor: '#1B2E4A' },
  pillText: { color: '#1B2E4A', fontSize: 12, fontWeight: '700' },
  pillTextCompact: { fontSize: 11 },
  pillTextOn: { color: '#fff' },
});
