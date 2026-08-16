import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { buildQrModules } from '../utils/qrMatrix';
import { buildLocalTagQrPayload, parseLocalTagQrPayload } from '../utils/checkinIntegrity';
import { formatSecondsCountdown } from '../utils/checkinWindow';

function QrGrid({ modules }) {
  if (!modules?.length) return null;
  const n = modules.length;
  return (
    <View style={styles.qrFrame}>
      {modules.map((row, y) => (
        <View key={`r-${y}`} style={styles.qrRow}>
          {row.map((cell, x) => (
            <View
              key={`c-${y}-${x}`}
              style={[
                styles.qrCell,
                { width: Math.max(2, Math.floor(196 / n)), height: Math.max(2, Math.floor(196 / n)) },
                cell ? styles.qrDark : styles.qrLight,
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * §1 LOCAL-TAG: mühürlüden tek-seferlik 30sn — QR-göster / yaklaştır-okut.
 */
export default function LocalTagQr({
  token,
  expiresInSec = 0,
  expired = false,
  onScannedToken,
}) {
  const [scanOpen, setScanOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const payload = useMemo(() => buildLocalTagQrPayload(token), [token]);
  const modules = useMemo(() => (payload && !expired ? buildQrModules(payload) : null), [payload, expired]);

  const openScan = async () => {
    if (!permission?.granted) {
      const next = await requestPermission();
      if (!next?.granted) return;
    }
    setScanOpen(true);
  };

  return (
    <View>
      {token ? (
        <View style={[styles.tagCard, expired && styles.tagCardExpired]}>
          <Text style={styles.tagLabel}>QR-göster · yaklaştır</Text>
          {!expired && modules ? <QrGrid modules={modules} /> : null}
          <Text style={styles.tagToken} selectable>
            {token}
          </Text>
          <Text style={expired ? styles.tagExpired : styles.tagCountdown}>
            {expired
              ? 'Suresi doldu · yeni token uret'
              : `Gecerlilik ${formatSecondsCountdown(expiresInSec)}`}
          </Text>
          <Text style={styles.hint}>Dijital yollama yok — ekranı yaklaştır veya kodu söyle.</Text>
        </View>
      ) : null}

      {scanOpen ? (
        <View style={styles.scanBox}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              const parsed = parseLocalTagQrPayload(data);
              if (!parsed) return;
              setScanOpen(false);
              onScannedToken?.(parsed);
            }}
          />
          <TouchableOpacity style={styles.retryBtn} onPress={() => setScanOpen(false)}>
            <Text style={styles.retryText}>Kamerayı kapat</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.retryBtn} onPress={openScan}>
          <Text style={styles.retryText}>QR okut (yaklaştır)</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tagCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
    padding: 12,
    alignItems: 'center',
  },
  tagCardExpired: { opacity: 0.55 },
  tagLabel: { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' },
  tagToken: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111',
    letterSpacing: 0.6,
    textAlign: 'center',
    marginTop: 8,
  },
  tagCountdown: { fontSize: 13, fontWeight: '700', color: '#166534', marginTop: 6 },
  tagExpired: { fontSize: 13, fontWeight: '700', color: '#b91c1c', marginTop: 6 },
  hint: { color: '#666', fontSize: 12, lineHeight: 17, marginTop: 6, textAlign: 'center' },
  qrFrame: {
    marginTop: 10,
    backgroundColor: '#fff',
    padding: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  qrRow: { flexDirection: 'row' },
  qrCell: { backgroundColor: '#fff' },
  qrDark: { backgroundColor: '#111' },
  qrLight: { backgroundColor: '#fff' },
  scanBox: { marginTop: 10, overflow: 'hidden', borderRadius: 12 },
  camera: { height: 220, width: '100%' },
  retryBtn: { marginTop: 8, alignSelf: 'flex-start' },
  retryText: { color: '#111', fontWeight: '600', fontSize: 13 },
});
