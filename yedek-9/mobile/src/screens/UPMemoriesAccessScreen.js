import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

function buildTiles(mode) {
  const base = Array.from({ length: 9 }).map((_, i) => ({
    id: i + 1,
    locked: false,
    isVideo: i % 4 === 0,
    isMulti: i % 3 === 0,
    sharedRitual: i === 1 || i === 6,
  }));
  if (mode === 'UP05') return base;
  if (mode === 'UP06') return base.map((t, i) => ({ ...t, locked: i > 2 }));
  if (mode === 'UP07') return base.map((t, i) => ({ ...t, sharedRitual: i % 2 === 0 }));
  return base.map((t) => ({ ...t, locked: true }));
}

export default function UPMemoriesAccessScreen({ route }) {
  const mode = route?.params?.mode || 'UP05';
  const tiles = buildTiles(mode);
  const titleMap = {
    UP05: 'UP-05 · Herkese Acik Izgara',
    UP06: 'UP-06 · Friends-only (Yabanci Gorunumu)',
    UP07: 'UP-07 · Friends-only (L1+ Gorunumu)',
    UP08: 'UP-08 · Gizli Anilar',
  };
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{titleMap[mode] || 'Memories Access'}</Text>
      <View style={styles.grid}>
        {tiles.map((t) => (
          <View key={t.id} style={[styles.tile, t.locked && styles.tileLocked, t.sharedRitual && !t.locked && styles.tileShared]}>
            <Text style={styles.tileText}>{t.locked ? 'LOCK' : t.isVideo ? 'VID' : 'IMG'}</Text>
            {!t.locked && t.isMulti ? <Text style={styles.cornerBadge}>+2</Text> : null}
            {!t.locked && t.sharedRitual && mode === 'UP07' ? <Text style={styles.sharedTag}>Ritual</Text> : null}
          </View>
        ))}
      </View>
      <Text style={styles.caption}>
        {mode === 'UP06'
          ? '3 herkese acik + kilitli yerlestiriciler gorunur.'
          : mode === 'UP08'
            ? 'Tum icerik kilitli gorunur.'
            : 'Instagram 3x3 tam izgara gorunumu.'}
      </Text>
      {mode === 'UP06' ? <Text style={styles.caption}>Kilidini acmak icin baglanti seviyesi artir.</Text> : null}
      {mode === 'UP07' ? <Text style={styles.caption}>L1+ baglantilarda paylasilan Ritual etiketleri gorunur.</Text> : null}
      {mode === 'UP08' ? <Text style={styles.caption}>Bu gorunumde sadece hesap sahibi kendi anilarini gorur.</Text> : null}
      {mode === 'UP08' ? <Text style={styles.caption}>Alternatif: Yalnizca paylasilan Ritual baglaminda gorunum acilir.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31%', aspectRatio: 1, borderRadius: 10, backgroundColor: '#d1d5db', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  tileLocked: { backgroundColor: '#9ca3af' },
  tileShared: { borderWidth: 2, borderColor: '#f59e0b' },
  tileText: { color: '#111827', fontWeight: '800' },
  cornerBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(17,24,39,0.84)',
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  sharedTag: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: '#f59e0b',
    color: '#111827',
    fontSize: 10,
    fontWeight: '800',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  caption: { marginTop: 12, color: '#4b5563' },
});
