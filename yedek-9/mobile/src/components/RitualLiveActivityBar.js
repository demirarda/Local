import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { fetchRitualLiveActivity, startRitualLiveActivity } from '../services/api';
import { startNativeLiveActivity, endNativeLiveActivity } from '../services/liveActivityNative';

const PRIMARY = '#f9a13d';

function formatRemaining(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

const PHASE_LABELS = {
  prelobby: 'Baslamaya',
  live: 'Canli',
  window: 'Window',
};

export default function RitualLiveActivityBar({ ritualId, phase, enabled = true }) {
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    if (!ritualId || !enabled) return undefined;
    let mounted = true;
    const load = async () => {
      try {
        const data = await fetchRitualLiveActivity(ritualId);
        if (!mounted) return;
        setPayload(data?.payload || null);
        if (data?.payload?.active) {
          if (!data?.session) {
            await startRitualLiveActivity(ritualId, Platform.OS).catch(() => {});
          }
          await startNativeLiveActivity(data.payload).catch(() => {});
        } else {
          await endNativeLiveActivity().catch(() => {});
        }
      } catch (_e) {
        if (mounted) setPayload(null);
      }
    };
    load();
    const id = setInterval(load, 60000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [ritualId, enabled, phase]);

  if (!payload?.active) return null;

  return (
    <View style={styles.bar}>
      <View style={styles.brand}>
        <Text style={styles.brandText}>{payload.brand_mark || 'L'}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>
          {`Live Activity · ${PHASE_LABELS[payload.phase] || payload.phase}`}
        </Text>
        <Text style={styles.timer}>{formatRemaining(payload.remaining_seconds)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  brand: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  body: { flex: 1 },
  label: { color: '#d1d5db', fontSize: 12, fontWeight: '600' },
  timer: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 2 },
});
