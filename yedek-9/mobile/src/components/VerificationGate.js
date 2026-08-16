import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function VerificationGate({ visible, onVerifyNow, onDismiss, promptMessage, promptNonce }) {
  const [modalOpen, setModalOpen] = useState(false);
  const subtitle =
    promptMessage ||
    'LOCAL\'de dogrulanmamis hesap yoktur. Universite e-postasi (Serit A) veya kimlik KYC (Serit B) zorunlu.';

  useEffect(() => {
    if (!visible) return;
    if (promptNonce) setModalOpen(true);
  }, [promptNonce, visible]);

  if (!visible) return null;

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.banner}
        onPress={() => setModalOpen(true)}
      >
        <MaterialIcons name="warning-amber" size={18} color="#7c2d12" />
        <Text style={styles.bannerText}>Tum aksiyonlar icin dogrulama gerekli (uni-mail veya kimlik)</Text>
      </TouchableOpacity>

      <Modal visible={modalOpen} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <MaterialIcons name="lock-outline" size={28} color="#f59e0b" />
            </View>
            <Text style={styles.title}>OB-12 · Katilmak Icin Dogrula</Text>
            <Text style={styles.subtitle}>
              {subtitle}
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                setModalOpen(false);
                if (onVerifyNow) onVerifyNow();
              }}
            >
              <Text style={styles.primaryText}>Simdi dogrula</Text>
            </TouchableOpacity>

            {onDismiss ? (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setModalOpen(false);
                  onDismiss();
                }}
              >
                <Text style={styles.secondaryText}>Kapat</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 56,
    left: 12,
    right: 12,
    zIndex: 50,
    backgroundColor: '#fde68a',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerText: {
    flex: 1,
    color: '#7c2d12',
    fontSize: 13,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    padding: 0,
  },
  card: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    alignSelf: 'center',
  },
  title: {
    color: '#f9fafb',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
});
