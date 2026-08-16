import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function DSVenueProDashboardScreen({ route, navigation }) {
  const venueName = route.params?.venueName || 'Mekan';
  const venue = route.params?.venue || null;
  const rituals = Array.isArray(route.params?.rituals) ? route.params.rituals : [];
  const venueId = route.params?.venueId || venue?.id || null;
  const proEnabled = Boolean(venue?.pro_enabled);

  const computed = useMemo(() => {
    const source = rituals.length > 0
      ? rituals
      : [
          { type: 'Coffee', start_time: new Date().toISOString(), current_attendees: 8, capacity: 12 },
          { type: 'Music', start_time: new Date(Date.now() + 3600000).toISOString(), current_attendees: 14, capacity: 18 },
          { type: 'Sports', start_time: new Date(Date.now() + 7200000).toISOString(), current_attendees: 9, capacity: 14 },
          { type: 'Arts', start_time: new Date(Date.now() + 10800000).toISOString(), current_attendees: 11, capacity: 16 },
          { type: 'Debate', start_time: new Date(Date.now() + 14400000).toISOString(), current_attendees: 6, capacity: 10 },
        ];

    const typeGroups = {
      Students: ['Coffee', 'Debate', 'Book', 'Campus'],
      Creatives: ['Arts', 'Music', 'Photo', 'Design'],
      Sports: ['Sports', 'Run', 'Yoga', 'Wellness'],
      Researchers: ['Science', 'AI', 'Tech', 'Debate'],
    };

    const counts = { Ogrenciler: 0, Yaraticilar: 0, Spor: 0, Arastirmacilar: 0 };
    source.forEach((r) => {
      const t = String(r.type || '').toLowerCase();
      let assigned = false;
      Object.entries(typeGroups).forEach(([k, aliases]) => {
        if (assigned) return;
        if (aliases.some((a) => t.includes(a.toLowerCase()))) {
          if (k === 'Students') counts.Ogrenciler += 1;
          if (k === 'Creatives') counts.Yaraticilar += 1;
          if (k === 'Sports') counts.Spor += 1;
          if (k === 'Researchers') counts.Arastirmacilar += 1;
          assigned = true;
        }
      });
      if (!assigned) counts.Ogrenciler += 1;
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    const community = Object.entries(counts)
      .map(([name, value]) => ({ name, value, pct: Math.round((value / total) * 100) }))
      .sort((a, b) => b.value - a.value);

    const hourBuckets = Array(24).fill(0);
    source.forEach((r) => {
      const h = new Date(r.start_time || Date.now()).getHours();
      hourBuckets[h] += 1;
    });
    const peakHours = [18, 19, 20, 21, 10, 11, 12].map((h) => ({ hour: h, value: hourBuckets[h] || 0 }));
    const maxPeak = Math.max(...peakHours.map((x) => x.value), 1);

    const attendeesAvg =
      source.reduce((acc, r) => acc + Number(r.current_attendees || 0), 0) / (source.length || 1);
    const avgParticipantRs = Math.max(5.0, Math.min(8.9, 5 + attendeesAvg / 6));
    const qualityIndex = Math.max(0.55, Math.min(0.95, 0.58 + total * 0.035));

    return {
      community,
      peakHours,
      maxPeak,
      avgParticipantRs,
      qualityIndex,
      ritualsCount: total,
    };
  }, [rituals]);

  const fmtHour = (h) => `${String(h).padStart(2, '0')}:00`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>←</Text></TouchableOpacity>
        <Text style={styles.title}>OPERATÖR Gosterge Paneli</Text>
        <View style={{ width: 18 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroKicker}>{venueName} · OPERATÖR</Text>
          {!proEnabled ? <Text style={styles.passiveNote}>OPERATÖR ozellikleri bu mekanda aktif degil.</Text> : null}
          <Text style={styles.heroValue}>{computed.qualityIndex.toFixed(2)} / 1.00</Text>
          <Text style={styles.heroSub}>
            Topluluk tipleri, yogun saatler ve ortalama katilimci RS metrikleri.
          </Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillLabel}>Ritual</Text>
              <Text style={styles.heroPillValue}>{computed.ritualsCount}</Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillLabel}>Ort. RS</Text>
              <Text style={styles.heroPillValue}>{computed.avgParticipantRs.toFixed(1)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Topluluk Tipleri</Text>
          {computed.community.map((row) => (
            <View key={row.name} style={styles.row}>
              <Text style={styles.rowLabel}>{row.name}</Text>
              <View style={styles.rowBarTrack}>
                <View style={[styles.rowBarFill, { width: `${Math.max(8, row.pct)}%` }]} />
              </View>
              <Text style={styles.rowValue}>{row.pct}%</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Yogun Saatler</Text>
          <Text style={styles.meta}>Yuksek aktivite saatleri (son Ritual dagilimi)</Text>
          <View style={styles.graphRow}>
            {computed.peakHours.map((p, i) => (
              <View key={`${p.hour}-${i}`} style={styles.graphItem}>
                <View style={[styles.graphBar, { height: Math.max(10, Math.round((p.value / computed.maxPeak) * 78)) }]} />
                <Text style={styles.graphLabel}>{fmtHour(p.hour).slice(0, 2)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ort. Katilimci RS</Text>
          <View style={styles.rsRow}>
            <MaterialIcons name="trending-up" size={18} color="#16a34a" />
            <Text style={styles.rsBig}>{computed.avgParticipantRs.toFixed(1)}</Text>
            <Text style={styles.rsMeta}>genel</Text>
          </View>
          <Text style={styles.meta}>
            {computed.avgParticipantRs >= 7.5
              ? 'Yuksek guvenli katilimci profili'
              : 'Topluluk kalitesi gelisim trendinde'}
          </Text>
        </View>

        <View style={[styles.card, styles.lockedCard]}>
          <Text style={styles.cardTitle}>HAKİM Analizi</Text>
          <Text style={styles.meta}>Kilitli teaser. HAKİM pakette bolge kume haritasi acilir.</Text>
          <View style={styles.clusterSnap}>
            <View style={[styles.clusterDot, { left: '22%', top: '38%' }]} />
            <View style={[styles.clusterDot, { left: '47%', top: '24%' }]} />
            <View style={[styles.clusterDot, { left: '63%', top: '52%' }]} />
            <View style={[styles.clusterDot, { left: '78%', top: '34%' }]} />
          </View>
          <TouchableOpacity
            style={[styles.upgradeBtn, styles.upgradeBtnDisabled]}
            onPress={() => {}}
            disabled
          >
            <Text style={styles.upgradeText}>HAKİM'e Gec</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ececec', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 22, color: '#111' },
  title: { fontSize: 20, fontWeight: '700', color: '#111' },
  content: { padding: 16 },
  hero: { backgroundColor: '#b89252', borderRadius: 16, padding: 16, marginBottom: 12 },
  heroKicker: { color: '#fff7ed', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  passiveNote: { marginTop: 6, color: '#fff7ed', fontSize: 12, fontWeight: '700' },
  heroValue: { color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 6 },
  heroSub: { color: '#fff7ed', fontSize: 13, marginTop: 6 },
  heroStatsRow: { marginTop: 10, flexDirection: 'row', gap: 8 },
  heroPill: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  heroPillLabel: { color: '#fff7ed', fontSize: 10, fontWeight: '700' },
  heroPillValue: { color: '#fff', fontSize: 13, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#ececec', padding: 14, marginBottom: 10 },
  graphRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 100, marginTop: 6 },
  graphItem: { alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
  graphBar: { width: 14, borderRadius: 6, backgroundColor: '#b89252' },
  graphLabel: { marginTop: 4, fontSize: 10, color: '#6b7280', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  rowLabel: { width: 82, color: '#374151', fontSize: 12, fontWeight: '700' },
  rowBarTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#e5e7eb', overflow: 'hidden' },
  rowBarFill: { height: '100%', borderRadius: 4, backgroundColor: '#b89252' },
  rowValue: { width: 38, textAlign: 'right', color: '#111', fontSize: 12, fontWeight: '800' },
  rsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 6 },
  rsBig: { fontSize: 28, color: '#111827', fontWeight: '800', lineHeight: 32 },
  rsMeta: { fontSize: 12, color: '#6b7280', fontWeight: '700', marginBottom: 4 },
  lockedCard: { borderColor: '#d1d5db', backgroundColor: '#f9fafb' },
  clusterSnap: {
    marginTop: 10,
    marginBottom: 2,
    height: 76,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#eef2f7',
    overflow: 'hidden',
  },
  clusterDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#334155',
    opacity: 0.8,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#111', marginBottom: 8 },
  meta: { color: '#6b7280', fontSize: 13, lineHeight: 19 },
  upgradeBtn: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#111827', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  upgradeBtnDisabled: { opacity: 0.5 },
  upgradeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});
