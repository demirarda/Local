import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, fonts, radii } from '../../theme';

const cleanText = (value = '') =>
  String(value || '')
    .replace(/\[[^\]]+\]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const sectionMeta = (item) => cleanText(item?.entity?.name || item?.title || 'Takip');

export function FollowingContext({ totalCount = 0, activeCount = 0 }) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, [pulseAnim]);

  const scale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.35] });
  const opacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={styles.context}>
      <View style={styles.contextLeft}>
        <View style={styles.iconWrap}>
          <Animated.View style={[styles.iconRing, { opacity, transform: [{ scale }] }]} />
          <View style={styles.icon}>
            <Icon name="heart" size={13} color="#fff" strokeWidth={2.2} />
          </View>
        </View>
        <View>
          <Text style={styles.contextLabel}>Takip ettiğin</Text>
          <View style={styles.nameRow}>
            <Text style={styles.nameBig}>{totalCount}</Text>
            <Text style={styles.nameSmall}>kişi & yer</Text>
          </View>
        </View>
      </View>
      {activeCount > 0 && (
        <View style={styles.contextPill}>
          <View style={styles.contextPillDot} />
          <Text style={styles.contextPillText}>{activeCount} AKTİF</Text>
        </View>
      )}
    </View>
  );
}

export function TypeFilter({ active = 'all', counts = {}, onChange }) {
  const options = [
    ['all', 'Hepsi'],
    ['host', 'Hostlar'],
    ['venue', 'Mekanlar'],
    ['creator', "Creator'lar"],
    ['partner', 'Partnerler'],
  ];
  return (
    <View style={styles.typeRow}>
      {options.map(([key, label]) => (
        <TouchableOpacity
          key={key}
          style={[styles.typeChip, active === key && styles.typeChipActive]}
          onPress={() => onChange?.(key)}
        >
          <Text style={[styles.typeChipText, active === key && styles.typeChipTextActive]}>
            {label} <Text style={styles.typeCount}>{counts[key] || 0}</Text>
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function HostRitualCard({ data, onPress, onReserve }) {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress?.(data)} activeOpacity={0.9}>
      <ImageBackground source={{ uri: data?.coverImage || data?.cover_image || data?.image_url }} style={styles.cover} imageStyle={{ borderRadius: 14 }}>
        <View style={styles.coverShade} />
        <Text style={styles.coverTitle}>{cleanText(data?.title || 'Rituel')}</Text>
      </ImageBackground>
      <Text style={styles.meta}>{sectionMeta(data)}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => onReserve?.(data)}>
        <Text style={styles.btnTxt}>Yer kap</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export function VenueLiveCard({ data, onPress, onListen }) {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress?.(data)} activeOpacity={0.9}>
      <Text style={styles.title}>● Su an canli</Text>
      <Text style={styles.meta}>{sectionMeta(data)}</Text>
      <TouchableOpacity style={styles.btnGhost} onPress={() => onListen?.(data)}>
        <Text style={styles.btnGhostTxt}>Ambiyans</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export function CreatorPulseCard({ data, onPress, onViewRituals }) {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress?.(data)} activeOpacity={0.9}>
      <Text style={styles.title}>{sectionMeta(data)}</Text>
      <Text style={styles.meta}>Pivot creator guncellemesi</Text>
      <TouchableOpacity style={styles.btnGhost} onPress={() => onViewRituals?.(data)}>
        <Text style={styles.btnGhostTxt}>Ritueller</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export function HostVoiceCard({ data, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress?.(data)} activeOpacity={0.9}>
      <Text style={styles.quote}>"{cleanText(data?.text || data?.content || 'Yeni soz')}"</Text>
      <Text style={styles.meta}>{sectionMeta(data)}</Text>
    </TouchableOpacity>
  );
}

export function HostMemoryCard({ data, onPress }) {
  return (
    <TouchableOpacity style={styles.memory} onPress={() => onPress?.(data)} activeOpacity={0.9}>
      <ImageBackground source={{ uri: data?.image || data?.image_url || data?.photo_url }} style={styles.memoryBg} imageStyle={{ borderRadius: 14 }}>
        <View style={styles.coverShade} />
        <Text style={styles.memoryTitle}>{cleanText(data?.title || 'Ani')}</Text>
      </ImageBackground>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  context: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: colors.cream,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderWarm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  contextLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.blue,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text400,
    letterSpacing: 1.5,
    fontFamily: fonts.sansBold,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  nameBig: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 22,
    fontWeight: '600',
    color: colors.text900,
    letterSpacing: -0.5,
    lineHeight: 22,
  },
  nameSmall: {
    fontFamily: fonts.serif,
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.text500,
  },
  contextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    paddingLeft: 8,
    backgroundColor: colors.blue,
    borderRadius: radii.pill,
    shadowColor: colors.blue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  contextPillDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#fff',
  },
  contextPillText: {
    color: '#fff',
    fontSize: 9.5,
    fontWeight: '700',
    fontFamily: fonts.sansBold,
    letterSpacing: 0.5,
  },
  typeRow: { marginHorizontal: 16, marginBottom: 4, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  typeChip: { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 5 },
  typeChipActive: { backgroundColor: colors.black },
  typeChipText: { fontSize: 10, color: colors.text500 },
  typeChipTextActive: { color: '#fff' },
  typeCount: { fontSize: 9, opacity: 0.8 },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12 },
  cover: { height: 140, justifyContent: 'flex-end', marginBottom: 10 },
  coverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 14 },
  coverTitle: { color: '#fff', fontSize: 18, fontFamily: fonts.serifMedium, padding: 10 },
  title: { fontSize: 14, fontFamily: fonts.serifMedium, color: colors.text900, marginBottom: 6 },
  meta: { fontSize: 11, color: colors.text500, marginBottom: 8 },
  btn: { alignSelf: 'flex-end', backgroundColor: colors.black, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  btnTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  btnGhost: { alignSelf: 'flex-end', borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  btnGhostTxt: { color: colors.text500, fontSize: 11, fontWeight: '700' },
  quote: { fontSize: 15, color: colors.navy, fontFamily: fonts.serif, fontStyle: 'italic', marginBottom: 8 },
  memory: { flex: 1 },
  memoryBg: { height: 170, justifyContent: 'flex-end' },
  memoryTitle: { color: '#fff', fontFamily: fonts.serifMedium, fontSize: 15, padding: 10 },
});
