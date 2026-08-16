import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const TEXT = '#1a1a1a';
const MUTED = '#6b6b6b';
const BORDER = '#e5e5e0';

function ChipLine({ chip }) {
  if (!chip) return null;
  const parts = [];
  if (chip.green) parts.push(`🟢${chip.green}`);
  if (chip.red) parts.push(`🔴${chip.red}`);
  if (chip.yellow) parts.push(`🟡${chip.yellow}`);
  return (
    <Text style={styles.chipLine}>
      {chip.chip_id}
      {parts.length ? ` · ${parts.join(' ')}` : ''}
    </Text>
  );
}

/**
 * §12 karakter kartı — Trust+etiket · Aura+etiket · skor-altı 1-3 chip · +diğer
 * Hacim (n_eff) kartta YOK
 */
export default function VenueCharacterCard({
  card,
  volume = null,
  showVolume = false,
  onChainPress,
  onBrandPress,
}) {
  if (!card) return null;
  const chips = card.chips_under_scores || [];

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>KARAKTER KARTI</Text>
      <View style={styles.scoreRow}>
        <View style={styles.scoreCol}>
          <Text style={styles.scoreLabel}>Trust</Text>
          <Text style={styles.scoreValue}>
            {card.trust?.score != null ? Number(card.trust.score).toFixed(2) : '—'}
          </Text>
          <Text style={styles.scoreMeta}>{card.trust?.label || '—'}</Text>
        </View>
        <View style={styles.scoreCol}>
          <Text style={styles.scoreLabel}>Aura</Text>
          <Text style={styles.scoreValue}>
            {card.aura?.score != null ? Number(card.aura.score).toFixed(2) : '—'}
          </Text>
          <Text style={styles.scoreMeta}>{card.aura?.label || '—'}</Text>
        </View>
      </View>
      {chips.slice(0, 3).map((c) => (
        <ChipLine key={c.chip_id} chip={c} />
      ))}

      {(card.distribution_slices || []).length > 0 ? (
        <View style={styles.dist}>
          {card.distribution_slices.map((s) => (
            <Text key={s.category} style={styles.distRow}>
              {s.category}: {s.avg_score != null ? Number(s.avg_score).toFixed(1) : '—'}
              {s.status === 'tentative' ? ' · tentative' : ''}
            </Text>
          ))}
          {card.distribution_other ? (
            <Text style={styles.other}>
              {card.distribution_other.label}
              {card.distribution_other.count_categories
                ? ` (${card.distribution_other.count_categories})`
                : ''}
            </Text>
          ) : null}
        </View>
      ) : null}

      {card.chain_id && onChainPress ? (
        <TouchableOpacity onPress={() => onChainPress(card.chain_id)}>
          <Text style={styles.link}>Zincir profili →</Text>
        </TouchableOpacity>
      ) : null}
      {card.brand_id && onBrandPress ? (
        <TouchableOpacity onPress={() => onBrandPress(card.brand_id)}>
          <Text style={styles.link}>Brand profili →</Text>
        </TouchableOpacity>
      ) : null}

      {showVolume && volume ? (
        <View style={styles.volumeBox}>
          <Text style={styles.volumeTitle}>Profil detayı (hacim)</Text>
          <Text style={styles.volumeLine}>Trust n_eff: {volume.trust_n_eff ?? 0}</Text>
          <Text style={styles.volumeLine}>Aura n_eff: {volume.aura_n_eff ?? 0}</Text>
          <Text style={styles.volumeLine}>Chip cevap: {volume.chip_total ?? 0}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#f9a13d',
    marginBottom: 10,
  },
  scoreRow: { flexDirection: 'row', gap: 12 },
  scoreCol: { flex: 1 },
  scoreLabel: { fontSize: 12, fontWeight: '700', color: MUTED },
  scoreValue: { fontSize: 22, fontWeight: '800', color: TEXT, marginTop: 2 },
  scoreMeta: { fontSize: 12, color: MUTED, marginTop: 2, marginBottom: 6 },
  chipLine: { fontSize: 11, color: TEXT, marginTop: 2 },
  dist: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: BORDER },
  distRow: { fontSize: 12, color: TEXT, marginTop: 3 },
  other: { fontSize: 12, fontWeight: '700', color: MUTED, marginTop: 6 },
  link: { marginTop: 10, fontSize: 13, fontWeight: '700', color: '#0f766e' },
  volumeBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  volumeTitle: { fontSize: 12, fontWeight: '800', color: TEXT, marginBottom: 4 },
  volumeLine: { fontSize: 12, color: MUTED, marginTop: 2 },
});
