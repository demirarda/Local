import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const COLORS = {
  card: '#0a0a0a',
  primary: '#C8A96A',
};

export default function LiveRitualHostAnnouncements({
  announcements,
  isHost,
  isDark = true,
  onSendAnnouncement,
  hostKeyword = '',
  onExtendWindow,
  onEndRitual,
  participantCount = 0,
  windowDurationHours = null,
  onShowKeyword,
  onOpenParticipants,
  /** sonMD: mühürlü herkese kalıcı dev-punto kod (dijital yollama yok) */
  showSealedCode = false,
}) {
  const sealedCode =
    hostKeyword && hostKeyword !== 'SUNRISE' ? String(hostKeyword).trim() : '';
  const digits = sealedCode && /^\d{3}$/.test(sealedCode) ? sealedCode.split('') : null;

  if (announcements.length === 0 && !isHost && !showSealedCode) return null;

  return (
    <>
      {showSealedCode && digits ? (
        <View style={[styles.codeBanner, !isDark && styles.codeBannerLight]}>
          <Text style={[styles.codeBannerLabel, !isDark && styles.codeBannerLabelLight]}>
            Masa kodu · söyle / göster · LOCAL-TAG · kodu sormak selam vermektir
          </Text>
          <View style={styles.codeDigitsRow}>
            {digits.map((d, i) => (
              <Text key={`d-${i}`} style={[styles.codeDigit, !isDark && styles.codeDigitLight]}>
                {d}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      {announcements.length > 0 && (
        <View style={[styles.announcementsSection, !isDark && styles.announcementsSectionLight]}>
          <View style={styles.announcementsHeader}>
            <View style={styles.livePill} />
            <Text style={[styles.announcementsHeaderText, !isDark && styles.announcementsHeaderTextLight]}>Canli Duyurular</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.announcementsScroll}>
            {announcements.map((announcement) => (
              <View key={announcement.id} style={[styles.announcementCard, !isDark && styles.announcementCardLight]}>
                <Text style={[styles.announcementText, !isDark && styles.announcementTextLight]}>{announcement.message}</Text>
                <Text style={[styles.announcementTime, !isDark && styles.announcementTimeLight]}>
                  {new Date(announcement.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {isHost && (
        <View style={[styles.announcementInputContainer, !isDark && styles.announcementInputContainerLight]}>
          <View style={[styles.hostRibbon, !isDark && styles.hostRibbonLight]}>
            <Text style={styles.hostRibbonTitle}>HOST GORUNUMU</Text>
            <Text style={[styles.hostRibbonMeta, !isDark && styles.hostRibbonMetaLight]}>
              {participantCount} katilimci · Window {windowDurationHours ? `${windowDurationHours}s` : 'aktif'}
            </Text>
          </View>
          <View style={styles.hostActionRow}>
            <TouchableOpacity style={[styles.hostActionChip, styles.hostActionActive, !isDark && styles.hostActionChipLight]} onPress={onShowKeyword}>
              <Text style={[styles.hostActionText, !isDark && styles.hostActionTextLight]}>
                {sealedCode ? 'Kodu Göster' : 'Kod durumu'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.hostActionChip, !isDark && styles.hostActionChipLight]} onPress={onExtendWindow}>
              <Text style={[styles.hostActionText, !isDark && styles.hostActionTextLight]}>Window Uzat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.hostActionChip, !isDark && styles.hostActionChipLight]} onPress={onOpenParticipants}>
              <Text style={[styles.hostActionText, !isDark && styles.hostActionTextLight]}>Katilimcilar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.hostActionChip, styles.hostActionDanger]} onPress={onEndRitual}>
              <Text style={[styles.hostActionText, { color: '#fff' }]}>Rituali Bitir</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.announcementButton}
            onPress={() => {
              Alert.prompt(
                'Duyuru Gonder',
                'Tum katilimcilara bir duyuru gonder',
                [
                  { text: 'Iptal', style: 'cancel' },
                  {
                    text: 'Gonder',
                    onPress: async (text) => {
                      if (text && text.trim()) {
                        await onSendAnnouncement(text.trim());
                      }
                    },
                  },
                ],
                'plain-text'
              );
            }}
          >
            <MaterialIcons name="campaign" size={18} color="#fff" />
            <Text style={styles.announcementButtonText}>Duyuru Gonder</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  codeBanner: {
    backgroundColor: '#0a0a0a',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
    alignItems: 'center',
  },
  codeBannerLight: {
    backgroundColor: '#fff7ed',
    borderBottomColor: '#fed7aa',
  },
  codeBannerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  codeBannerLabelLight: {
    color: '#9a3412',
  },
  codeDigitsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  codeDigit: {
    fontSize: 48,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
    minWidth: 40,
    textAlign: 'center',
  },
  codeDigitLight: {
    color: '#111827',
  },
  announcementsSection: {
    backgroundColor: '#080808',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#111',
  },
  announcementsSectionLight: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  announcementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 6,
    gap: 8,
  },
  livePill: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
  },
  announcementsHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  announcementsHeaderTextLight: {
    color: '#737373',
  },
  announcementsScroll: {
    paddingHorizontal: 16,
  },
  announcementCard: {
    backgroundColor: 'rgba(255,255,255,.07)',
    borderRadius: 12,
    padding: 10,
    marginRight: 8,
    minWidth: 200,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.06)',
  },
  announcementCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#fdba74',
  },
  announcementText: {
    fontSize: 12,
    color: 'rgba(255,255,255,.78)',
    marginBottom: 4,
  },
  announcementTextLight: {
    color: '#9a3412',
  },
  announcementTime: {
    fontSize: 9,
    color: 'rgba(255,255,255,.25)',
  },
  announcementTimeLight: {
    color: '#b45309',
  },
  announcementInputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: '#141414',
  },
  announcementInputContainerLight: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#E5E5E5',
  },
  hostRibbon: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
  },
  hostRibbonLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
  },
  hostRibbonTitle: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  hostRibbonMeta: {
    marginTop: 3,
    color: 'rgba(255,255,255,.35)',
    fontSize: 10,
    fontWeight: '600',
  },
  hostRibbonMetaLight: {
    color: '#6b7280',
  },
  hostActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  hostActionChip: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.06)',
    backgroundColor: 'rgba(255,255,255,.05)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  hostActionActive: {
    backgroundColor: 'rgba(27,46,74,.6)',
    borderColor: 'rgba(42,68,112,.5)',
  },
  hostActionChipLight: {
    borderColor: '#E5E5E5',
    backgroundColor: '#F5F5F5',
  },
  hostActionText: { fontSize: 10, color: 'rgba(255,255,255,.4)', fontWeight: '700' },
  hostActionTextLight: { color: '#737373' },
  hostActionDanger: { backgroundColor: '#b91c1c', borderColor: '#b91c1c' },
  announcementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B2E4A',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  announcementButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
