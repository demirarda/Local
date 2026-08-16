import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { searchDiscovery } from '../services/api';
import { t } from '../i18n/stringTable';

const PRIMARY = '#f9a13d';
const TEXT = '#1a1a1a';
const MUTED = '#6b6b6b';
const BORDER = '#e5e5e0';

const TAB_LABELS = {
  all: 'Tümü',
  rituals: t('rituals'),
  series: 'Seriler',
  slots: 'Slotlar',
  venues: 'Mekanlar',
  zones: "Zone'lar",
  people: 'Kişiler',
  memories: 'Memories',
  forum: 'Forum',
  category: 'Kategori',
  location: 'Konum',
  brands: 'Brand',
};

function navigateResult(navigation, item, { onCategory } = {}) {
  if (!item || !navigation) return;
  const kind = item.kind;
  const id = item.id;
  if (kind === 'rituals') {
    navigation.navigate('RitualDetail', { ritualId: id });
    return;
  }
  if (kind === 'series') {
    navigation.navigate('SeriesDetail', { seriesId: id });
    return;
  }
  if (kind === 'forum') {
    if (item.meta?.ritual_id) {
      navigation.navigate('RitualForum', { ritualId: item.meta.ritual_id });
    }
    return;
  }
  if (kind === 'venues' || (kind === 'location' && item.meta?.subtype === 'venue')) {
    navigation.navigate('VenueDetail', { venueId: item.meta?.venue_id || id });
    return;
  }
  if (kind === 'zones' || (kind === 'location' && item.meta?.subtype === 'zone')) {
    navigation.navigate('ZoneDetail', { zoneId: item.meta?.zone_id || id });
    return;
  }
  if (kind === 'people') {
    navigation.navigate('ParticipantProfile', { userId: id });
    return;
  }
  if (kind === 'memories') {
    navigation.navigate('MemoryDetail', { memoryId: id });
    return;
  }
  if (kind === 'slots') {
    if (item.meta?.venue_id) {
      navigation.navigate('VenueSlots', { venueId: item.meta.venue_id });
    }
    return;
  }
  if (kind === 'brands') {
    navigation.navigate('BrandProfile', { brandId: id });
    return;
  }
  if (kind === 'category') {
    // Kategori bir hedef degil, filtre: sorguyu kategoriye cevirip Ritual sekmesine gec
    onCategory?.(item);
  }
}

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');
  const [results, setResults] = useState([]);
  const [tabs, setTabs] = useState(Object.keys(TAB_LABELS));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runSearch = useCallback(async (q, t) => {
    const trimmed = String(q || '').trim();
    if (!trimmed) {
      setResults([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await searchDiscovery({ q: trimmed, tab: t, limit: 30 });
      setResults(data?.results || []);
      if (Array.isArray(data?.tabs) && data.tabs.length) setTabs(data.tabs);
    } catch (e) {
      setError(e?.message || 'Arama başarısız');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => runSearch(query, tab), 280);
    return () => clearTimeout(handle);
  }, [query, tab, runSearch]);

  const header = useMemo(
    () => (
      <View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <MaterialIcons name="arrow-back" size={22} color={TEXT} />
        </TouchableOpacity>
        <Text style={styles.eyebrow}>ARAMA & KEŞİF</Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Ritual, mekan, kişi, zone…"
          placeholderTextColor="#9a9a9a"
          autoFocus
          returnKeyType="search"
          onSubmitEditing={() => runSearch(query, tab)}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {tabs.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {TAB_LABELS[t] || t}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={PRIMARY} style={{ marginVertical: 8 }} /> : null}
      </View>
    ),
    [navigation, query, tab, tabs, error, loading, runSearch]
  );

  const applyCategoryFilter = useCallback((item) => {
    const label = item?.label || item?.id;
    if (!label) return;
    setQuery(String(label));
    setTab('rituals');
  }, []);

  const renderItem = ({ item }) => {
    const metaBits = [];
    if (item.kind) metaBits.push(TAB_LABELS[item.kind] || item.kind);
    if (item.meta?.joinable) metaBits.push('girebilirsin');
    if (item.meta?.tier) metaBits.push(item.meta.tier);
    if (item.meta?.lane) metaBits.push(item.meta.lane === 'live_24h' ? 'canlı 24s' : 'arşiv');
    if (item.meta?.tentative) metaBits.push('tentative');
    if (item.meta?.city) metaBits.push(item.meta.city);
    if (item.kind === 'series') {
      metaBits.push(item.meta?.cadence === 'BIWEEKLY' ? 'iki haftada bir' : 'her hafta');
      if (item.meta?.week_count) metaBits.push(`${item.meta.week_count}. hafta`);
      if (item.meta?.active === false) metaBits.push('kapalı');
    }
    if (item.kind === 'forum' && item.meta?.ritual_title) metaBits.push(item.meta.ritual_title);
    if (item.kind === 'category') metaBits.push('dokun · Ritual ara');
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigateResult(navigation, item, { onCategory: applyCategoryFilter })}
      >
        <Text style={styles.rowTitle} numberOfLines={2}>
          {item.label}
        </Text>
        <Text style={styles.rowMeta}>{metaBits.join(' · ')}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={results}
        keyExtractor={(item, idx) => `${item.kind}-${item.id}-${idx}`}
        ListHeaderComponent={header}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          !loading && String(query).trim() ? (
            <Text style={styles.empty}>Sonuç yok</Text>
          ) : !loading ? (
            <Text style={styles.empty}>Ara ve keşfet</Text>
          ) : null
        }
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf9f6' },
  content: { padding: 20, paddingBottom: 48 },
  back: { marginBottom: 8, alignSelf: 'flex-start' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: PRIMARY },
  input: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT,
  },
  tabs: { paddingVertical: 12, gap: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
    marginRight: 8,
  },
  tabActive: { backgroundColor: '#111', borderColor: '#111' },
  tabText: { fontSize: 12, fontWeight: '700', color: TEXT },
  tabTextActive: { color: '#fff' },
  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 10,
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: TEXT },
  rowMeta: { fontSize: 12, color: MUTED, marginTop: 4 },
  empty: { color: MUTED, marginTop: 24, textAlign: 'center' },
  error: { color: '#b45309', marginTop: 8, fontSize: 13 },
});
