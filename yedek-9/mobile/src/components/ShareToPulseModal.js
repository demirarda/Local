import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * sonMD — Dardan genele: MASA → +ÇEVRE → +ŞEHİR
 * API audience: WINDOW | CIRCLE | CITY (legacy solo/pulse/all map edilir)
 */
export default function ShareToPulseModal({
  visible,
  onClose,
  onSelect,
  checkingEligibility,
  isEligible,
  memoryContent,
}) {
  const [layers, setLayers] = useState({ masa: true, cevre: false, sehir: false });

  useEffect(() => {
    if (visible) {
      setLayers({ masa: true, cevre: Boolean(isEligible), sehir: false });
    }
  }, [visible, isEligible]);

  const resolveAudience = () => {
    if (layers.sehir) return 'CITY';
    if (layers.cevre) return 'CIRCLE';
    return 'WINDOW';
  };

  const handleConfirm = () => {
    onSelect(resolveAudience());
  };

  const toggle = (key) => {
    setLayers((prev) => {
      const next = { ...prev };
      if (key === 'masa') {
        next.masa = true;
      } else if (key === 'cevre') {
        if (!isEligible) return prev;
        next.cevre = !prev.cevre;
        if (!next.cevre) next.sehir = false;
      } else if (key === 'sehir') {
        if (!isEligible) return prev;
        next.sehir = !prev.sehir;
        if (next.sehir) next.cevre = true;
      }
      return next;
    });
  };

  const getPreviewText = () => {
    if (!memoryContent) return 'Your memory';
    return (
      memoryContent
        .replace(/^📸\s*/, '')
        .replace(/^["']|["']$/g, '')
        .trim() || 'Your memory'
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <LinearGradient
          colors={['#faf9f6', '#f5f0e8', '#e8dcc0', '#d4af37']}
          style={styles.modalContainer}
        >
          <View style={styles.header}>
            <Text style={styles.modalTitle}>Dardan Genele</Text>
            <Text style={styles.modalSubtitle}>Paylaşım katmanını seç (çoklu)</Text>
          </View>

          {checkingEligibility ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#d4af37" />
              <Text style={styles.loadingText}>Uygunluk kontrol ediliyor…</Text>
            </View>
          ) : (
            <>
              <View style={styles.previewCard}>
                <View style={styles.previewImage}>
                  <MaterialIcons name="image" size={24} color="#d4af37" />
                </View>
                <View style={styles.previewContent}>
                  <Text style={styles.previewText} numberOfLines={2}>
                    {getPreviewText()}
                  </Text>
                </View>
              </View>

              <View style={styles.layersCol}>
                <TouchableOpacity
                  style={[styles.optionCard, layers.masa && styles.optionCardSelected]}
                  onPress={() => toggle('masa')}
                >
                  <Text style={styles.optionTitle}>MASA</Text>
                  <Text style={styles.optionDescription}>Yalnız Ritual Window</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.optionCard,
                    layers.cevre && styles.optionCardSelectedPulse,
                    !isEligible && styles.optionCardDisabled,
                  ]}
                  onPress={() => toggle('cevre')}
                  disabled={!isEligible}
                >
                  <Text style={styles.optionTitle}>+ ÇEVRE</Text>
                  <Text style={styles.optionDescription}>
                    Arkadaş / takipçi Your Pulse (24s)
                  </Text>
                  {!isEligible ? (
                    <View style={styles.eligibilityMessage}>
                      <MaterialIcons name="info-outline" size={14} color="#E65100" />
                      <Text style={styles.eligibilityMessageText}>
                        Çevre paylaşımı yalnız uygun bağlantılar için açık
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.optionCard,
                    layers.sehir && styles.optionCardSelected,
                    !isEligible && styles.optionCardDisabled,
                  ]}
                  onPress={() => toggle('sehir')}
                  disabled={!isEligible}
                >
                  <Text style={styles.optionTitle}>+ ŞEHİR</Text>
                  <Text style={styles.optionDescription}>Local World / şehir görünürlüğü</Text>
                </TouchableOpacity>
              </View>

              {(layers.cevre || layers.sehir) && isEligible ? (
                <View style={styles.infoContainer}>
                  <MaterialIcons name="access-time" size={16} color="#666" />
                  <Text style={styles.infoText}>
                    Çevre katmanı 24 saat Your Pulse’ta görünür; damga korunur, sonra pasaport
                    arşivine düşer. Echo kapsamı yükseltmez.
                  </Text>
                </View>
              ) : null}

              <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelButtonText}>İptal</Text>
                </TouchableOpacity>
                <LinearGradient colors={['#d4af37', '#b8860b']} style={styles.shareButton}>
                  <TouchableOpacity onPress={handleConfirm} style={styles.shareButtonTouchable}>
                    <Text style={styles.shareButtonText}>Paylaş</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </>
          )}
        </LinearGradient>
      </View>
    </Modal>
  );
}

const PRIMARY_COLOR = '#d4af37';
const LIGHT_CARD = '#ffffff';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    minHeight: '70%',
  },
  header: { marginBottom: 24 },
  modalTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  modalSubtitle: { fontSize: 16, color: '#666' },
  loadingContainer: { padding: 32, alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#666' },
  previewCard: {
    flexDirection: 'row',
    backgroundColor: LIGHT_CARD,
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f5f5f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  previewContent: { flex: 1 },
  previewText: { fontSize: 14, color: '#333', lineHeight: 20 },
  layersCol: { gap: 10, marginBottom: 16 },
  optionCard: {
    backgroundColor: LIGHT_CARD,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e5e0',
  },
  optionCardSelected: {
    borderColor: '#000',
    backgroundColor: '#fafafa',
  },
  optionCardSelectedPulse: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: '#fffef9',
  },
  optionCardDisabled: { opacity: 0.5 },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 6,
  },
  optionDescription: { fontSize: 13, color: '#666', lineHeight: 18 },
  eligibilityMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FFF3E0',
    borderRadius: 6,
    gap: 6,
  },
  eligibilityMessageText: {
    flex: 1,
    fontSize: 11,
    color: '#E65100',
    lineHeight: 14,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: LIGHT_CARD,
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  infoText: { flex: 1, fontSize: 12, color: '#666', lineHeight: 16 },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 'auto',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: LIGHT_CARD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: { fontSize: 16, color: '#000', fontWeight: '600' },
  shareButton: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  shareButtonTouchable: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonText: { fontSize: 16, color: '#fff', fontWeight: '600' },
});
