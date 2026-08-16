/**
 * KYC kart kilidi — canlı kamera önizlemesi çerçeve İÇİNDE.
 * Sistem kamera UI (ImagePicker.launchCameraAsync) kullanılmaz.
 */
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function KycIdCameraFrame({
  facing = 'back',
  capture = null,
  onCaptured,
  onClear,
  height = 300,
  hint = 'Kimligi cerceveye hizala',
  subHint = 'Canli kamera · galeri yok',
}) {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const takePhoto = async () => {
    if (!cameraRef.current || !ready || busy) return;
    try {
      setBusy(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.75,
        skipProcessing: false,
      });
      if (photo?.uri) {
        onCaptured?.({
          uri: photo.uri,
          width: photo.width,
          height: photo.height,
          mimeType: 'image/jpeg',
        });
      }
    } catch {
      // ignore — kullanıcı tekrar basabilir
    } finally {
      setBusy(false);
    }
  };

  if (capture?.uri) {
    return (
      <View style={[styles.frame, { height }]}>
        <Image source={{ uri: capture.uri }} style={styles.preview} />
        <View style={styles.overlay} pointerEvents="none">
          <CornerGuide />
        </View>
        {onClear ? (
          <TouchableOpacity style={styles.retake} onPress={onClear}>
            <Text style={styles.retakeText}>Tekrar cek</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={[styles.frame, { height }]}>
        <ActivityIndicator color="#c8a96a" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.frame, { height }]}>
        <Text style={styles.cameraText}>Kamera izni gerekli</Text>
        <Text style={styles.cameraSub}>Kimlik yalniz canli kamera ile</Text>
        <TouchableOpacity style={styles.permitBtn} onPress={requestPermission}>
          <Text style={styles.permitText}>Izin ver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.frame, { height }]}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode="picture"
        onCameraReady={() => setReady(true)}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <CornerGuide />
        <Text style={styles.cameraText}>{hint}</Text>
        <Text style={styles.cameraSub}>{subHint}</Text>
        <TouchableOpacity
          style={[styles.shutter, (!ready || busy) && styles.shutterDisabled]}
          onPress={takePhoto}
          disabled={!ready || busy}
          activeOpacity={0.85}
        >
          {busy ? (
            <ActivityIndicator color="#162331" />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CornerGuide() {
  return (
    <View style={styles.cardLockCorners}>
      <View style={[styles.corner, styles.cornerTL]} />
      <View style={[styles.corner, styles.cornerTR]} />
      <View style={[styles.corner, styles.cornerBL]} />
      <View style={[styles.corner, styles.cornerBR]} />
      <View style={styles.cardLockInner} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    marginTop: 12,
    borderRadius: 20,
    backgroundColor: '#1b2e4a',
    borderWidth: 2,
    borderColor: '#c8a96a',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 18, 32, 0.22)',
    paddingBottom: 12,
  },
  cardLockCorners: {
    width: 240,
    height: 156,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardLockInner: {
    width: 220,
    height: 140,
    borderWidth: 1.5,
    borderColor: 'rgba(200,169,106,0.55)',
    borderRadius: 10,
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: 'rgba(200,169,106,0.95)',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  cameraText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cameraSub: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    textAlign: 'center',
  },
  shutter: {
    position: 'absolute',
    bottom: 14,
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  shutterDisabled: { opacity: 0.45 },
  shutterInner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff',
  },
  retake: {
    position: 'absolute',
    bottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(22,35,49,0.85)',
  },
  retakeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  permitBtn: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#c8a96a',
  },
  permitText: { color: '#162331', fontWeight: '800' },
});
