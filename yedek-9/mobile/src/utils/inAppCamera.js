/**
 * §3 — window / prelobby görsel kaynak: yalnız in-app kamera.
 * Galeri / upload butonu render edilmez (avatar hariç).
 */
import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export const VIDEO_MAX_S_DEFAULT = 45;

export async function requestInAppCameraPermission() {
  if (Platform.OS === 'web') return true;
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Izin gerekli', 'Canli cekim icin kamera izni gerekli.');
    return false;
  }
  return true;
}

/**
 * @param {'photo'|'video'} kind
 * @param {{ videoMaxS?: number }} [opts]
 * @returns {Promise<null|{ uri, mimeType, fileSize, durationSec, upload_type, capture_source }>}
 */
export async function captureInAppMedia(kind = 'photo', opts = {}) {
  const videoMaxS = Number(opts.videoMaxS) > 0 ? Number(opts.videoMaxS) : VIDEO_MAX_S_DEFAULT;
  const ok = await requestInAppCameraPermission();
  if (!ok) return null;

  const isVideo = kind === 'video';
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: isVideo
      ? ImagePicker.MediaTypeOptions.Videos
      : ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.8,
    ...(isVideo ? { videoMaxDuration: videoMaxS } : {}),
  });

  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];

  let durationSec = 0;
  if (isVideo) {
    durationSec =
      Number(asset.duration || 0) > 1000
        ? Number(asset.duration) / 1000
        : Number(asset.duration || 0);
    if (durationSec > videoMaxS) {
      Alert.alert('Sure limiti', `Video en fazla ${videoMaxS} sn olabilir.`);
      return null;
    }
  }

  return {
    uri: asset.uri,
    mimeType: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
    fileSize: asset.fileSize || 0,
    durationSec: durationSec || (isVideo ? videoMaxS : 0),
    upload_type: isVideo ? 'video' : 'photo',
    capture_source: 'camera',
  };
}
