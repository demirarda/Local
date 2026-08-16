import React from 'react';
import { View, Text, Image, ImageBackground, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import { colors, fonts, radii } from '../theme';

const cleanText = (value = '') =>
  String(value || '')
    .replace(/\[[^\]]+\]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * RitualTogetherCard
 * Arkadaşların kayıt oldu, sen de katıl — acil aksiyon kartı.
 *
 * data: {
 *   id, ritualName, venue,            // "Dinner Circle · Navigli"
 *   bgImage,
 *   date,                              // "Perşembe 20:00"
 *   seatsLeft,                         // 4
 *   friendsGoing: [                    // max 3-5 gösteriyoruz
 *     { name, avatar }, ...
 *   ],
 * }
 */
export default function RitualTogetherCard({ data, onPress, onJoin }) {
  const friendsGoing = data.friendsGoing || [];
  const goingText = formatGoingText(friendsGoing);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress?.(data)}
      style={styles.container}
    >
      <ImageBackground source={{ uri: data.bgImage }} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={styles.bgOverlay} />
        <LinearGradient
          colors={['rgba(10,10,10,0.55)', 'rgba(10,10,10,0.9)']}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      {/* Top row */}
      <View style={styles.topRow}>
        <View style={styles.labelRow}>
          <Icon name="users" size={11} color="rgba(255,255,255,0.85)" strokeWidth={2} />
          <Text style={styles.label}>
            {friendsGoing.length} ARKADAŞIN GİDİYOR
          </Text>
        </View>

        <View style={styles.avatarsTop}>
          {friendsGoing.slice(0, 3).map((f, i) => (
            <Image
              key={i}
              source={{ uri: f.avatar }}
              style={[styles.topAvatar, i > 0 && { marginLeft: -7 }]}
            />
          ))}
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.goingText} numberOfLines={1}>
          {goingText}
        </Text>

        <Text style={styles.ritualTitle} numberOfLines={2}>
          {cleanText(data.ritualName)}
          {data.venue ? ` · ${cleanText(data.venue)}` : ''}
        </Text>

        <View style={styles.metaRow}>
          <Icon name="clock" size={10} color="rgba(255,255,255,0.65)" strokeWidth={2} />
          <Text style={styles.metaText}>
            {data.date}
            {data.seatsLeft != null ? ` · ${data.seatsLeft} yer kaldı` : ''}
          </Text>
        </View>

        <TouchableOpacity style={styles.cta} onPress={() => onJoin?.(data)}>
          <Text style={styles.ctaText}>Sen de katıl</Text>
          <Icon name="arrow-right" size={10} color="#0a0a0a" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

/**
 * "Chiara, Alessandro ve Luca gidiyor"
 */
function formatGoingText(friends) {
  if (!friends || friends.length === 0) return '';
  const names = friends.map((f) => f.name);
  if (names.length === 1) return <><Text style={styles.goingBold}>{names[0]}</Text> gidiyor</>;
  if (names.length === 2) {
    return (
      <>
        <Text style={styles.goingBold}>{names[0]}</Text>
        {' ve '}
        <Text style={styles.goingBold}>{names[1]}</Text>
        {' gidiyor'}
      </>
    );
  }
  // 3+
  const firstTwo = names.slice(0, 2);
  const remaining = names.length - 2;
  return (
    <>
      <Text style={styles.goingBold}>{firstTwo[0]}</Text>
      {', '}
      <Text style={styles.goingBold}>{firstTwo[1]}</Text>
      {remaining > 1 ? ` ve ${remaining} arkadaşın gidiyor` : (
        <>
          {' ve '}
          <Text style={styles.goingBold}>{names[2]}</Text>
          {' gidiyor'}
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0a0a',
    borderRadius: radii.lg,
    minHeight: 170,
    padding: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,10,0.45)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    zIndex: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  label: {
    fontSize: 9.5,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.85)',
  },
  avatarsTop: {
    flexDirection: 'row',
  },
  topAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#0a0a0a',
  },
  content: {
    marginTop: 'auto',
    zIndex: 2,
  },
  goingText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontStyle: 'italic',
    fontFamily: fonts.serif,
    marginBottom: 6,
  },
  goingBold: {
    color: '#fff',
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    fontStyle: 'normal',
  },
  ritualTitle: {
    fontFamily: fonts.serifMedium,
    fontSize: 21,
    fontWeight: '500',
    color: '#fff',
    lineHeight: 22,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 12,
  },
  metaText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    fontFamily: fonts.sans,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  ctaText: {
    fontSize: 11,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: '#0a0a0a',
  },
});
