import React from 'react';
import { View, Text, Image, ImageBackground, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import { colors, fonts, radii } from '../theme';
import CurationBadge from './CurationBadge';
import { LiveAvailabilityBar, LiveViewerPill, PricePill } from './LiveAvailability';

export function HeroCard({ data, onPress }) {
  const signals = data.curationSignals || ['super-event'];
  const stats = data.collectionStats || {};
  const viewers = data.liveStats?.currentViewers || 0;

  return (
    <TouchableOpacity activeOpacity={0.95} onPress={() => onPress?.(data)} style={styles.heroContainer}>
      <ImageBackground source={{ uri: data.coverImage }} style={StyleSheet.absoluteFill} imageStyle={{ opacity: 0.65 }}>
        <LinearGradient colors={['rgba(10,10,10,0.2)', 'rgba(10,10,10,0.4)', 'rgba(10,10,10,0.95)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
      </ImageBackground>
      <LinearGradient
        colors={[colors.goldDeep, colors.gold, colors.goldLight || colors.gold, colors.gold, colors.goldDeep]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.heroTopBorder}
      />
      <View style={styles.heroContent}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroBadgeRow}>
            {signals.map((sig) => (
              <CurationBadge key={sig} signal={sig} />
            ))}
          </View>
          <LiveViewerPill count={viewers} />
        </View>
        <View style={styles.heroBody}>
          {data.dateRange && (
            <View style={styles.datesRow}>
              <View style={styles.datesDash} />
              <Text style={styles.datesText}>{data.dateRange}</Text>
              <View style={styles.datesDash} />
            </View>
          )}
          <Text style={styles.heroTitle}>{data.title}</Text>
          {data.subtitle && (
            <Text style={styles.heroSubtitle} numberOfLines={3}>
              {data.subtitle}
            </Text>
          )}
        </View>
        <View style={styles.heroFooter}>
          <View style={styles.heroStats}>
            {stats.ritualCount != null && (
              <Text style={styles.heroStat}><Text style={styles.heroStatBold}>{stats.ritualCount}</Text>{' ritüel'}</Text>
            )}
            {stats.hostCount != null && (
              <Text style={styles.heroStat}><Text style={styles.heroStatBold}>{stats.hostCount}</Text>{' host'}</Text>
            )}
            {stats.totalSeats != null && (
              <Text style={styles.heroStat}><Text style={styles.heroStatBold}>{stats.takenSeats || 0}</Text>{`/${stats.totalSeats} yer`}</Text>
            )}
          </View>
          <TouchableOpacity style={styles.heroCta} onPress={() => onPress?.(data)}>
            <Text style={styles.heroCtaText}>Koleksiyonu Aç</Text>
            <Icon name="arrow-right" size={11} color="#0a0a0a" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function FullCard({ data, onPress, onRSVP, onJoinWaitlist }) {
  const signals = data.curationSignals || [];
  const viewers = data.liveStats?.currentViewers || 0;
  const computed = data._computed || {};
  const isWaitlist = computed.availState === 'waitlist-only';
  const ctaLabel = isWaitlist ? 'Bekleme Listesi' : signals.includes('invite-only') ? 'Başvur' : 'RSVP';
  const ctaStyle = isWaitlist ? styles.fullCtaWaitlist : styles.fullCta;
  const ctaTextStyle = isWaitlist ? styles.fullCtaTextWaitlist : styles.fullCtaText;
  const onCta = isWaitlist ? onJoinWaitlist : onRSVP;

  return (
    <TouchableOpacity activeOpacity={0.95} onPress={() => onPress?.(data)} style={styles.fullContainer}>
      <LinearGradient colors={[colors.goldDeep, colors.gold, colors.goldLight || colors.gold]} style={styles.fullLeftAccent} />
      <View style={styles.fullCover}>
        <Image source={{ uri: data.coverImage }} style={styles.fullCoverImage} />
        <LinearGradient colors={['rgba(0,0,0,0.1)', 'transparent', 'rgba(0,0,0,0.6)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.fullCoverTop}>
          <View style={styles.fullBadgeRow}>
            {signals.slice(0, 2).map((sig) => (
              <CurationBadge key={sig} signal={sig} onDark overrideLabel={sig === 'limited' && computed.limitedText ? computed.limitedText : undefined} />
            ))}
            {viewers > 0 && <LiveViewerPill count={viewers} small />}
          </View>
          {data.price && <PricePill kind={data.price.kind} label={data.price.amount} />}
        </View>
        <View style={styles.fullCoverBottom}>
          <Text style={styles.fullTitle} numberOfLines={2}>{data.title}</Text>
          {data.host && <Text style={styles.fullHost} numberOfLines={1}>{data.host}</Text>}
        </View>
      </View>

      <View style={styles.fullBody}>
        {data.collectionLink && (
          <View style={styles.collectionLink}>
            <Icon name="star" size={9} color={colors.goldDeep} />
            <Text style={styles.collectionLinkText}><Text style={styles.collectionLinkStrong}>{data.collectionLink.name}</Text>{`'nin parçası`}</Text>
          </View>
        )}
        {data.curatorNote && (
          <View style={styles.curatorNote}>
            <View style={styles.curatorNoteAccent} />
            <View style={styles.curatorNoteIcon}><Icon name="star" size={10} color="#fff" /></View>
            <View style={styles.curatorNoteBody}>
              <Text style={styles.curatorNoteLabel}>LOCAL'İN NOTU</Text>
              <Text style={styles.curatorNoteText}>{data.curatorNote}</Text>
            </View>
          </View>
        )}
        {data.meta && (
          <View style={styles.metaGrid}>
            {data.meta.date && <MetaItem icon="calendar" label="TARIH" value={data.meta.date} />}
            {data.meta.venue && <MetaItem icon="map-pin" label="MEKAN" value={data.meta.venue} />}
            {data.meta.seats && <MetaItem icon="users" label="YER" value={data.meta.seats} danger={isWaitlist} />}
          </View>
        )}
        {data.guests && data.guests.length > 0 && (
          <View style={styles.guestsRow}>
            <View style={styles.guestsAvatars}>
              {data.guests.slice(0, 3).map((g, i) => (
                <Image key={i} source={{ uri: g.avatar }} style={[styles.guestAvatar, i > 0 && { marginLeft: -6 }]} />
              ))}
            </View>
            <View style={styles.guestsTextWrap}>
              <Text style={styles.guestsLabel}>ÖZEL MİSAFİRLER</Text>
              <Text style={styles.guestsText} numberOfLines={1}>{formatGuestNames(data.guests)}</Text>
            </View>
          </View>
        )}
        {computed.availText && <LiveAvailabilityBar availText={computed.availText} percent={computed.availPercent} state={computed.availState} viewerStatus={computed.viewerStatus} />}
        <View style={styles.fullFooter}>
          <View style={styles.fullFooterLeft}>
            {data.footerNote && <Text style={styles.footerNoteText} numberOfLines={1}>{data.footerNote}</Text>}
          </View>
          <TouchableOpacity style={ctaStyle} onPress={() => onCta?.(data)}>
            <Text style={ctaTextStyle}>{ctaLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function MetaItem({ icon, label, value, danger }) {
  return (
    <View style={styles.metaItem}>
      <View style={styles.metaIconRow}>
        <Icon name={icon} size={9} color={colors.text500} strokeWidth={2} />
        <Text style={styles.metaLabel}>{label}</Text>
      </View>
      <Text style={[styles.metaValue, danger && { color: colors.live }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function formatGuestNames(guests) {
  if (guests.length === 1) return guests[0].name;
  if (guests.length === 2) return `${guests[0].name} & ${guests[1].name}`;
  return `${guests[0].name} & ${guests[1].name} +${guests.length - 2}`;
}

const styles = StyleSheet.create({
  heroContainer: { backgroundColor: '#0a0a0a', borderRadius: radii.lg, overflow: 'hidden', minHeight: 280, position: 'relative' },
  heroTopBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, zIndex: 2 },
  heroContent: { padding: 16, flex: 1, justifyContent: 'space-between', minHeight: 280, zIndex: 2 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  heroBadgeRow: { flexDirection: 'row', gap: 6, flex: 1, flexWrap: 'wrap' },
  heroBody: { marginTop: 40 },
  datesRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  datesDash: { width: 14, height: 1, backgroundColor: colors.gold },
  datesText: { fontSize: 10.5, fontWeight: '600', color: colors.goldLight || colors.gold, letterSpacing: 1.5, fontFamily: fonts.sansBold },
  heroTitle: { fontFamily: fonts.serifMedium, fontSize: 32, fontWeight: '500', color: '#fff', letterSpacing: -0.8, lineHeight: 33, marginBottom: 6 },
  heroSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontStyle: 'italic', fontFamily: fonts.serif, lineHeight: 17 },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 14 },
  heroStats: { flexDirection: 'row', gap: 12, flex: 1, flexWrap: 'wrap' },
  heroStat: { fontSize: 10.5, color: 'rgba(255,255,255,0.7)' },
  heroStatBold: { color: '#fff', fontFamily: fonts.sansBold, fontWeight: '700' },
  heroCta: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff', borderRadius: radii.pill },
  heroCtaText: { fontSize: 11, fontFamily: fonts.sansBold, fontWeight: '700', color: '#0a0a0a' },
  fullContainer: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, overflow: 'hidden', position: 'relative' },
  fullLeftAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, zIndex: 3 },
  fullCover: { position: 'relative', width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.surfaceMuted },
  fullCoverImage: { width: '100%', height: '100%' },
  fullCoverTop: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 2, gap: 6 },
  fullBadgeRow: { flexDirection: 'row', gap: 5, flex: 1, flexWrap: 'wrap' },
  fullCoverBottom: { position: 'absolute', bottom: 14, left: 16, right: 16, zIndex: 2 },
  fullTitle: { fontFamily: fonts.serifMedium, fontSize: 21, fontWeight: '500', color: '#fff', lineHeight: 23, letterSpacing: -0.3, marginBottom: 3 },
  fullHost: { fontSize: 11, color: 'rgba(255,255,255,0.88)', fontStyle: 'italic', fontFamily: fonts.serif },
  fullBody: { paddingHorizontal: 14, paddingLeft: 17, paddingVertical: 12 },
  collectionLink: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.borderWarm, borderRadius: radii.pill, alignSelf: 'flex-start', marginBottom: 10 },
  collectionLinkText: { fontSize: 9.5, color: colors.goldDeep, fontFamily: fonts.sansSemiBold, fontWeight: '600' },
  collectionLinkStrong: { color: colors.text900, fontFamily: fonts.sansBold, fontWeight: '700' },
  curatorNote: { flexDirection: 'row', gap: 10, padding: 10, paddingLeft: 12, backgroundColor: colors.goldSoft, borderRadius: radii.sm, marginBottom: 10, position: 'relative' },
  curatorNoteAccent: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 2, backgroundColor: colors.gold, borderRadius: 1 },
  curatorNoteIcon: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  curatorNoteBody: { flex: 1, minWidth: 0 },
  curatorNoteLabel: { fontSize: 8.5, fontFamily: fonts.sansBold, fontWeight: '700', letterSpacing: 1.2, color: colors.goldDeep, marginBottom: 2 },
  curatorNoteText: { fontSize: 12, color: colors.text700, fontFamily: fonts.serif, fontStyle: 'italic', lineHeight: 16 },
  metaGrid: { flexDirection: 'row', gap: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.cream, borderRadius: radii.sm, marginBottom: 10 },
  metaItem: { flex: 1, minWidth: 0 },
  metaIconRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  metaLabel: { fontSize: 8, color: colors.text500, letterSpacing: 0.8, fontFamily: fonts.sansSemiBold, fontWeight: '600' },
  metaValue: { fontSize: 11.5, fontFamily: fonts.sansBold, fontWeight: '700', color: colors.text900, lineHeight: 13 },
  guestsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, paddingBottom: 10, borderTopWidth: 1, borderTopColor: colors.borderWarm, borderStyle: 'dashed', marginBottom: 10 },
  guestsAvatars: { flexDirection: 'row' },
  guestAvatar: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.surface },
  guestsTextWrap: { flex: 1, minWidth: 0 },
  guestsLabel: { fontSize: 8.5, fontFamily: fonts.sansBold, fontWeight: '700', letterSpacing: 1, color: colors.goldDeep, marginBottom: 1 },
  guestsText: { fontSize: 11, color: colors.text700 },
  fullFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  fullFooterLeft: { flex: 1, minWidth: 0 },
  footerNoteText: { fontSize: 10.5, color: colors.text500 },
  fullCta: { paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.black, borderRadius: radii.pill },
  fullCtaText: { color: '#fff', fontSize: 11, fontFamily: fonts.sansSemiBold, fontWeight: '600' },
  fullCtaWaitlist: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill },
  fullCtaTextWaitlist: { color: colors.text700, fontSize: 11, fontFamily: fonts.sansSemiBold, fontWeight: '600' },
});
