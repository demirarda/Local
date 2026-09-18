jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

import { t } from '../i18n/stringTable';
import useLanguageStore from '../store/languageStore';

describe('i18n string table', () => {
  afterEach(() => {
    useLanguageStore.setState({ lang: 'tr', initialized: true });
  });

  it('returns TR and EN for the same key', () => {
    expect(t('settings_title', 'tr')).toBe('Ayarlar');
    expect(t('settings_title', 'en')).toBe('Settings');
  });

  it('keeps concept words untranslated', () => {
    expect(t('ritual', 'tr')).toBe('Ritual');
    expect(t('ritual', 'en')).toBe('Ritual');
    expect(t('pulse', 'tr')).toBe('Pulse');
  });

  it('uses the language store when lang is omitted', () => {
    useLanguageStore.setState({ lang: 'en', initialized: true });
    expect(t('settings_language')).toBe('Language');
    useLanguageStore.setState({ lang: 'tr', initialized: true });
    expect(t('settings_language')).toBe('Dil');
  });

  it('accepts vars without an explicit lang', () => {
    expect(t('settings_city_active', { city: 'Milano' })).toBe('Milano aktif');
    expect(t('settings_city_active', 'en', { city: 'Milano' })).toBe('Milano active');
  });

  it('translates Pulse chrome', () => {
    expect(t('pulse_create', 'en')).toBe('+ Create Ritual');
    expect(t('pulse_filter_all', 'en')).toBe('All');
    expect(t('pulse_filter_friends', 'en')).toBe('Friends');
    expect(t('pulse_empty_all_title', 'en')).toBe('Pulse is empty');
    expect(t('bubble_ended', 'en')).toBe('ENDED');
    expect(t('bubble_ended_hint', 'en')).toBe('Open archive');
  });
});
