import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const NAVY = '#1B2E4A';
const MUTED = '#6b7280';

export function DsBinsChart({ bins = [], point = null, compact = false }) {
  if (!Array.isArray(bins) || bins.length === 0) return null;
  const max = Math.max(...bins.map((b) => Number(b.share) || 0), 0.01);
  const markerPct = point == null ? null : Math.max(0, Math.min(1, Number(point))) * 100;
  return (
    <View style={[styles.curve, compact && styles.curveCompact]}>
      {bins.map((b) => {
        const share = Number(b.share) || 0;
        const h = 6 + (share / max) * (compact ? 36 : 52);
        return (
          <View key={b.range} style={styles.binCol}>
            <View style={[styles.binBar, { height: h }]} />
          </View>
        );
      })}
      {markerPct != null && Number.isFinite(markerPct) ? (
        <View pointerEvents="none" style={[styles.marker, { left: `${markerPct}%` }]} />
      ) : null}
    </View>
  );
}

function ComponentRow({ label, value }) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const pct = Math.max(0, Math.min(1, Number(value)));
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
      </View>
      <Text style={styles.rowValue}>{pct.toFixed(2)}</Text>
    </View>
  );
}

/**
 * §13 Keşif Pusulası — Yüz-2 only (nokta + şehir eğrisi + tier + trend).
 * Yüz-1 çarpan (ds_multiplier / ds_ema) gösterilmez.
 */
export default function DsCompassCard({
  data,
  compact = false,
  onPress,
  dark = false,
}) {
  if (!data || data.hidden) return null;
  const point = Number(data.ds_full_ema);
  const curve = data.city_curve;
  const bins = curve && !curve.hidden && Array.isArray(curve.bins) ? curve.bins : [];
  const inner = (
    <View style={[styles.card, compact && styles.cardCompact, dark && styles.cardDark]}>
      <Text style={[styles.kicker, dark && styles.kickerDark]}>Keşif Pusulası</Text>
      <View style={styles.heroRow}>
        <Text style={[styles.point, dark && styles.pointDark]}>
          {Number.isFinite(point) ? point.toFixed(2) : '—'}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.tier, dark && styles.tierDark]}>
            {data.ds_tier_label || data.ds_tier || '—'}
          </Text>
          <Text style={styles.trend}>trend: {data.trend_label || 'durağan'}</Text>
        </View>
      </View>
      {bins.length > 0 ? (
        <>
          <DsBinsChart bins={bins} point={Number.isFinite(point) ? point : null} compact={compact} />
          <Text style={styles.caption}>
            Şehrin anonim dağılımı · n={curve.n} · yargı yok
          </Text>
        </>
      ) : (
        <Text style={styles.caption}>Şehir eğrisi MIN-N altında — yalnız noktan görünür</Text>
      )}
      {!compact ? (
        <View style={{ marginTop: 12 }}>
          <ComponentRow label="Kişi çeşitliliği" value={data.pd_score} />
          <ComponentRow label="Ritual tipi" value={data.ctxd_score} />
          <ComponentRow label="Mekan çeşitliliği" value={data.vd_score} />
        </View>
      ) : null}
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.88}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardCompact: { padding: 14, marginHorizontal: 18, marginBottom: 10 },
  cardDark: { backgroundColor: '#0f172a', borderColor: '#1e293b' },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: NAVY,
    marginBottom: 6,
  },
  kickerDark: { color: '#93c5fd' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  point: { fontSize: 28, fontWeight: '800', color: NAVY, minWidth: 64 },
  pointDark: { color: '#fff' },
  tier: { fontSize: 14, fontWeight: '700', color: '#111' },
  tierDark: { color: '#e2e8f0' },
  trend: { fontSize: 12, color: MUTED, marginTop: 2 },
  curve: {
    marginTop: 8,
    height: 64,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    position: 'relative',
    paddingHorizontal: 4,
  },
  curveCompact: { height: 48 },
  binCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  binBar: { width: '80%', backgroundColor: '#cbd5e1', borderRadius: 3 },
  marker: {
    position: 'absolute',
    bottom: 0,
    width: 3,
    height: '100%',
    marginLeft: -1.5,
    backgroundColor: NAVY,
    borderRadius: 2,
  },
  caption: { fontSize: 11, color: MUTED, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  rowLabel: { width: 130, fontSize: 12, color: '#525252' },
  barTrack: { flex: 1, height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: NAVY },
  rowValue: { width: 36, fontSize: 11, color: '#111', textAlign: 'right' },
});
