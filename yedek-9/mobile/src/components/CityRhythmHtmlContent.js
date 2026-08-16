import { pulseGridCardImage } from '../constants/pulseExampleImages';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { nominateVenuePlace } from '../services/api';

const FONT_SERIF = 'Georgia';

const cleanRitualTitle = (value = '') =>
  String(value || '')
    .replace(/^\[[^\]]+\]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const formatHour = (dateStr) => {
  const d = new Date(dateStr);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

export default function CityRhythmHtmlContent({
  rituals = [],
  refreshing = false,
  onRefresh,
  onLoadMore,
  hasMore = false,
  searchQuery = '',
  onSearchChange,
  onSearchSubmit,
  timeFilter = 'all',
  onTimeFilterChange,
  onRitualPress,
  getEntryTypeText = (r) => (r?.entry_type === 'request_seat' ? 'RSVP gerekli' : 'Herkese acik'),
  getVerificationBadge = () => null,
  isDark = false,
  loading = false,
}) {
  const timeChips = [
    { key: 'all', label: 'Tumu' },
    { key: 'live_now', label: 'Simdi Canli' },
    { key: 'starting_soon', label: 'Baslamak Uzere' },
    { key: 'tonight', label: 'Bu Gece' },
    { key: 'seats_available', label: 'Yer Var' },
  ];

  const superEvents = rituals.filter((r) => r?.type === 'Special Event' || r?.is_special_event).slice(0, 2);
  const normalRituals = rituals;

  const renderSuperEvent = (r) => {
    const img = pulseGridCardImage(r, 0);
    return (
      <TouchableOpacity key={`sp-${r.id}`} style={styles.superCard} onPress={() => onRitualPress(r)} activeOpacity={0.9}>
        <Image source={{ uri: img }} style={styles.superImg} />
        <View style={styles.superOverlay} />
        <View style={styles.superLayer}>
          <View style={styles.superTop}>
            <View style={styles.superBadge}><Text style={styles.superBadgeText}>★ SUPER EVENT</Text></View>
            <View style={styles.superSeat}><Text style={styles.superSeatText}>{r?.current_attendees || 0} kisi</Text></View>
          </View>
          <View style={styles.superBottom}>
            <View style={{ flex: 1 }}>
              <Text style={styles.superTitle} numberOfLines={2}>{cleanRitualTitle(r?.title) || 'Etkinlik'}</Text>
              <Text style={styles.superMeta} numberOfLines={1}>{r?.venue_name || 'Mekan'} · {formatHour(r?.start_time)}</Text>
            </View>
            <View style={styles.superAction}><Text style={styles.superActionText}>Gor</Text></View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderRitualRow = ({ item, index }) => {
    const image = pulseGridCardImage(item, index);
    const badge = getVerificationBadge(item);
    const isLive = item?.status === 'live';
    const isTonightFilter = timeFilter === 'tonight';
    const tonightBadge = `🌙 Gece Takvimi · ${formatHour(item?.start_time)}`;

    return (
      <TouchableOpacity
        style={[styles.row, isTonightFilter && styles.rowTonight]}
        onPress={() => onRitualPress(item)}
        activeOpacity={0.86}
      >
        <View style={styles.thumbWrap}>
          <Image source={{ uri: image }} style={styles.thumb} />
        </View>
        <View style={styles.body}>
          {isTonightFilter ? (
            <View style={styles.tonightBadge}>
              <Text style={styles.tonightBadgeText} numberOfLines={1}>{tonightBadge}</Text>
            </View>
          ) : null}
          <Text style={[styles.time, isLive && styles.timeLive]}>{isLive ? `● ${formatHour(item?.start_time)} · CANLI` : formatHour(item?.start_time)}</Text>
          <Text style={styles.name} numberOfLines={1}>{cleanRitualTitle(item?.title) || 'Ritual'}</Text>
          <Text style={styles.meta} numberOfLines={1}>📍 {item?.venue_name || 'Mekan'} · {item?.current_attendees || 0} kisi</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, styles.badgeNavy]}><Text style={[styles.badgeText, styles.badgeNavyText]}>{getEntryTypeText(item)}</Text></View>
            {badge ? <View style={[styles.badge, styles.badgeGreen]}><Text style={[styles.badgeText, styles.badgeGreenText]}>✓ {badge}</Text></View> : null}
          </View>
        </View>
        <View style={styles.actionCol}>
          <View style={[styles.actionBtn, isTonightFilter ? styles.actionBtnTonight : styles.actionBtnDark]}>
            <Text style={styles.actionText}>{isLive ? 'Katil' : 'Gor'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.searchWrap, isDark && styles.searchWrapDark]}>
        <TextInput
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder="Ritual ara (Enter → Local World)"
          placeholderTextColor={isDark ? '#94a3b8' : '#a3a3a3'}
          style={[styles.searchInput, isDark && styles.searchInputDark]}
          returnKeyType="search"
          onSubmitEditing={() => onSearchSubmit?.()}
        />
        {onSearchSubmit ? (
          <TouchableOpacity style={styles.localWorldBtn} onPress={() => onSearchSubmit()} activeOpacity={0.85}>
            <Text style={styles.localWorldBtnText}>Local World</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.timeChipScroll}
        contentContainerStyle={styles.timeChipRow}
      >
        {timeChips.map((chip) => {
          const active = timeFilter === chip.key;
          return (
            <TouchableOpacity
              key={chip.key}
              style={[styles.timeChip, active && styles.timeChipActive]}
              onPress={() => onTimeFilterChange?.(chip.key)}
              activeOpacity={0.86}
            >
              <Text style={[styles.timeChipText, active && styles.timeChipTextActive]}>{chip.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionText}>RITUELLER</Text>
        <View style={styles.sectionLine} />
        <Text style={styles.sectionCount}>{normalRituals.length} aktif</Text>
      </View>

      <FlatList
        data={normalRituals}
        keyExtractor={(item, idx) => String(item?.id || idx)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={hasMore ? onLoadMore : null}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyTitle, isDark && styles.emptyTitleDark]}>Bu filtrede Ritual yok</Text>
              <Text style={styles.emptySub}>Sehrindeki acik Ritual bulunamadi. Local World haritasina bakabilirsin.</Text>
              {String(searchQuery || '').trim() ? (
                <TouchableOpacity
                  style={styles.nominateEmptyBtn}
                  onPress={async () => {
                    try {
                      await nominateVenuePlace({
                        source: 'empty_search',
                        name: String(searchQuery).trim(),
                        note: 'empty_search',
                      });
                      Alert.alert('Tesekkurler', 'Mekan onerin havuza dustu');
                    } catch (e) {
                      Alert.alert('Hata', e?.message || 'Oneri gonderilemedi');
                    }
                  }}
                >
                  <Text style={styles.nominateEmptyBtnText}>Mekan öner</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null
        }
        ListHeaderComponent={
          <View>
            {superEvents.length > 0 ? (
              <>
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionText}>★ BUYUK ETKINLIKLER</Text>
                  <View style={styles.sectionLine} />
                </View>
                {superEvents.map(renderSuperEvent)}
              </>
            ) : null}
          </View>
        }
        renderItem={renderRitualRow}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  containerDark: { backgroundColor: '#020617' },
  searchWrap: { backgroundColor: '#f5f5f5', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchWrapDark: { backgroundColor: '#111827' },
  searchInput: { flex: 1, fontSize: 13, color: '#374151', paddingVertical: 0 },
  searchInputDark: { color: '#e2e8f0' },
  localWorldBtn: { backgroundColor: '#1B2E4A', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  localWorldBtnText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  emptyWrap: { paddingVertical: 48, paddingHorizontal: 16, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },
  emptyTitleDark: { color: '#f8fafc' },
  emptySub: { fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 20 },
  nominateEmptyBtn: {
    marginTop: 16,
    backgroundColor: '#f9a13d',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  nominateEmptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  timeChipScroll: { flexGrow: 0, marginBottom: 6 },
  timeChipRow: { gap: 8, alignItems: 'center' },
  timeChip: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#f5f5f5' },
  timeChipActive: { backgroundColor: '#000', borderColor: '#000' },
  timeChipText: { fontSize: 11, color: '#525252', fontWeight: '600' },
  timeChipTextActive: { color: '#fff' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 2 },
  sectionText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: '#a3a3a3' },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#f5f5f5' },
  sectionCount: { fontSize: 9, fontWeight: '600', color: '#a3a3a3', backgroundColor: '#f5f5f5', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  superCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 10 },
  superImg: { width: '100%', height: 104 },
  superOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  superLayer: { ...StyleSheet.absoluteFillObject, padding: 10, justifyContent: 'space-between' },
  superTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  superBadge: { backgroundColor: 'rgba(124,58,237,0.85)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  superBadgeText: { fontSize: 8, fontWeight: '700', color: '#fff' },
  superSeat: { borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 8, paddingVertical: 2 },
  superSeatText: { fontSize: 9, color: 'rgba(255,255,255,0.95)', fontWeight: '600' },
  superBottom: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  superTitle: { fontFamily: FONT_SERIF, fontSize: 17, lineHeight: 20, color: '#fff' },
  superMeta: { marginTop: 1, fontSize: 9, color: 'rgba(255,255,255,0.72)' },
  superAction: { backgroundColor: '#fff', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 6 },
  superActionText: { fontSize: 10, fontWeight: '700', color: '#000' },
  listContent: { paddingTop: 4, paddingBottom: 100 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  rowTonight: { borderWidth: 1, borderColor: '#E8EDF4', borderRadius: 14, backgroundColor: '#FCFCFE', padding: 8 },
  rowLocked: { opacity: 0.56 },
  thumbWrap: { width: 60, height: 60, borderRadius: 12, overflow: 'hidden', backgroundColor: '#e5e7eb', position: 'relative' },
  thumb: { width: '100%', height: '100%' },
  thumbDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  lockEmoji: { fontSize: 18 },
  body: { flex: 1, minWidth: 0, paddingHorizontal: 10 },
  tonightBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1B2E4A',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
  },
  tonightBadgeText: { fontSize: 8, color: '#fff', fontWeight: '700' },
  time: { fontSize: 13, fontWeight: '700', color: '#000', marginBottom: 1 },
  timeLive: { color: '#dc2626' },
  name: { fontSize: 14, fontFamily: FONT_SERIF, color: '#000', marginBottom: 3 },
  meta: { fontSize: 9, color: '#a3a3a3', marginBottom: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  badge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 7, fontWeight: '700' },
  badgeNavy: { backgroundColor: '#e8edf4' },
  badgeNavyText: { color: '#1b2e4a' },
  badgeGreen: { backgroundColor: '#eaf3de' },
  badgeGreenText: { color: '#16a34a' },
  badgeRed: { backgroundColor: '#fee2e2' },
  badgeRedText: { color: '#dc2626' },
  actionCol: { flexShrink: 0 },
  actionBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  actionBtnDark: { backgroundColor: '#000' },
  actionBtnTonight: { backgroundColor: '#1B2E4A' },
  actionBtnLocked: { backgroundColor: '#f5f5f5' },
  actionText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  actionTextLocked: { color: '#a3a3a3' },
  sep: { height: 1, backgroundColor: '#f5f5f5', marginVertical: 8 },
});
