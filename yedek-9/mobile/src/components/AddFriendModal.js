import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';

const COLORS = {
  background: '#f8f3e9',
  card: '#fff7e8',
  textPrimary: '#2b1805',
  textSecondary: '#6b5b45',
  accent: '#d4af37',
  accentDark: '#b8891d',
};

export default function AddFriendModal({
  visible,
  onClose,
  onConfirm,
  participantName,
  rsScore,
  fromRitualTitle,
}) {
  const initial = (participantName || '?').charAt(0).toUpperCase();
  const scoreLabel =
    typeof rsScore === 'number' ? Math.round(rsScore) : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Title */}
          <Text style={styles.title}>Arkadas Ekle</Text>
          <Text style={styles.subtitle}>Ritual baglaminda baglanti istegi gonder</Text>

          {/* Avatar + RS badge */}
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
            {scoreLabel !== null && (
              <View style={styles.rsBadge}>
                <Text style={styles.rsBadgeText}>{scoreLabel}</Text>
              </View>
            )}
          </View>

          {/* From ritual label */}
          {fromRitualTitle ? (
            <Text style={styles.fromRitualText}>
              From <Text style={styles.fromRitualHighlight}>{fromRitualTitle}</Text>
            </Text>
          ) : null}

          {/* Benefits card */}
          <View style={styles.benefitsCard}>
            <Text style={styles.benefitsTitle}>Arkadas oldugunuzda:</Text>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitBullet}>•</Text>
              <Text style={styles.benefitText}>
                Ritual sonrasinda birbirinize geri bildirim verebilirsiniz
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitBullet}>•</Text>
              <Text style={styles.benefitText}>
                Birbirinizi arkadas aktivitesinde gorursunuz (Pulse kesfinde degil)
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitBullet}>•</Text>
              <Text style={styles.benefitText}>FL seviyesi Ritual gecmisi ile birlikte ilerler</Text>
            </View>
          </View>

          {/* Masking note */}
          <Text style={styles.maskingNote}>
            Pulse tarafinda kimlik maskelemesi korunur. Arkadaslik yalnizca baglam ve geri bildirim haklarini acar.
          </Text>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Iptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={onConfirm}>
              <Text style={styles.primaryText}>Arkadaslik Istegi Gonder</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d3c5b3',
    marginVertical: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  avatarWrapper: {
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e3d5c3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  rsBadge: {
    position: 'absolute',
    right: -6,
    top: -6,
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  rsBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  fromRitualText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  fromRitualHighlight: {
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  benefitsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 16,
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  benefitBullet: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginRight: 6,
    marginTop: 2,
  },
  benefitText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  maskingNote: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d0c2b2',
    alignItems: 'center',
    backgroundColor: '#fdf7ef',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
  },
  primaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

