import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAuthStore from '../store/authStore';
import useConfigStore from '../store/configStore';
import { getHighlightUserMax } from '../constants/localConfig';
import { fetchMyBadgesArchive, updateHighlightedBadges, fetchBadgeCatalog, submitBadgeLlmSuggestion } from '../services/api';

const CATEGORY_LABELS = {
  SPECIAL: '✦ Special',
  MASTERY: '⬡ Mastery',
  BEHAVIORAL: '● Behavioral',
  VENUE: '🛡 Venue',
  ZONE: '📍 Zone',
  MILESTONE: '▦ Milestone',
  // legacy keys (fallback)
  location: '📍 Zone',
  region: '📍 Zone',
  behavior: '● Behavioral',
  content: '⬡ Mastery',
  special: '✦ Special',
  venue: '🛡 Venue',
  milestone: '▦ Milestone',
};

const LEVEL_LABELS = { novice: 'Novice', regular: 'Regular', master: 'Master' };
const FAMILY_ORDER = ['SPECIAL', 'MASTERY', 'BEHAVIORAL', 'VENUE', 'ZONE', 'MILESTONE'];

function levelLabel(level) {
  if (!level) return null;
  return LEVEL_LABELS[level] || level;
}

export default function BadgeGalleryScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const configHighlightMax = getHighlightUserMax(useConfigStore((s) => s.config));
  const initialTab = route?.params?.initialTab || 'all';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [badges, setBadges] = useState([]);
  const [highlighted, setHighlighted] = useState([]);
  const [highlightMax, setHighlightMax] = useState(configHighlightMax);
  const [categories, setCategories] = useState(['all', ...FAMILY_ORDER]);
  const [savingHighlight, setSavingHighlight] = useState(false);
  const [loading, setLoading] = useState(true);
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [llmSlug, setLlmSlug] = useState('');
  const [llmReason, setLlmReason] = useState('');
  const [llmSubmitting, setLlmSubmitting] = useState(false);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [archiveData, catalogData] = await Promise.all([
          fetchMyBadgesArchive().catch(() => ({ archive: [], highlighted_badge_keys: [] })),
          fetchBadgeCatalog().catch(() => ({ catalog: [], categories: [], highlight_max: configHighlightMax })),
        ]);
        const archive = Array.isArray(archiveData?.archive) ? archiveData.archive : [];
        setBadges(
          archive.map((b) => {
            const spec = b.spec_category || 'behavior';
            const family =
              b.family ||
              ({
                location: 'ZONE',
                region: 'ZONE',
                behavior: 'BEHAVIORAL',
                content: 'MASTERY',
                special: 'SPECIAL',
                venue: 'VENUE',
                milestone: 'MILESTONE',
              }[spec] || 'BEHAVIORAL');
            return {
              key: b.slug || b.key,
              label: b.name || b.label,
              icon: b.icon_emoji || b.icon || '🏅',
              condition: b.condition || '',
              spec_category: spec,
              family,
              family_glyph: b.family_glyph || '',
              earned: Boolean(b.earned),
              status: b.status || (b.earned ? 'earned' : 'locked'),
              level: b.badge_level || null,
              progress_pct: b.progress_pct || 0,
              internal_only: Boolean(b.internal_only || b.is_negative),
            };
          })
        );
        setHighlighted(archiveData?.highlighted_badge_keys || []);
        setHighlightMax(catalogData?.highlight_max || configHighlightMax);
        setLlmEnabled(Boolean(catalogData?.llm_pipeline_enabled));
        const fams = catalogData?.families || catalogData?.categories || FAMILY_ORDER;
        setCategories(['all', ...fams.filter((f) => f && f !== 'all')]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  const submitLlmSuggestion = async () => {
    if (!llmSlug.trim()) {
      Alert.alert('Slug gerekli', 'Onerilen rozet slug girin');
      return;
    }
    setLlmSubmitting(true);
    try {
      await submitBadgeLlmSuggestion({ suggested_slug: llmSlug.trim(), reason: llmReason.trim() || null });
      Alert.alert('Gonderildi', 'Onerin admin onay kuyruguna eklendi.');
      setLlmSlug('');
      setLlmReason('');
    } catch (e) {
      Alert.alert('Hata', e.message || 'LLM pipeline kapali veya gonderilemedi');
    } finally {
      setLlmSubmitting(false);
    }
  };

  const visibleBadges = useMemo(() => {
    let list = badges.filter((x) => !x.internal_only);
    if (categoryFilter !== 'all') {
      list = list.filter((x) => x.family === categoryFilter || x.spec_category === categoryFilter);
    }
    if (activeTab === 'all') return list;
    if (activeTab === 'earned') return list.filter((x) => x.earned);
    if (activeTab === 'prog') return list.filter((x) => x.status === 'in_progress');
    if (activeTab === 'locked') return list.filter((x) => x.status === 'locked');
    return list;
  }, [activeTab, badges, categoryFilter]);

  const total = badges.filter((x) => !x.internal_only).length;
  const earnedCount = badges.filter((x) => !x.internal_only && x.earned).length;
  const inProgressCount = badges.filter((x) => !x.internal_only && x.status === 'in_progress').length;
  const lockedCount = Math.max(0, total - earnedCount - inProgressCount);
  const progressPct = total > 0 ? Math.round((earnedCount / total) * 100) : 0;

  const iconTone = (key = '', earned = false) => {
    if (!earned) return styles.biDark;
    if (key.includes('founder') || key.includes('pivot')) return styles.biGold;
    if (key.includes('host') || key.includes('time')) return styles.biGreen;
    if (key.includes('memory') || key.includes('forum') || key.includes('pulse')) return styles.biPurple;
    return styles.biTeal;
  };

  const toggleHighlight = async (key) => {
    const earned = badges.find((b) => b.key === key)?.earned;
    if (!earned) return;
    let next = highlighted.includes(key)
      ? highlighted.filter((k) => k !== key)
      : [...highlighted, key];
    if (next.length > highlightMax) {
      next = next.slice(-highlightMax);
    }
    setHighlighted(next);
    setSavingHighlight(true);
    try {
      await updateHighlightedBadges(next);
    } catch (_e) {}
    setSavingHighlight(false);
  };

  const earnedForHighlight = badges.filter((b) => b.earned && !b.internal_only);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 0) + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.topBarBack}>← Passport</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Rozetler</Text>
        <View style={{ width: 64 }} />
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Rozet Istatistikleri</Text>
        <View style={styles.heroCounts}>
          <View style={styles.heroCell}>
            <Text style={[styles.heroNum, styles.heroNumGold]}>{earnedCount}</Text>
            <Text style={styles.heroSub}>Kazanildi</Text>
          </View>
          <View style={styles.heroCell}>
            <Text style={styles.heroNum}>{inProgressCount}</Text>
            <Text style={styles.heroSub}>Devam Ediyor</Text>
          </View>
          <View style={styles.heroCell}>
            <Text style={styles.heroNum}>{lockedCount}</Text>
            <Text style={styles.heroSub}>Kilitli</Text>
          </View>
        </View>
        <View style={styles.heroProgressRow}>
          <Text style={styles.heroProgressLabel}>Toplam ilerleme</Text>
          <Text style={styles.heroProgressVal}>{earnedCount} / {total}</Text>
        </View>
        <View style={styles.heroTrack}>
          <View style={[styles.heroFill, { width: `${progressPct}%` }]} />
        </View>
      </View>

      <View style={styles.highlightBox}>
        <Text style={styles.highlightTitle}>
          One Cikan {highlightMax} Rozet {savingHighlight ? '· kaydediliyor' : ''}
        </Text>
        <Text style={styles.highlightSub}>Profilde gosterilecek rozetleri sec (max {highlightMax})</Text>
        <View style={styles.highlightRow}>
          {earnedForHighlight.map((b) => (
            <TouchableOpacity
              key={`hl-${b.key}`}
              style={[styles.highlightChip, highlighted.includes(b.key) && styles.highlightChipOn]}
              onPress={() => toggleHighlight(b.key)}
            >
              <Text style={styles.highlightChipText}>{b.icon} {b.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {llmEnabled ? (
        <View style={styles.highlightBox}>
          <Text style={styles.highlightTitle}>LLM Rozet Onerisi</Text>
          <Text style={styles.highlightSub}>Admin onay kuyruguna gider — otomatik atama yok</Text>
          <TextInput
            style={styles.llmInput}
            placeholder="slug (ornek: city_explorer)"
            value={llmSlug}
            onChangeText={setLlmSlug}
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.llmInput, { marginTop: 8 }]}
            placeholder="Neden (opsiyonel)"
            value={llmReason}
            onChangeText={setLlmReason}
          />
          <TouchableOpacity style={styles.llmBtn} onPress={submitLlmSuggestion} disabled={llmSubmitting}>
            <Text style={styles.llmBtnText}>{llmSubmitting ? 'Gonderiliyor…' : 'Oneri Gonder'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.highlightBox}>
          <Text style={styles.highlightSub}>LLM rozet pipeline kapali (admin acinca aktif olur)</Text>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.catChip, categoryFilter === cat && styles.catChipOn]}
            onPress={() => setCategoryFilter(cat)}
          >
            <Text style={[styles.catChipText, categoryFilter === cat && styles.catChipTextOn]}>
              {cat === 'all' ? 'Tumu' : (CATEGORY_LABELS[cat] || cat)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, activeTab === 'all' && styles.tabActive]} onPress={() => setActiveTab('all')}>
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>Tumu</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'earned' && styles.tabActive]} onPress={() => setActiveTab('earned')}>
          <Text style={[styles.tabText, activeTab === 'earned' && styles.tabTextActive]}>Kazanildi</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'prog' && styles.tabActive]} onPress={() => setActiveTab('prog')}>
          <Text style={[styles.tabText, activeTab === 'prog' && styles.tabTextActive]}>Devam</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'locked' && styles.tabActive]} onPress={() => setActiveTab('locked')}>
          <Text style={[styles.tabText, activeTab === 'locked' && styles.tabTextActive]}>Kilitli</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.secHeader}>
        <Text style={styles.secTitle}>Rozetler</Text>
        <Text style={styles.secCount}>{visibleBadges.length} / {total}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#111827" style={{ marginTop: 24 }} />
      ) : (
        <View>
          {visibleBadges.map((item) => (
            <View key={item.key} style={[styles.badgeCard, !item.earned && styles.badgeCardLocked]}>
              <View style={[styles.badgeIcon, iconTone(item.key, !!item.earned)]}>
                <Text style={styles.icon}>{item.icon}</Text>
                {item.earned ? <View style={styles.check}><Text style={styles.checkText}>✓</Text></View> : null}
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowText}>{item.family_glyph ? `${item.family_glyph} ` : ''}{item.label}</Text>
                <Text style={styles.condition}>{item.condition}</Text>
                {item.earned && item.level ? (
                  <Text style={styles.levelPill}>{levelLabel(item.level)}</Text>
                ) : null}
                {!item.earned && item.status === 'in_progress' ? (
                  <Text style={styles.progressHint}>%{item.progress_pct} · {CATEGORY_LABELS[item.spec_category] || item.spec_category}</Text>
                ) : null}
              </View>
              <View style={styles.badgeStatus}>
                <Text style={[styles.statusPill, item.earned ? styles.statusEarnedPill : item.status === 'in_progress' ? styles.statusProgPill : styles.statusLockedPill]}>
                  {item.earned ? 'Kazanildi ✓' : item.status === 'in_progress' ? 'Devam' : '🔒 Kilitli'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  content: { paddingBottom: 40 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  topBarBack: { width: 64, fontSize: 13, fontWeight: '600', color: '#1B2E4A' },
  topBarTitle: { flex: 1, textAlign: 'center', fontSize: 18, color: '#000' },
  hero: { marginHorizontal: 16, backgroundColor: '#1B2E4A', borderRadius: 18, padding: 16, marginBottom: 14 },
  heroLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.3, color: 'rgba(255,255,255,.5)', marginBottom: 10, textTransform: 'uppercase' },
  heroCounts: { flexDirection: 'row', marginBottom: 12 },
  heroCell: { flex: 1, alignItems: 'center' },
  heroNum: { fontSize: 30, color: '#fff' },
  heroNumGold: { color: '#C8A96A' },
  heroSub: { fontSize: 9, color: 'rgba(255,255,255,.45)', textTransform: 'uppercase' },
  heroProgressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  heroProgressLabel: { fontSize: 10, color: 'rgba(255,255,255,.5)' },
  heroProgressVal: { fontSize: 10, color: 'rgba(255,255,255,.65)', fontWeight: '600' },
  heroTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.14)', overflow: 'hidden' },
  heroFill: { height: '100%', backgroundColor: '#C8A96A' },
  highlightBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  highlightTitle: { fontSize: 13, fontWeight: '800', color: '#111' },
  highlightSub: { fontSize: 11, color: '#6b7280', marginBottom: 8 },
  highlightRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  highlightChip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f9fafb',
  },
  highlightChipOn: { borderColor: '#C8A96A', backgroundColor: '#FFF8E8' },
  highlightChipText: { fontSize: 11, color: '#111' },
  llmInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fafafa',
  },
  llmBtn: {
    marginTop: 10,
    backgroundColor: '#1B2E4A',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  llmBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  catRow: { paddingHorizontal: 16, gap: 6, marginBottom: 10 },
  catChip: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  catChipOn: { backgroundColor: '#1B2E4A', borderColor: '#1B2E4A' },
  catChipText: { fontSize: 11, fontWeight: '600', color: '#6b7280' },
  catChipTextOn: { color: '#fff' },
  tabs: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e5e5', marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', backgroundColor: '#fff' },
  tabActive: { backgroundColor: '#1B2E4A', borderColor: '#1B2E4A' },
  tabText: { fontSize: 10, fontWeight: '600', color: '#a3a3a3' },
  tabTextActive: { color: '#fff' },
  secHeader: { marginHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  secTitle: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, color: '#a3a3a3' },
  secCount: { fontSize: 10, fontWeight: '600', color: '#d4d4d4' },
  badgeCard: { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#e5e5e5', flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  badgeCardLocked: { opacity: 0.75 },
  badgeIcon: { width: 48, height: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  biGreen: { backgroundColor: '#EAF3DE' },
  biNavy: { backgroundColor: '#E8EDF4' },
  biGold: { backgroundColor: '#FEF3C7' },
  biPurple: { backgroundColor: '#EDE9FE' },
  biTeal: { backgroundColor: '#CCFBF1' },
  biDark: { backgroundColor: '#F5F5F5' },
  check: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: '#16A34A', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  checkText: { fontSize: 8, color: '#fff', fontWeight: '700' },
  icon: { fontSize: 24 },
  rowBody: { flex: 1 },
  rowText: { color: '#000', fontSize: 13, fontWeight: '600' },
  condition: { color: '#a3a3a3', fontSize: 10, marginTop: 2, lineHeight: 14 },
  levelPill: { marginTop: 4, fontSize: 10, fontWeight: '700', color: '#C8A96A' },
  progressHint: { marginTop: 4, fontSize: 10, color: '#6b7280' },
  badgeStatus: { alignItems: 'flex-end' },
  statusPill: { fontSize: 9, fontWeight: '700', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  statusEarnedPill: { backgroundColor: '#1B2E4A', color: '#fff' },
  statusProgPill: { backgroundColor: '#FEF3C7', color: '#92400E' },
  statusLockedPill: { backgroundColor: '#F5F5F5', color: '#A3A3A3' },
});
