import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ImageBackground,
} from 'react-native';
import { PULSE } from '../constants/pulseTheme';

const toStart = (ritual) => new Date(ritual?.start_time || Date.now());
const minsToStart = (ritual) => Math.max(0, Math.floor((toStart(ritual).getTime() - Date.now()) / 60000));
const fmtClock = (ritual) => {
  const d = toStart(ritual);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};
const fmtCountdown = (mins) => {
  if (mins >= 60) return `${Math.floor(mins / 60)}s ${mins % 60}dk`;
  return `${mins} dk`;
};

const isViewerRitual = (r) =>
  Boolean(
    r?.is_joined ||
      r?.viewer_joined ||
      r?.user_joined ||
      r?.joined_by_viewer ||
      String(r?.participation_status || '').toLowerCase() === 'joined'
  );

export default function PulseStartingSoonExactContent({
  rituals = [],
  city,
  navigation,
  refreshing = false,
  onRefresh,
  isDark = false,
}) {
  const sorted = useMemo(
    () => [...rituals].sort((a, b) => toStart(a).getTime() - toStart(b).getTime()),
    [rituals]
  );
  const first = sorted[0] || null;
  const viewerRitual = sorted.find((r) => isViewerRitual(r)) || first;

  const grouped = useMemo(() => {
    const map = new Map();
    sorted.forEach((r) => {
      const key = fmtClock(r);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return Array.from(map.entries());
  }, [sorted]);
  const totalSoon = sorted.length;
  const friendsTotal = sorted.reduce((acc, r) => acc + Number(r?.friends_here || 0), 0);

  const openRitual = (ritual) => {
    if (!ritual?.id) return;
    navigation.navigate('RitualDetail', { ritualId: ritual.id });
  };

  const withinHour = sorted.filter((r) => minsToStart(r) <= 60).length;
  const tonight = sorted.filter((r) => {
    const h = toStart(r).getHours();
    return h >= 18 || h < 2;
  }).length;
  const ringMins = first ? minsToStart(first) : 0;
  const ringPct = Math.max(0, Math.min(100, Math.round((ringMins / 90) * 100)));

  return (
    <ScrollView
      style={[styles.scroll, isDark && styles.scrollDark]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={[styles.context, isDark && styles.contextDark]}>
        <View style={styles.contextRow}>
          <View style={styles.ringWrap}>
            <View style={styles.ringOuter}>
              <View style={[styles.ringFill, { width: `${ringPct}%` }]} />
            </View>
            <View style={styles.ringInner}>
              <Text style={styles.ringNum}>{ringMins}</Text>
              <Text style={styles.ringUnit}>dk</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.contextTitle, isDark && styles.contextTitleDark]}>
              {first ? `Bir sonraki Rituale ${fmtCountdown(minsToStart(first))} kaldı` : 'Yakında başlayacak Ritual yok'}
            </Text>
            <Text style={[styles.contextSub, isDark && styles.contextSubDark]}>
              {`${city} içinde ${sorted.length} Ritual başlamak üzere · ${friendsTotal} arkadaş katılımı`}
            </Text>
            <View style={styles.countRow}>
              <View style={styles.countPill}>
                <Text style={styles.countText}>{`⏱ 60 dk içinde ${withinHour}`}</Text>
              </View>
              <View style={styles.countPill}>
                <Text style={styles.countText}>{`🌙 Bu akşam ${tonight}`}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {viewerRitual ? (
        <TouchableOpacity
          style={[styles.myCard, isDark && styles.myCardDark]}
          onPress={() => openRitual(viewerRitual)}
          activeOpacity={0.9}
        >
          <Text style={styles.myLabel}>KATILDIĞIN RİTÜEL · BEKLİYOR</Text>
          <View style={styles.myRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.myTitle} numberOfLines={1}>{viewerRitual.title || 'Ritual'}</Text>
              <Text style={styles.mySub} numberOfLines={1}>{`📍 ${viewerRitual.venue_name || city} · ${fmtClock(viewerRitual)}`}</Text>
            </View>
            <Text style={styles.myTimer}>{fmtCountdown(minsToStart(viewerRitual))}</Text>
          </View>
          <View style={styles.myTagRow}>
            <Text style={styles.myTag}>★ Pivot Host</Text>
            <Text style={styles.myTag}>{`${Number(viewerRitual.current_attendees || 0)} / ${Number(viewerRitual.capacity || 0) || '-'}`}</Text>
          </View>
          <TouchableOpacity style={styles.myBtn} onPress={() => openRitual(viewerRitual)}>
            <Text style={styles.myBtnText}>Bekle →</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      ) : null}

      {grouped.map(([slot, rows]) => (
        <View key={`slot-${slot}`}>
          <View style={styles.slotHeader}>
            <Text style={[styles.slotTime, isDark && styles.slotTimeDark]}>{slot}</Text>
            <View style={styles.slotLine} />
            <Text style={styles.slotBadge}>{`${fmtCountdown(minsToStart(rows[0]))} sonra · ${rows.length} Ritual`}</Text>
          </View>

          {rows.map((ritual, idx) => {
            const mins = minsToStart(ritual);
            const seats = Number(ritual.capacity || 0);
            const joined = Number(ritual.current_attendees || 0);
            const key = ritual.id || `soon-${slot}-${idx}`;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.card, isDark && styles.cardDark]}
                onPress={() => openRitual(ritual)}
                activeOpacity={0.93}
              >
                {idx === 0 ? (
                  <ImageBackground
                    source={{ uri: ritual.image_url || ritual.cover_image_url || ritual.venue_image_url || 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80' }}
                    style={styles.hero}
                    imageStyle={styles.heroImg}
                  >
                    <View style={styles.heroOverlay} />
                    <View style={styles.heroTop}>
                      <Text style={[styles.cdChip, mins <= 15 ? styles.cdChipUrgent : styles.cdChipSoon]}>
                        {fmtCountdown(mins)}
                      </Text>
                      {seats > 0 ? <Text style={styles.seatChipHero}>{`${joined} / ${seats} kişi`}</Text> : null}
                    </View>
                    <View style={styles.heroBottom}>
                      <Text style={styles.heroTitle} numberOfLines={1}>{ritual.title || 'Ritual'}</Text>
                      <Text style={styles.heroSub} numberOfLines={1}>{`📍 ${ritual.venue_name || city}`}</Text>
                    </View>
                  </ImageBackground>
                ) : null}

                <View style={styles.cardBody}>
                  {idx !== 0 ? (
                    <View style={styles.cardTop}>
                      <Text style={[styles.cdChip, mins <= 15 ? styles.cdChipUrgent : styles.cdChipSoon]}>
                        {fmtCountdown(mins)}
                      </Text>
                      {seats > 0 ? <Text style={styles.seatChip}>{`${joined}/${seats}`}</Text> : null}
                    </View>
                  ) : null}
                  {idx !== 0 ? <Text style={[styles.cardTitle, isDark && styles.cardTitleDark]} numberOfLines={1}>{ritual.title || 'Ritual'}</Text> : null}
                  <Text style={styles.cardSub} numberOfLines={1}>{`📍 ${ritual.venue_name || city}`}</Text>
                  <View style={styles.tagRow}>
                    <Text style={styles.tag}>{ritual.is_special_event ? '★ Super Event' : 'Başlamak Üzere'}</Text>
                    {ritual.is_host_verified ? <Text style={styles.tag}>✓ Verified Host</Text> : null}
                    {ritual.is_venue_verified ? <Text style={styles.tag}>✓ Verified Venue</Text> : null}
                    {ritual.friends_here > 0 ? <Text style={styles.tag}>{`👥 ${ritual.friends_here} arkadaş`}</Text> : null}
                  </View>
                  <View style={styles.footerRow}>
                    <View style={styles.footerLeft}>
                      <View style={styles.avatarStack}>
                        <View style={[styles.avatarMini, styles.avatarMiniA]}><Text style={styles.avatarMiniText}>A</Text></View>
                        <View style={[styles.avatarMini, styles.avatarMiniB]}><Text style={styles.avatarMiniText}>M</Text></View>
                        <View style={[styles.avatarMini, styles.avatarMiniC]}><Text style={styles.avatarMiniText}>L</Text></View>
                      </View>
                      <Text style={styles.footerText}>
                        {ritual.friends_here > 0 ? `${ritual.friends_here} arkadaşın gidiyor` : 'Bağlantın yok bu Ritualde'}
                      </Text>
                    </View>
                    <View style={styles.footerRight}>
                      <TouchableOpacity style={styles.saveBtn} onPress={() => {}}>
                        <Text style={styles.saveBtnText}>🔖</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.joinBtn} onPress={() => openRitual(ritual)}>
                        <Text style={styles.joinBtnText}>Katıl</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {sorted.length === 0 ? (
        <View style={[styles.empty, isDark && styles.emptyDark]}>
          <Text style={[styles.emptyTitle, isDark && styles.slotTimeDark]}>Başlamak üzere Ritual yok</Text>
          <Text style={styles.emptySub}>Bu akışta şu an Ritual yok. City Rhythm'den yeni Ritual bulabilirsin.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#ffffff' },
  scrollDark: { backgroundColor: PULSE.screenDark },
  content: { paddingBottom: 120 },
  context: {
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 2,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(217,119,6,0.2)',
    backgroundColor: '#fff8ed',
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ringWrap: { width: 52, height: 52, justifyContent: 'center', alignItems: 'center' },
  ringOuter: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: 'rgba(217,119,6,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.25)',
  },
  ringFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(217,119,6,0.35)',
  },
  ringInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff8ed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringNum: { fontSize: 14, color: '#b45309', fontWeight: '700', lineHeight: 16 },
  ringUnit: { fontSize: 7, color: '#b45309', fontWeight: '700', textTransform: 'uppercase' },
  contextDark: { backgroundColor: '#2a1b07', borderColor: '#6b4a1a' },
  contextTitle: { fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 3 },
  contextTitleDark: { color: '#fbbf24' },
  contextSub: { fontSize: 10, color: '#b45309' },
  contextSubDark: { color: '#fbbf24' },
  countRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  countPill: {
    backgroundColor: 'rgba(217,119,6,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.2)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  countText: { fontSize: 9, color: '#b45309', fontWeight: '700' },
  myCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 13,
    backgroundColor: '#1B2E4A',
  },
  myCardDark: { backgroundColor: '#0f172a' },
  myLabel: { fontSize: 9, color: '#9ca3af', fontWeight: '700', marginBottom: 6 },
  myRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  myTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  mySub: { color: '#cbd5e1', fontSize: 10, marginTop: 2 },
  myTimer: { color: '#C8A96A', fontSize: 14, fontWeight: '700' },
  myTagRow: { marginTop: 8, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  myTag: {
    fontSize: 8,
    color: '#e5e7eb',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontWeight: '700',
  },
  myBtn: {
    marginTop: 10,
    alignSelf: 'flex-end',
    backgroundColor: '#C8A96A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  myBtnText: { color: '#000', fontWeight: '700', fontSize: 11 },
  slotHeader: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slotTime: { fontSize: 22, color: '#000', minWidth: 54 },
  slotTimeDark: { color: '#f9fafb' },
  slotLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  slotBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#b45309',
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    maxWidth: 170,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(217,119,6,0.25)',
    backgroundColor: '#fff',
    padding: 0,
    overflow: 'hidden',
  },
  cardDark: { backgroundColor: '#111827', borderColor: '#374151' },
  hero: { height: 138, justifyContent: 'space-between' },
  heroImg: { resizeMode: 'cover' },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  heroTop: {
    paddingHorizontal: 10,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroBottom: { paddingHorizontal: 12, paddingBottom: 10 },
  heroTitle: { color: '#fff', fontSize: 17, fontWeight: '600', marginBottom: 2 },
  heroSub: { color: 'rgba(255,255,255,0.72)', fontSize: 10 },
  cardBody: { paddingHorizontal: 12, paddingVertical: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cdChip: { fontSize: 10, fontWeight: '700', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  cdChipSoon: { backgroundColor: '#fef3c7', color: '#b45309' },
  cdChipUrgent: { backgroundColor: '#fee2e2', color: '#dc2626' },
  seatChip: { fontSize: 9, color: '#737373', backgroundColor: '#f5f5f5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 },
  seatChipHero: {
    fontSize: 8,
    color: '#f3f4f6',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cardTitle: { fontSize: 15, color: '#000', fontWeight: '600', marginBottom: 3 },
  cardTitleDark: { color: '#f3f4f6' },
  cardSub: { fontSize: 10, color: '#a3a3a3', marginBottom: 6 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag: { fontSize: 8, color: '#525252', backgroundColor: '#f5f5f5', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, fontWeight: '600' },
  footerRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  footerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  avatarStack: { flexDirection: 'row', marginRight: 6 },
  avatarMini: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarMiniA: { backgroundColor: '#4a3728' },
  avatarMiniB: { backgroundColor: '#2d6a2d', marginLeft: -7 },
  avatarMiniC: { backgroundColor: '#1B2E4A', marginLeft: -7 },
  avatarMiniText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  footerText: { fontSize: 10, color: '#737373', flex: 1 },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  saveBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 13 },
  joinBtn: {
    backgroundColor: '#1B2E4A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  joinBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  empty: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fafafa',
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyDark: { backgroundColor: '#111827', borderColor: '#374151' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  emptySub: { fontSize: 11, color: '#9ca3af', textAlign: 'center' },
});

