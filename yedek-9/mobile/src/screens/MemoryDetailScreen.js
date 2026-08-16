import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ImageBackground, Platform, Alert } from 'react-native';
import { fetchMemoryDetail, createModReport } from '../services/api';
import ReportModal from '../components/ReportModal';
import useAuthStore from '../store/authStore';

const TYPE_TABS = [
  { key: 'photo', label: '📸 Fotograf' },
  { key: 'quote', label: '💬 Alinti' },
  { key: 'playlist', label: '🎵 Calma Listesi' },
  { key: 'voice', label: '🎙 Sesli Not' },
];

function inferType(memory) {
  const t = String(memory?.type || memory?.memory_type || '').toLowerCase();
  if (t.includes('playlist')) return 'playlist';
  if (t.includes('voice')) return 'voice';
  if (t.includes('quote')) return 'quote';
  return 'photo';
}

export default function MemoryDetailScreen({ route, navigation }) {
  const routeMemory = route.params?.memory || {};
  const [memory, setMemory] = useState(routeMemory);
  const [selectedType, setSelectedType] = useState(inferType(routeMemory));
  const [showReport, setShowReport] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    let mounted = true;
    const loadFullMemory = async () => {
      if (!routeMemory?.id) return;
      const full = await fetchMemoryDetail(routeMemory.id);
      if (!mounted || !full) return;
      setMemory((prev) => ({ ...prev, ...full }));
      setSelectedType(inferType({ ...routeMemory, ...full }));
    };
    loadFullMemory();
    return () => {
      mounted = false;
    };
  }, [routeMemory?.id]);

  const flList = Array.isArray(memory?.visible_to_levels) ? memory.visible_to_levels : ['FL1', 'FL2'];
  const sharedPeople = Array.isArray(memory?.shared_with_names) ? memory.shared_with_names : [];
  const heroUri = memory?.image_url || memory?.photo_url || memory?.content_url || `https://picsum.photos/seed/memory-${memory?.id || 'x'}/900/700`;
  const quoteText = memory?.content_text || memory?.content || 'Paylasilan alinti';
  const playlistUrl = memory?.spotify_playlist_url || memory?.external_url || null;
  const voiceUrl = memory?.content_url || memory?.audio_url || null;
  const voiceDuration = memory?.duration_seconds ? `${Math.floor(memory.duration_seconds / 60)}:${String(memory.duration_seconds % 60).padStart(2, '0')}` : '1:47';

  const rsDelta = useMemo(() => {
    const v = Number(memory?.rs_delta ?? 0.09);
    return `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
  }, [memory?.rs_delta]);

  return (
    <View style={styles.container}>
      <View style={styles.typeSwitcher}>
        <Text style={styles.switchLabel}>Ani tipi:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {TYPE_TABS.map((t) => (
            <TouchableOpacity key={t.key} style={[styles.tabChip, selectedType === t.key && styles.tabChipOn]} onPress={() => setSelectedType(t.key)}>
              <Text style={[styles.tabChipText, selectedType === t.key && styles.tabChipTextOn]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>← Geri</Text></TouchableOpacity>
          <View style={styles.topIcons}>
            <TouchableOpacity style={styles.topIcon} onPress={() => setShowReport(true)}>
              <Text>⚑</Text>
            </TouchableOpacity>
            <View style={styles.topIcon}><Text>↗</Text></View>
            <View style={styles.topIcon}><Text>···</Text></View>
          </View>
        </View>

        <ImageBackground source={{ uri: heroUri }} style={styles.hero} imageStyle={styles.heroImg}>
          <View style={styles.heroCounter}><Text style={styles.heroCounterText}>1 / 1</Text></View>
        </ImageBackground>

        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.smallLabel}>RITUEL ANISI · {selectedType.toUpperCase()}</Text>
            <Text style={styles.ritualName}>{memory?.ritual_title || '-'}</Text>
            <Text style={styles.venue}>📍 {memory?.ritual_title ? 'Ritual baglami' : 'Ritual'} · {memory?.created_at ? 'Bugun' : '-'}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaChip}>📅 {memory?.created_at ? 'Bu aksam' : '-'}</Text>
              <Text style={[styles.metaChip, styles.metaChipGreen]}>▲ {rsDelta} RS</Text>
              <Text style={[styles.metaChip, styles.metaChipNavy]}>{memory?.is_pulse_shared ? 'Ritual + Pulse' : 'Yalnizca Ritual'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.authorRow}>
            <View style={styles.authorAv}><Text style={styles.authorAvText}>{(memory?.author_name || 'A').charAt(0)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.authorName}>{memory?.author_name || 'Paylasan'}</Text>
              <Text style={styles.authorMeta}>{memory?.created_at || 'Simdi'}</Text>
            </View>
            <View style={styles.followBtn}><Text style={styles.followBtnText}>+ Takip Et</Text></View>
          </View>

          <View style={styles.divider} />

          {selectedType === 'quote' ? (
            <View style={styles.quoteBlock}>
              <Text style={styles.quoteText}>"{quoteText}"</Text>
              <Text style={styles.quoteFrom}>{memory?.author_name || 'Kullanici'} · anidan</Text>
            </View>
          ) : selectedType === 'playlist' ? (
            <View style={styles.playlistBlock}>
              <Text style={styles.playlistTitle}>{memory?.caption || memory?.content_text || 'Ritual Calma Listesi'}</Text>
              <Text style={styles.playlistMeta}>{playlistUrl || 'Spotify baglantisi yok'}</Text>
            </View>
          ) : selectedType === 'voice' ? (
            <View style={styles.voiceBlock}>
              <View style={styles.voicePlay}><Text>▶</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.voiceMeta}>Sesli Not · {voiceDuration}</Text>
                <Text style={styles.voiceSub}>{memory?.content_text || memory?.caption || memory?.content || 'Sesli not transkripti yok'}</Text>
                {voiceUrl ? <Text style={styles.voiceLink}>{voiceUrl}</Text> : null}
              </View>
            </View>
          ) : (
            <View style={styles.photoGrid}>
              <Image source={{ uri: heroUri }} style={styles.mainPhoto} />
              <View style={styles.thumbRow}>
                <Image source={{ uri: heroUri }} style={styles.thumb} />
                <Image source={{ uri: heroUri }} style={styles.thumb} />
                <Image source={{ uri: heroUri }} style={styles.thumb} />
              </View>
            </View>
          )}

          <View style={styles.sectionPad}>
            <Text style={styles.sectionTitle}>FL'li Kisiler</Text>
            <Text style={styles.value}>{sharedPeople.length ? sharedPeople.join(', ') : "Yalnizca izinli baglanti seviyeleri gorur"}</Text>
            <Text style={styles.value}>Gorunurluk: {flList.join(', ')}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.ctaBar}>
        <View style={styles.ctaRow}>
          <View style={styles.ctaIcon}><Text>🔖</Text></View>
          <TouchableOpacity style={styles.ctaMain}><Text style={styles.ctaMainText}>Aniyi Paylas</Text></TouchableOpacity>
          <View style={styles.ctaIcon}><Text>🔥</Text></View>
        </View>
      </View>

      <ReportModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        reportType={selectedType === 'quote' ? 'quote' : 'memory'}
        onReport={async (payload) => {
          try {
            await createModReport({
              targetType: selectedType === 'quote' ? 'quote' : 'memory',
              targetId: memory?.id,
              ritualId: memory?.ritual_id,
              categoryKey: payload.category_key || payload.reason,
              description: payload.description,
            });
            Alert.alert('Rapor', 'İletildi');
            setShowReport(false);
          } catch (e) {
            Alert.alert('Hata', e?.message || 'Rapor gönderilemedi');
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  typeSwitcher: {
    position: 'absolute', top: 44, left: 0, right: 0, zIndex: 20,
    paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e5e5e5',
    backgroundColor: 'rgba(255,255,255,0.97)', flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  switchLabel: { fontSize: 10, fontWeight: '600', color: '#737373' },
  tabRow: { gap: 4, paddingRight: 8 },
  tabChip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, borderWidth: 1.5, borderColor: '#e5e5e5' },
  tabChipOn: { backgroundColor: '#000', borderColor: '#000' },
  tabChipText: { fontSize: 10, color: '#737373', fontWeight: '600' },
  tabChipTextOn: { color: '#fff' },
  scrollContent: { paddingTop: 92, paddingBottom: 110 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  back: { fontSize: 12, color: '#737373' },
  topIcons: { flexDirection: 'row', gap: 8 },
  topIcon: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: '#e5e5e5', alignItems: 'center', justifyContent: 'center' },
  hero: { height: 300, width: '100%' },
  heroImg: { resizeMode: 'cover' },
  heroCounter: { position: 'absolute', top: 12, right: 14, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  heroCounterText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  card: { backgroundColor: '#fff' },
  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 },
  smallLabel: { fontSize: 9, fontWeight: '700', color: '#a3a3a3', letterSpacing: 1 },
  ritualName: { fontSize: 20, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', marginTop: 6 },
  venue: { fontSize: 11, color: '#a3a3a3', marginTop: 4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  metaChip: { fontSize: 9, fontWeight: '700', color: '#525252', backgroundColor: '#f5f5f5', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  metaChipGreen: { backgroundColor: '#EAF3DE', color: '#16A34A' },
  metaChipNavy: { backgroundColor: '#E8EDF4', color: '#1B2E4A' },
  divider: { height: 1, backgroundColor: '#f5f5f5' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 10 },
  authorAv: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e5e7eb', borderWidth: 2, borderColor: '#e5e5e5', alignItems: 'center', justifyContent: 'center' },
  authorAvText: { fontSize: 14, color: '#525252', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  authorName: { fontSize: 12, color: '#000', fontWeight: '600' },
  authorMeta: { fontSize: 10, color: '#a3a3a3' },
  followBtn: { borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  followBtnText: { fontSize: 10, fontWeight: '700', color: '#000' },
  quoteBlock: { marginHorizontal: 18, marginVertical: 14, backgroundColor: '#F2F5F9', borderWidth: 1, borderColor: '#E8EDF4', borderLeftWidth: 3, borderLeftColor: '#1B2E4A', borderRadius: 12, padding: 14 },
  quoteText: { fontSize: 17, color: '#1B2E4A', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontStyle: 'italic', lineHeight: 28 },
  quoteFrom: { marginTop: 8, fontSize: 10, color: '#2A4470' },
  playlistBlock: { marginHorizontal: 18, marginVertical: 14, borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 14, padding: 14, backgroundColor: '#fff' },
  playlistTitle: { fontSize: 14, fontWeight: '700', color: '#000', marginBottom: 4 },
  playlistMeta: { fontSize: 10, color: '#737373' },
  voiceBlock: { marginHorizontal: 18, marginVertical: 14, borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  voicePlay: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1B2E4A', alignItems: 'center', justifyContent: 'center' },
  voiceMeta: { fontSize: 11, color: '#525252' },
  voiceSub: { marginTop: 3, fontSize: 11, color: '#737373' },
  voiceLink: { marginTop: 4, fontSize: 10, color: '#1B2E4A' },
  photoGrid: { paddingHorizontal: 18, paddingVertical: 14 },
  mainPhoto: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14, marginBottom: 4 },
  thumbRow: { flexDirection: 'row', gap: 4 },
  thumb: { flex: 1, aspectRatio: 1, borderRadius: 9 },
  sectionPad: { paddingHorizontal: 18, paddingBottom: 14 },
  sectionTitle: { fontSize: 16, color: '#000', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', marginBottom: 8 },
  value: { color: '#111827', lineHeight: 20, fontSize: 14, marginTop: 4 },
  ctaBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.98)', borderTopWidth: 1, borderTopColor: '#e5e5e5', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28 },
  ctaRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  ctaIcon: { width: 44, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e5e5', alignItems: 'center', justifyContent: 'center' },
  ctaMain: { flex: 1, backgroundColor: '#1B2E4A', borderRadius: 13, paddingVertical: 13, alignItems: 'center' },
  ctaMainText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
