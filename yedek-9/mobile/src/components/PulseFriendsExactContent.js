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

const toDate = (r) => new Date(r?.start_time || Date.now());
const fmtHM = (r) => `${toDate(r).getHours().toString().padStart(2, '0')}:${toDate(r).getMinutes().toString().padStart(2, '0')}`;
const venue = (r, city) => r?.venue_name || r?.location_name || city;
const isLive = (r) => {
  const s = String(r?.status || '').toLowerCase();
  const t = String(r?.time_state || '').toLowerCase();
  if (s === 'live' || t === 'live_now') return true;
  const mins = Math.floor((Date.now() - toDate(r).getTime()) / 60000);
  return mins >= 0 && mins <= Math.max(90, Number(r?.duration || 90));
};

export default function PulseFriendsExactContent({
  pulseMemories = [],
  filteredRituals = [],
  friendPulseEvents = [],
  city = '',
  navigation,
  loading,
  refreshing,
  onRefresh,
  onSwitchToAll,
  isDark = false,
}) {
  const friendsRows = filteredRituals || [];
  const liveRituals = friendsRows.filter(isLive);
  const soonRituals = friendsRows.filter((r) => !isLive(r));
  const friendCount = friendsRows.filter((r) => Number(r.friends_here || 0) > 0).length;
  const memoryCount = pulseMemories.length;
  const inviteRows = friendsRows.filter((r) => Number(r.friends_here || 0) > 0).slice(0, 2);

  const heroLive = liveRituals[0] || null;
  const heroJoin = soonRituals.find((r) => Number(r.friends_here || 0) > 0) || soonRituals[0] || null;
  const memoryRows = pulseMemories.slice(0, 3);
  const activityRows = friendsRows.slice(0, 3);
  const mutual = friendPulseEvents[0] || null;

  const openRitual = (r) => r?.id && navigation.navigate('RitualDetail', { ritualId: r.id });

  const bubbles = useMemo(() => friendsRows.slice(0, 7), [friendsRows]);
  const empty = !loading && friendsRows.length === 0 && pulseMemories.length === 0 && friendPulseEvents.length === 0;

  const renderActivityRow = (key, label, sub, tone = 'memory', onPress) => (
    <TouchableOpacity key={key} style={[styles.aRow, tone === 'checkin' && styles.aRowCheckin, tone === 'invite' && styles.aRowInvite, isDark && styles.cardDark]} onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.aAccent, tone === 'checkin' ? styles.aAccentCheckin : tone === 'invite' ? styles.aAccentInvite : styles.aAccentMemory]} />
      <View style={styles.aIcon}><Text style={styles.aIconTxt}>{tone === 'checkin' ? '📍' : tone === 'invite' ? '🎟' : '📸'}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.aWho, isDark && styles.textDark]} numberOfLines={1}>{label}</Text>
        <Text style={styles.aSub} numberOfLines={2}>{sub}</Text>
      </View>
      <View style={styles.aActions}>
        <Text style={styles.aGo}>Gor →</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={[styles.scroll, isDark && styles.scrollDark]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View style={styles.headerPattern} />
        <View style={styles.headerGlow} />
        <Text style={styles.hLabel}>👥 Baglantilar · Bugun</Text>
        <View style={styles.hRow}>
          <View>
            <Text style={styles.hTitle}>Arkadaslarin{'\n'}nerede?</Text>
            <Text style={styles.hSub}>{`${friendCount} aktif baglanti`}</Text>
          </View>
          <View style={styles.hAvs}>
            <View style={styles.hAvRow}>
              <View style={[styles.hAv, { backgroundColor: '#2A4470' }]}><Text style={styles.hAvTxt}>A</Text></View>
              <View style={[styles.hAv, { backgroundColor: '#4CAF50' }]}><Text style={styles.hAvTxt}>E</Text></View>
              <View style={[styles.hAv, { backgroundColor: '#C4956A' }]}><Text style={styles.hAvTxt}>M</Text></View>
              <View style={[styles.hAv, { backgroundColor: '#4F46E5' }]}><Text style={styles.hAvTxt}>L</Text></View>
            </View>
            <Text style={styles.hAvCount}>+3 aktif daha</Text>
          </View>
        </View>
        <View style={styles.hStats}>
          <Text style={styles.hPill}>{`● ${liveRituals.length} Ritualde`}</Text>
          <Text style={styles.hPill}>{`⏱ ${soonRituals.length} gidiyor`}</Text>
          <Text style={styles.hPill}>{`📸 ${memoryCount} ani`}</Text>
          <Text style={styles.hPill}>{`🎟 ${inviteRows.length} davet`}</Text>
        </View>
      </View>

      <Text style={styles.stripTitle}>Su An Neredeler</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bubbleRow}>
        {bubbles.map((r, i) => (
          <TouchableOpacity key={`b-${r.id || i}`} style={[styles.bubble, isLive(r) && styles.bubbleLive, !isLive(r) && styles.bubbleSoon]} onPress={() => openRitual(r)} activeOpacity={0.9}>
            <View style={styles.bAvatar}>
              <Text style={styles.bAvatarTxt}>{String((r.host_name || r.title || 'A')).slice(0, 1).toUpperCase()}</Text>
              <View style={[styles.bStatus, isLive(r) ? styles.bStatusLive : styles.bStatusSoon]} />
            </View>
            <Text style={styles.bName} numberOfLines={1}>{r.host_name || 'Arkadas'}</Text>
            <Text style={styles.bWhere} numberOfLines={2}>{r.title || 'Ritual'}</Text>
            <Text style={[styles.bTag, isLive(r) ? styles.bTagLive : styles.bTagSoon]}>{isLive(r) ? '● Canli' : `⏱ ${fmtHM(r)}`}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.filterRow}>
        {['Tumu', 'Canlilar', 'Anilar', 'Davet'].map((x, i) => (
          <Text key={x} style={[styles.fChip, i === 0 && styles.fChipOn]}>{x}</Text>
        ))}
      </View>

      <View style={styles.sectionHead}><View style={styles.line} /><Text style={[styles.sectionText, { color: '#dc2626' }]}>● Arkadaslarin Oldugu Rituals</Text><View style={styles.line} /><Text style={styles.count}>{Math.min(2, friendsRows.length)}</Text></View>

      {heroLive ? (
        <TouchableOpacity style={[styles.heroCard, styles.heroCardLive, isDark && styles.cardDark]} onPress={() => openRitual(heroLive)} activeOpacity={0.92}>
          <ImageBackground source={{ uri: heroLive.image_url || heroLive.cover_image_url || heroLive.venue_image_url || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=900&q=80' }} style={styles.hero} imageStyle={styles.heroImg}>
            <View style={styles.heroOverlay} />
            <View style={styles.heroTop}>
              <Text style={[styles.heroChip, styles.heroChipLive]}>● CANLI</Text>
              <Text style={styles.heroChipSoft}>{`${Number(heroLive.current_attendees || 0)} / ${Number(heroLive.capacity || 0) || '-'}`}</Text>
            </View>
            <View style={styles.heroBottom}>
              <Text style={styles.heroName}>{heroLive.title || 'Ritual'}</Text>
              <Text style={styles.heroVenue}>{`📍 ${venue(heroLive, city)}`}</Text>
            </View>
          </ImageBackground>
        </TouchableOpacity>
      ) : null}

      {heroJoin ? (
        <TouchableOpacity style={[styles.heroCard, styles.heroCardJoin, isDark && styles.cardDark]} onPress={() => openRitual(heroJoin)} activeOpacity={0.92}>
          <View style={styles.friendWho}>
            <Text style={styles.friendWhoText}>{`${Math.max(1, Number(heroJoin.friends_here || 1))} arkadas gidiyor`}</Text>
            <Text style={styles.friendLvl}>L1</Text>
          </View>
          <Text style={[styles.joinTitle, isDark && styles.textDark]} numberOfLines={1}>{heroJoin.title || 'Ritual'}</Text>
          <Text style={styles.joinSub}>{`${venue(heroJoin, city)} · ${fmtHM(heroJoin)}`}</Text>
          <View style={styles.joinTags}>
            <Text style={styles.joinTag}>Acik katilim</Text>
            <Text style={styles.joinTag}>{`${Number(heroJoin.current_attendees || 0)}/${Number(heroJoin.capacity || 0) || '-'}`}</Text>
          </View>
          <TouchableOpacity style={styles.joinBtn} onPress={() => openRitual(heroJoin)}><Text style={styles.joinBtnText}>Katil</Text></TouchableOpacity>
        </TouchableOpacity>
      ) : null}

      <View style={styles.sectionHead}><View style={styles.line} /><Text style={styles.sectionText}>Son Aktiviteler</Text><View style={styles.line} /></View>
      {memoryRows[0]
        ? renderActivityRow(
            `activity-memory-${memoryRows[0].id || memoryRows[0].ritual_id || '0'}`,
            `${memoryRows[0].user_name || 'Arkadas'} bir ani paylasti`,
            memoryRows[0].content || 'Ani paylasimi',
            'memory',
            () => openRitual({ id: memoryRows[0].ritual_id })
          )
        : null}
      {renderActivityRow('activity-checkin', 'Alessandro check-in yapti', 'Jazz Night at Blue Note', 'checkin', () => heroLive && openRitual(heroLive))}

      <View style={styles.sectionHead}><View style={styles.line} /><Text style={[styles.sectionText, { color: '#92400E' }]}>🎟 Gelen Davetler</Text><View style={styles.line} /><Text style={styles.count}>{inviteRows.length}</Text></View>
      {inviteRows.map((r, i) => (
        <TouchableOpacity key={`inv-${r.id || i}`} style={[styles.invite, isDark && styles.cardDark]} onPress={() => openRitual(r)} activeOpacity={0.9}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.invWho, isDark && styles.textDark]} numberOfLines={1}>{`${r.host_name || 'Arkadas'} seni davet etti`}</Text>
            <Text style={styles.invMeta} numberOfLines={1}>{`${r.title || 'Ritual'} · ${fmtHM(r)}`}</Text>
            <View style={styles.invTags}>
              <Text style={styles.invTag}>Davetli</Text>
              <Text style={styles.invTag}>{`${Number(r.current_attendees || 0)}/${Number(r.capacity || 0) || '-'}`}</Text>
            </View>
          </View>
          <View style={styles.invBtns}>
            <Text style={styles.invAccept}>Kabul Et</Text>
            <Text style={styles.invDecline}>Reddet</Text>
          </View>
        </TouchableOpacity>
      ))}

      <View style={styles.sectionHead}><View style={styles.line} /><Text style={styles.sectionText}>Birlikte Gidebilirsin</Text><View style={styles.line} /><Text style={styles.count}>{activityRows.length}</Text></View>
      {activityRows.map((r, i) =>
        renderActivityRow(
          `activity-invite-${r.id || i}`,
          `${r.host_name || 'Host'} bu aksam musait`,
          `${r.title || 'Ritual'} · ${venue(r, city)}`,
          'invite',
          () => openRitual(r)
        )
      )}

      {mutual
        ? renderActivityRow(
            `activity-mutual-${mutual.ritual_id || '0'}`,
            'L2 arkadasliga 2 Ritual kaldi',
            mutual.ritual_title || 'Ortak Ritual',
            'checkin',
            () => mutual.ritual_id && navigation.navigate('RitualDetail', { ritualId: mutual.ritual_id })
          )
        : null}

      {empty ? (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyTitle, isDark && styles.textDark]}>Arkadas aktivitesi yok</Text>
          <Text style={styles.emptySub}>Henuz baglanti aktivitesi gorunmuyor.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={onSwitchToAll}>
            <Text style={styles.emptyBtnText}>Ritualse bak</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f0f0f0' },
  scrollDark: { backgroundColor: PULSE.screenDark },
  content: { paddingBottom: 120 },
  header: { marginHorizontal: 16, marginBottom: 14, borderRadius: 20, overflow: 'hidden', padding: 16, backgroundColor: '#4F46E5' },
  headerPattern: { ...StyleSheet.absoluteFillObject, opacity: 0.07, backgroundColor: '#fff' },
  headerGlow: { position: 'absolute', top: -30, right: -30, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.06)' },
  hLabel: { fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '700', marginBottom: 7 },
  hRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  hTitle: { fontSize: 22, color: '#fff', lineHeight: 26, marginBottom: 3 },
  hSub: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 12 },
  hAvs: { alignItems: 'flex-end', gap: 3 },
  hAvRow: { flexDirection: 'row' },
  hAv: { width: 28, height: 28, borderRadius: 14, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  hAvTxt: { color: '#fff', fontSize: 11, fontWeight: '600' },
  hAvCount: { fontSize: 9, color: 'rgba(255,255,255,0.45)' },
  hStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hPill: { fontSize: 10, color: 'rgba(255,255,255,0.8)', backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.18)', borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4, fontWeight: '600' },
  stripTitle: { paddingHorizontal: 18, paddingBottom: 6, fontSize: 10, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '700' },
  bubbleRow: { paddingHorizontal: 16, gap: 8, marginBottom: 10 },
  bubble: { width: 100, borderRadius: 14, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 10, alignItems: 'center' },
  bubbleLive: { borderColor: 'rgba(220,38,38,0.25)' },
  bubbleSoon: { borderColor: 'rgba(217,119,6,0.2)' },
  bAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  bAvatarTxt: { fontSize: 17, color: '#fff' },
  bStatus: { position: 'absolute', right: 0, bottom: 0, width: 13, height: 13, borderRadius: 7, borderWidth: 2.5, borderColor: '#fff' },
  bStatusLive: { backgroundColor: '#dc2626' },
  bStatusSoon: { backgroundColor: '#d97706' },
  bName: { fontSize: 10, color: '#111827', fontWeight: '600', marginBottom: 3 },
  bWhere: { fontSize: 8, color: '#9ca3af', lineHeight: 12, textAlign: 'center', marginBottom: 5 },
  bTag: { fontSize: 7, fontWeight: '700', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  bTagLive: { backgroundColor: '#fee2e2', color: '#dc2626' },
  bTagSoon: { backgroundColor: '#fef3c7', color: '#d97706' },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginBottom: 10 },
  fChip: { fontSize: 10, color: '#6b7280', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, fontWeight: '600' },
  fChipOn: { backgroundColor: '#4F46E5', borderColor: '#4F46E5', color: '#fff' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingBottom: 6 },
  line: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  sectionText: { fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.7, fontWeight: '700' },
  count: { fontSize: 9, color: '#a3a3a3', backgroundColor: '#f3f4f6', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  heroCard: { marginHorizontal: 16, marginBottom: 8, borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', overflow: 'hidden' },
  heroCardLive: { borderColor: 'rgba(220,38,38,0.2)' },
  heroCardJoin: { borderColor: 'rgba(79,70,229,0.2)', padding: 12 },
  hero: { height: 140, justifyContent: 'space-between' },
  heroImg: { resizeMode: 'cover' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.42)' },
  heroTop: { paddingTop: 10, paddingHorizontal: 10, flexDirection: 'row', justifyContent: 'space-between' },
  heroBottom: { paddingHorizontal: 12, paddingBottom: 9 },
  heroName: { fontSize: 17, color: '#fff', marginBottom: 2 },
  heroVenue: { fontSize: 10, color: 'rgba(255,255,255,0.55)' },
  heroChip: { fontSize: 8, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, fontWeight: '700' },
  heroChipLive: { backgroundColor: '#DC2626', color: '#fff' },
  heroChipSoft: { fontSize: 9, color: 'rgba(255,255,255,0.85)', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, fontWeight: '600' },
  friendWho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingVertical: 7, paddingHorizontal: 10, backgroundColor: 'rgba(79,70,229,0.05)', borderColor: 'rgba(79,70,229,0.1)', borderWidth: 1, borderRadius: 10 },
  friendWhoText: { fontSize: 11, color: '#111827' },
  friendLvl: { fontSize: 8, color: '#fff', backgroundColor: '#1B2E4A', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, fontWeight: '700' },
  joinTitle: { fontSize: 15, color: '#111827', marginBottom: 3 },
  joinSub: { fontSize: 10, color: '#9ca3af', marginBottom: 8 },
  joinTags: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  joinTag: { fontSize: 8, color: '#92400E', backgroundColor: '#fef3c7', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, fontWeight: '600' },
  joinBtn: { alignSelf: 'flex-end', backgroundColor: '#4F46E5', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 9 },
  joinBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  aRow: { marginHorizontal: 16, marginBottom: 7, borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', gap: 10, alignItems: 'flex-start', overflow: 'hidden' },
  aRowRs: { borderColor: 'rgba(22,163,74,0.2)' },
  aRowCheckin: { borderColor: 'rgba(79,70,229,0.15)' },
  aRowInvite: { borderColor: 'rgba(200,169,106,0.25)' },
  aAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  aAccentMemory: { backgroundColor: '#1B2E4A' },
  aAccentRs: { backgroundColor: '#16A34A' },
  aAccentCheckin: { backgroundColor: '#4F46E5' },
  aAccentInvite: { backgroundColor: '#C8A96A' },
  aIcon: { width: 40, height: 40, borderRadius: 11, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' },
  aIconTxt: { fontSize: 18 },
  aWho: { fontSize: 11, color: '#111827', marginBottom: 2 },
  aSub: { fontSize: 12, color: '#525252', lineHeight: 18 },
  aReacts: { flexDirection: 'row', gap: 6, marginTop: 4 },
  aReact: { fontSize: 10, color: '#6b7280', backgroundColor: '#f3f4f6', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  aActions: { gap: 4, alignItems: 'flex-end' },
  aSave: { fontSize: 13, color: '#6b7280', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  aGo: { fontSize: 10, color: '#6b7280', fontWeight: '700' },
  invite: { marginHorizontal: 16, marginBottom: 8, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(200,169,106,0.3)', backgroundColor: 'rgba(200,169,106,0.06)', paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  invWho: { fontSize: 12, color: '#111827', marginBottom: 1 },
  invMeta: { fontSize: 10, color: '#9ca3af' },
  invTags: { flexDirection: 'row', gap: 4, marginTop: 4 },
  invTag: { fontSize: 8, color: '#1b2e4a', backgroundColor: '#e8edf4', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, fontWeight: '600' },
  invBtns: { gap: 5 },
  invAccept: { fontSize: 11, color: '#000', backgroundColor: '#C8A96A', borderRadius: 9, paddingHorizontal: 13, paddingVertical: 8, fontWeight: '700' },
  invDecline: { fontSize: 11, color: '#737373', backgroundColor: '#f3f4f6', borderRadius: 9, paddingHorizontal: 13, paddingVertical: 8, fontWeight: '700' },
  emptyWrap: { paddingVertical: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 18, color: '#111827', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 16 },
  emptyBtn: { backgroundColor: '#000', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cardDark: { backgroundColor: '#111827', borderColor: '#374151' },
  textDark: { color: '#f9fafb' },
});
