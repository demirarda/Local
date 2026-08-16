import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { fetchRSHistory } from '../services/api';
import useAuthStore from '../store/authStore';

const PULSE_SCREEN_BG = '#f5f5f5';
const PULSE_CARD_BG = '#fff';
const PULSE_BORDER = '#e8e8e8';
const PULSE_TEXT = '#000';
const PULSE_SUBTLE = '#999';
const PULSE_DESC = '#666';
const GREEN = '#28a745';
const RED = '#dc3545';
const BADGE_ORANGE = '#ffa500';
const CHART_LINE = '#000';
const NAVY = '#0f1f4d';
const NAVY_CARD = '#11204a';

export default function RSTransparencyScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuthStore();
  const userId = route.params?.userId ?? user?.id;

  const [rsHistory, setRsHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    if (userId) loadRSHistory();
  }, [userId]);

  const loadRSHistory = async () => {
    try {
      setLoading(true);
      const data = await fetchRSHistory(userId, 10);
      setRsHistory(data);
    } catch (e) {
      console.error('Error loading RS history:', e);
      setRsHistory({ currentRS: null, feedbackCount: 0, changes: [] });
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (ritualId) => setExpandedId((prev) => (prev === ritualId ? null : ritualId));

  const getRSBadge = (rs) => {
    if (rs >= 9.0) return { label: 'Exceptional', color: '#2E7D32' };
    if (rs >= 7.5) return { label: 'Reliable', color: BADGE_ORANGE };
    if (rs >= 6.0) return { label: 'Established', color: '#2196F3' };
    if (rs >= 4.5) return { label: 'Developing', color: '#FF9800' };
    if (rs >= 3.0) return { label: 'Needs Care', color: RED };
    return { label: 'Critical', color: '#b71c1c' };
  };

  const formatRelativeTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    if (days < 14) return '1 week ago';
    if (days < 21) return '2 weeks ago';
    if (days < 30) return '3 weeks ago';
    return `${Math.floor(days / 7)} weeks ago`;
  };

  const getLevelLabel = (level) => (level && level.charAt(0).toUpperCase() + level.slice(1)) || '—';
  const getLevelColor = (level) => {
    if (level === 'high' || level === 'positive') return GREEN;
    if (level === 'mixed' || level === 'neutral') return '#FF9800';
    return RED;
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={PULSE_TEXT} />
      </View>
    );
  }

  const currentRS = rsHistory?.currentRS ?? null;
  const feedbackCount = rsHistory?.feedbackCount ?? 0;
  const changes = rsHistory?.changes ?? [];
  const hasData = currentRS != null && currentRS !== undefined;
  const flDistribution = rsHistory?.flDistribution || { FL0: 10, FL1: 25, FL2: 35, FL3: 20, CORE: 10 };
  const componentBars = [
    { key: 'Interaction', value: Math.max(0, Math.min(100, Math.round((rsHistory?.components?.interaction || 0.72) * 100))), color: '#22c55e' },
    { key: 'Context Fit', value: Math.max(0, Math.min(100, Math.round((rsHistory?.components?.context_fit || 0.68) * 100))), color: '#3b82f6' },
    { key: 'Integrity', value: Math.max(0, Math.min(100, Math.round((rsHistory?.components?.integrity || 0.61) * 100))), color: '#f59e0b' },
    { key: 'Diversity', value: Math.max(0, Math.min(100, Math.round((rsHistory?.components?.diversity || 0.55) * 100))), color: '#a855f7' },
  ];
  const rsDelta = Number(rsHistory?.rsDelta ?? (changes[0]?.delta || 0));
  const rsBadge = getRSBadge(currentRS || 0);
  const rsPct = Math.max(0, Math.min(100, (Number(currentRS || 0) / 10) * 100));
  const statusText = currentRS >= 7.5 ? 'Koklu' : currentRS >= 6 ? 'Guvenilir' : currentRS >= 4.5 ? 'Gelismekte' : 'Yeni';
  const miniBars = changes.slice(0, 10).reverse();
  const maxDeltaAbs = Math.max(0.01, ...miniBars.map((x) => Math.abs(Number(x.delta || 0))));
  const faqItems = [
    {
      id: 'q1',
      q: 'RS skorum nasil yukselir?',
      a: "Zamaninda katilim, ani paylasimi ve pozitif geri bildirim RS'i artirir.",
    },
    {
      id: 'q2',
      q: 'Tek Ritualde neden sinir var?',
      a: 'Algoritma dalgalanmayi azaltmak icin tek Ritual artis/azalisina cap uygular.',
    },
    {
      id: 'q3',
      q: 'BC4 bonusu ne zaman aktif olur?',
      a: 'Son 4 Ritualde tutarli pozitif seri oldugunda BC4 carpani guclenir.',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.statusBar}>
        <Text style={styles.sbTime}>9:41</Text>
        <Text style={styles.sbIcons}>▲▲▲</Text>
      </View>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.tbBack}>← Passport</Text>
        </TouchableOpacity>
        <Text style={styles.tbTitle}>RS Seffaflik</Text>
        <Pressable style={styles.tbInfo}>
          <Text style={styles.tbInfoText}>?</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroScore}>
          <View style={styles.hsBody}>
            <Text style={styles.hsLabel}>Guvenilirlik Skoru · LTE-3 v3</Text>
            <View style={styles.hsMain}>
              <Text style={styles.hsNum}>{hasData ? Number(currentRS).toFixed(1) : '—'}</Text>
              <View style={styles.hsRight}>
                <Text style={styles.hsStatus}>{statusText} · {rsDelta >= 0 ? 'Yukseliyor ↑' : 'Dusuyor ↓'}</Text>
                <View style={styles.hsTier}><Text style={styles.hsTierText}>{rsBadge.label}</Text></View>
                <View style={styles.hsDeltaRow}>
                  <Text style={[styles.hsDelta, rsDelta >= 0 ? styles.hsdPos : styles.hsdNeg]}>
                    {rsDelta >= 0 ? '+' : ''}{rsDelta.toFixed(2)}
                  </Text>
                  <Text style={styles.hsDeltaLabel}>Son Ritualden</Text>
                </View>
              </View>
            </View>
            <View style={styles.scaleRow}>
              {Array.from({ length: 10 }).map((_, i) => {
                const score = Number(currentRS || 0);
                const filled = i + 1 <= Math.floor(score);
                const partial = !filled && i < score;
                return <View key={i} style={[styles.scaleDot, filled ? styles.scaleDotFilled : partial ? styles.scaleDotPartial : styles.scaleDotEmpty, { width: i === 9 ? 12 : 8 }]} />;
              })}
              <Text style={styles.scaleLabel}>1 → 10</Text>
            </View>
            <View style={styles.hsBar}><View style={[styles.hsFill, { width: `${rsPct}%` }]} /></View>
            <Text style={styles.rsFeedback}>{feedbackCount} geri bildirim baz alinir</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tierRow}>
            <View style={[styles.tierChip, styles.tcPast]}><Text style={styles.tcTextPast}>Yeni (1.0)</Text></View>
            <View style={[styles.tierChip, styles.tcPast]}><Text style={styles.tcTextPast}>Gelismekte (3.0)</Text></View>
            <View style={[styles.tierChip, styles.tcPast]}><Text style={styles.tcTextPast}>Guvenilir (5.0)</Text></View>
            <View style={[styles.tierChip, styles.tcCurrent]}><Text style={styles.tcTextCurrent}>Koklu (7.0)</Text></View>
            <View style={[styles.tierChip, styles.tcFuture]}><Text style={styles.tcTextFuture}>Ust Duzey (8.0)</Text></View>
          </ScrollView>
        </View>

        <View style={styles.card}>
          <View style={styles.secHeader}>
            <Text style={styles.secTitle}>Son Ritual Hesabi</Text>
            <Text style={styles.secBadgeGreen}>{rsDelta >= 0 ? '+' : ''}{rsDelta.toFixed(2)} RS</Text>
          </View>
          <Text style={styles.secMeta}>{changes[0]?.ritualTitle || 'Son Ritual'} · {formatRelativeTime(changes[0]?.ritualDate) || 'Bugun'}</Text>
          <View style={styles.compBlock}>
            {componentBars.map((x) => (
              <View key={x.key} style={styles.compRow}>
                <Text style={styles.compLabel}>{x.key}</Text>
                <View style={styles.compTrack}><View style={[styles.compFill, { width: `${x.value}%`, backgroundColor: x.color }]} /></View>
                <Text style={styles.compValue}>{(x.value / 100).toFixed(2)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.formulaBlock}>
            <Text style={styles.fbLabel}>S_r Hesabi</Text>
            <Text style={styles.fbFormula}>A*0.25 + IQ*0.30 + CF*0.15 + M*0.05 - 0.15*IF</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.secHeader}>
            <Text style={styles.secTitle}>RS Gecmisi</Text>
            <Text style={styles.secInfo}>Tumu →</Text>
          </View>
          <View style={styles.chartBars}>
            {miniBars.length === 0 ? <Text style={styles.emptyTiny}>Veri yok</Text> : miniBars.map((c, i) => {
              const d = Number(c.delta || 0);
              const h = Math.max(4, (Math.abs(d) / maxDeltaAbs) * 52);
              return (
                <View key={`${c.ritualId ?? i}`} style={styles.chartBarCol}>
                  <View style={[styles.chartBar, d >= 0 ? styles.cbPos : styles.cbNeg, { height: h }]} />
                </View>
              );
            })}
          </View>
          {changes.map((ch) => {
            const positive = Number(ch.delta || 0) >= 0;
            const isExpanded = expandedId === ch.ritualId;
            return (
              <View key={ch.ritualId} style={styles.deltaRow}>
                <TouchableOpacity style={styles.deltaTop} onPress={() => toggleExpand(ch.ritualId)}>
                  <View style={[styles.drThumb, positive ? styles.drThumbPos : styles.drThumbNeg]} />
                  <View style={styles.drInfo}>
                    <Text style={styles.drName}>{ch.ritualTitle}</Text>
                    <Text style={styles.drMeta}>{formatRelativeTime(ch.ritualDate)}</Text>
                  </View>
                  <View style={styles.drRight}>
                    <Text style={[styles.drDelta, positive ? styles.drDeltaPos : styles.drDeltaNeg]}>{positive ? '+' : ''}{Number(ch.delta || 0).toFixed(2)}</Text>
                    <Text style={styles.drRs}>→ {Number(ch.afterRS || currentRS || 0).toFixed(2)}</Text>
                  </View>
                </TouchableOpacity>
                {isExpanded ? <Text style={styles.changeDescription}>{ch.reasonSummary || 'No detailed breakdown available'}</Text> : null}
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <View style={styles.secHeader}>
            <Text style={styles.secTitle}>Algoritma Sabitleri</Text>
            <Text style={styles.secBadgeNavy}>LTE-3 v3</Text>
          </View>
          {[
            ['K_UP', 'Pozitif Ritual katsayisi', '0.15'],
            ['K_DOWN', 'Negatif Ritual katsayisi', '0.30'],
            ['CAP_POS', 'Tek Ritual maksimum artis', '+0.12'],
            ['CAP_NEG', 'Tek Ritual maksimum dusus', '-0.15'],
            ['W_IF', 'Integrity friction agirligi', '0.20'],
          ].map((row) => (
            <View key={row[0]} style={styles.limitRow}>
              <Text style={styles.lrKey}>{row[0]}</Text>
              <Text style={styles.lrDesc}>{row[1]}</Text>
              <Text style={styles.lrVal}>{row[2]}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.secHeader}>
            <Text style={styles.secTitle}>Sik Sorulan Sorular</Text>
          </View>
          {faqItems.map((f) => {
            const open = openFaq === f.id;
            return (
              <TouchableOpacity key={f.id} style={styles.faqRow} onPress={() => setOpenFaq(open ? null : f.id)}>
                <View style={styles.faqQRow}>
                  <Text style={styles.faqQ}>{f.q}</Text>
                  <Text style={styles.faqArrow}>{open ? '⌄' : '›'}</Text>
                </View>
                {open ? <Text style={styles.faqA}>{f.a}</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.lteLink} onPress={() => navigation.navigate('LTE3Engine')} activeOpacity={0.85}>
          <Text style={styles.lteLinkTitle}>LTE-3 Trust Engine</Text>
          <Text style={styles.lteLinkSub}>12 adimli RS boru hatti ve sabitler</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F0F0' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 12, height: 44 },
  sbTime: { fontSize: 15, fontWeight: '600', color: '#000' },
  sbIcons: { fontSize: 12, color: '#000' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  tbBack: { fontSize: 13, color: '#1B2E4A', fontWeight: '600' },
  tbTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontFamily: 'serif', color: '#000' },
  tbInfo: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E8EDF4', alignItems: 'center', justifyContent: 'center' },
  tbInfoText: { color: '#1B2E4A', fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  heroScore: { marginHorizontal: 16, marginBottom: 14, backgroundColor: '#1B2E4A', borderRadius: 20, overflow: 'hidden' },
  hsBody: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 14 },
  hsLabel: { fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: '700', marginBottom: 12 },
  hsMain: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 14 },
  hsNum: { fontSize: 64, color: '#fff', fontFamily: 'serif', lineHeight: 60, letterSpacing: -2 },
  hsRight: { flex: 1, marginLeft: 14 },
  hsStatus: { fontSize: 13, color: '#fff', fontWeight: '600', marginBottom: 4 },
  hsTier: { alignSelf: 'flex-start', backgroundColor: 'rgba(200,169,106,.18)', borderWidth: 1, borderColor: 'rgba(200,169,106,.3)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8 },
  hsTierText: { color: '#C8A96A', fontSize: 9, fontWeight: '700' },
  hsDeltaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hsDelta: { fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  hsdPos: { backgroundColor: 'rgba(22,163,74,.2)', color: '#4ade80' },
  hsdNeg: { backgroundColor: 'rgba(220,38,38,.2)', color: '#f87171' },
  hsDeltaLabel: { fontSize: 10, color: 'rgba(255,255,255,.45)' },
  scaleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  scaleDot: { height: 6, borderRadius: 3 },
  scaleDotFilled: { backgroundColor: 'rgba(255,255,255,.85)' },
  scaleDotPartial: { backgroundColor: 'rgba(255,255,255,.4)' },
  scaleDotEmpty: { backgroundColor: 'rgba(255,255,255,.12)' },
  scaleLabel: { fontSize: 9, color: 'rgba(255,255,255,.35)', marginLeft: 4 },
  hsBar: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.08)', overflow: 'hidden' },
  hsFill: { height: '100%', borderRadius: 2, backgroundColor: '#C8A96A' },
  rsFeedback: { fontSize: 10, color: 'rgba(255,255,255,.45)', marginTop: 8 },
  tierRow: { gap: 4, paddingHorizontal: 18, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.06)' },
  tierChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  tcPast: { backgroundColor: 'rgba(255,255,255,.06)' },
  tcCurrent: { backgroundColor: 'rgba(200,169,106,.2)', borderWidth: 1, borderColor: 'rgba(200,169,106,.35)' },
  tcFuture: { backgroundColor: 'rgba(255,255,255,.04)' },
  tcTextPast: { color: 'rgba(255,255,255,.35)', fontSize: 9, fontWeight: '700' },
  tcTextCurrent: { color: '#C8A96A', fontSize: 9, fontWeight: '700' },
  tcTextFuture: { color: 'rgba(255,255,255,.25)', fontSize: 9, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E5E5', marginHorizontal: 16, marginBottom: 12, overflow: 'hidden' },
  secHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  secTitle: { fontSize: 16, color: '#000', fontFamily: 'serif' },
  secBadgeGreen: { fontSize: 9, fontWeight: '700', color: '#16A34A', backgroundColor: '#EAF3DE', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  secBadgeNavy: { fontSize: 9, fontWeight: '700', color: '#1B2E4A', backgroundColor: '#E8EDF4', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  secInfo: { fontSize: 11, color: '#1B2E4A', fontWeight: '600' },
  secMeta: { paddingHorizontal: 16, paddingBottom: 8, fontSize: 11, color: '#A3A3A3' },
  compBlock: { paddingHorizontal: 16, paddingBottom: 14 },
  compRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  compLabel: { width: 90, fontSize: 11, color: '#525252' },
  compTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#E5E5E5', overflow: 'hidden' },
  compFill: { height: '100%', borderRadius: 3 },
  compValue: { width: 34, fontSize: 11, fontWeight: '700', textAlign: 'right', color: '#000' },
  formulaBlock: { marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 13, paddingVertical: 10, backgroundColor: '#F2F5F9', borderColor: '#E8EDF4', borderWidth: 1, borderRadius: 10 },
  fbLabel: { fontSize: 8, fontWeight: '700', color: '#2A4470', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 },
  fbFormula: { fontSize: 10, color: '#1B2E4A', lineHeight: 16 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', height: 60, gap: 3, paddingHorizontal: 16, paddingBottom: 8 },
  chartBarCol: { flex: 1, justifyContent: 'flex-end' },
  chartBar: { borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  cbPos: { backgroundColor: '#16A34A' },
  cbNeg: { backgroundColor: '#DC2626' },
  emptyTiny: { fontSize: 10, color: '#A3A3A3' },
  deltaRow: { borderTopWidth: 1, borderTopColor: '#F5F5F5', paddingHorizontal: 16, paddingVertical: 10 },
  deltaTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  drThumb: { width: 36, height: 36, borderRadius: 9 },
  drThumbPos: { backgroundColor: '#EAF3DE' },
  drThumbNeg: { backgroundColor: '#FEE2E2' },
  drInfo: { flex: 1, minWidth: 0 },
  drName: { fontSize: 12, fontWeight: '600', color: '#000' },
  drMeta: { fontSize: 10, color: '#A3A3A3' },
  drRight: { alignItems: 'flex-end' },
  drDelta: { fontSize: 17, fontFamily: 'serif' },
  drDeltaPos: { color: '#16A34A' },
  drDeltaNeg: { color: '#DC2626' },
  drRs: { fontSize: 9, color: '#A3A3A3' },
  changeDescription: { marginTop: 8, fontSize: 11, color: '#525252', lineHeight: 16 },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  lrKey: { width: 72, fontSize: 10, fontWeight: '700', color: '#A3A3A3' },
  lrDesc: { flex: 1, fontSize: 11, color: '#525252' },
  lrVal: { fontSize: 11, fontWeight: '700', color: '#1B2E4A' },
  faqRow: { borderTopWidth: 1, borderTopColor: '#F5F5F5', paddingHorizontal: 16, paddingVertical: 11 },
  faqQRow: { flexDirection: 'row', alignItems: 'center' },
  faqQ: { flex: 1, fontSize: 12, fontWeight: '600', color: '#000' },
  faqArrow: { fontSize: 14, color: '#D4D4D4' },
  faqA: { marginTop: 8, fontSize: 11, color: '#737373', lineHeight: 17 },
  lteLink: { marginHorizontal: 16, marginBottom: 20, backgroundColor: '#1B2E4A', borderRadius: 14, padding: 16 },
  lteLinkTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  lteLinkSub: { color: 'rgba(255,255,255,.65)', fontSize: 11, marginTop: 4 },
});
