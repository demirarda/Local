import React from 'react';
import { View, Text, Image, ImageBackground, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Feather';
import { colors, fonts, radii } from '../../theme';
import CurationBadge from './CurationBadge';

/**
 * HalfTallCard — Dual grid, 3/5 ratio.
 * Orta önemli ritüeller için. Alt yarıda curator mini note + meta + CTA.
 *
 * data: {
 *   id, title, date,                       // "Soviet Modernism", "17 NİS · 20:00"
 *   coverImage,
 *   curationSignals,
 *   curatorMini,                            // kısa 1-2 satır
 *   seats: '6/12',                          // doluluk
 *   priceLabel,                             // "35€" veya "DAVETİYELİ"
 *   viewerCountInline,                      // "9 kişi bakıyor" (alt satır)
 *   _computed,
 * }
 */
export function HalfTallCard({ data, onPress, onCTA }) {
  const signals = data.curationSignals || [];
  const computed = data._computed || {};
  const isWaitlist = computed.availState === 'waitlist-only';

  const mainSignal = signals[0] || 'editors-pick';
  const limitedLabel = mainSignal === 'limited' && computed.limitedText
    ? computed.limitedText
    : undefined;

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => onPress?.(data)}
      style={styles.halfTall}
    >
      {/* Altın sol accent */}
      <View style={styles.halfTallAccent} />

      {/* Cover */}
      <View style={styles.htCover}>
        <Image source={{ uri: data.coverImage }} style={styles.htCoverImage} />
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'transparent', 'rgba(0,0,0,0.7)']}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.htCoverTop}>
          <CurationBadge
            signal={mainSignal}
            onDark
            mini
            overrideLabel={limitedLabel}
          />
        </View>

        <View style={styles.htCoverBottom}>
          <Text style={styles.htTitle} numberOfLines={2}>
            {data.title}
          </Text>
          {data.date && <Text style={styles.htDate}>{data.date}</Text>}
        </View>
      </View>

      {/* Body */}
      <View style={styles.htBody}>
        {/* Meta row: doluluk + fiyat */}
        <View style={styles.htMetaRow}>
          {data.seats && (
            <View style={styles.htMetaItem}>
              <Icon name="users" size={10} color={colors.text500} strokeWidth={2} />
              <Text style={styles.htMetaText}>
                <Text style={styles.htMetaStrong}>{data.seats.split('/')[0]}</Text>
                {`/${data.seats.split('/')[1]}`}
              </Text>
            </View>
          )}
          {data.priceLabel && (
            <Text style={styles.htPriceLabel}>{data.priceLabel}</Text>
          )}
        </View>

        {/* Curator mini note */}
        {data.curatorMini && (
          <View style={styles.htCuratorMini}>
            <Text style={styles.htCuratorText} numberOfLines={2}>
              {data.curatorMini}
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.htFooter}>
          {data.viewerCountInline ? (
            <Text
              style={[
                styles.htFooterMeta,
                computed.viewerStatus?.hot && { color: colors.live },
                computed.viewerStatus?.active && !computed.viewerStatus?.hot && { color: colors.orange },
              ]}
            >
              {data.viewerCountInline}
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          <TouchableOpacity
            style={[styles.htCta, isWaitlist && styles.htCtaWaitlist]}
            onPress={(e) => {
              e.stopPropagation?.();
              onCTA?.(data);
            }}
          >
            <Text
              style={[styles.htCtaText, isWaitlist && styles.htCtaTextWaitlist]}
            >
              {isWaitlist ? 'Bekleme' : data.ctaLabel || 'Katıl'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * SquareCard — Dual grid, 1/1.15 ratio.
 * Geçmiş memory'ler, rating yıldızları.
 *
 * data: {
 *   id, title, subtitle,                    // "Fashion Week Closing", "ŞUBAT 2026"
 *   coverImage,
 *   curationSignals,                        // ['editors-pick'] → 'GEÇMİŞ' label
 *   rating,                                 // 4.9
 *   attendeeCount,                          // 48
 *   isPastMemory,
 * }
 */
export function SquareCard({ data, onPress }) {
  const signals = data.curationSignals || [];
  const mainSignal = signals[0] || 'editors-pick';
  const stars = '★ '.repeat(Math.round(data.rating || 0)).trim();

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => onPress?.(data)}
      style={styles.square}
    >
      <View style={styles.sqCover}>
        <Image source={{ uri: data.coverImage }} style={styles.sqCoverImage} />
        <LinearGradient
          colors={['rgba(0,0,0,0.05)', 'transparent', 'rgba(0,0,0,0.85)']}
          locations={[0, 0.3, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.sqTop}>
          <CurationBadge
            signal={mainSignal}
            onDark
            mini
            overrideLabel={data.isPastMemory ? 'GEÇMİŞ' : undefined}
          />
        </View>

        <View style={styles.sqOverlay}>
          <Text style={styles.sqTitle} numberOfLines={2}>
            {data.title}
          </Text>
          {data.subtitle && (
            <Text style={styles.sqSubtitle}>{data.subtitle}</Text>
          )}
        </View>
      </View>

      <View style={styles.sqFooter}>
        {data.rating != null && (
          <Text style={styles.sqStars}>{stars}</Text>
        )}
        {(data.rating != null || data.attendeeCount != null) && (
          <Text style={styles.sqCount}>
            {data.rating != null ? data.rating.toFixed(1) : ''}
            {data.rating != null && data.attendeeCount != null ? ' · ' : ''}
            {data.attendeeCount != null ? data.attendeeCount : ''}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

/**
 * PosterCard — Portrait 3/4.5 ratio, triple grid içinde.
 * Special guest portraits, magazine cover feeling.
 *
 * data: {
 *   id, name, subtitle,                     // "Ivan Petrov", "Soviet Modernism'de konuşmacı"
 *   guestPortrait,                          // portre foto
 *   dateStrip,                              // "17 NİS"
 *   curationSignals,                        // ['special-guest']
 * }
 */
export function PosterCard({ data, onPress }) {
  const signals = data.curationSignals || ['special-guest'];
  const mainSignal = signals[0];

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => onPress?.(data)}
      style={styles.poster}
    >
      <ImageBackground
        source={{ uri: data.guestPortrait || data.coverImage }}
        style={StyleSheet.absoluteFill}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.2)', 'transparent', 'rgba(0,0,0,0.95)']}
          locations={[0, 0.3, 1]}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <View style={styles.posterContent}>
        <View style={styles.posterTop}>
          <CurationBadge
            signal={mainSignal}
            onDark
            mini
            overrideLabel={mainSignal === 'special-guest' ? 'GUEST' : undefined}
          />
        </View>

        <View style={styles.posterBottom}>
          {data.dateStrip && (
            <Text style={styles.posterDateStrip}>{data.dateStrip}</Text>
          )}
          <Text style={styles.posterTitle} numberOfLines={2}>
            {data.name || data.title}
          </Text>
          {data.subtitle && (
            <Text style={styles.posterSub} numberOfLines={2}>
              {data.subtitle}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // ========== HalfTall ==========
  halfTall: {
    flex: 1,
    aspectRatio: 3 / 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  halfTallAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.gold,
    zIndex: 3,
  },
  htCover: {
    flex: 1.3,
    position: 'relative',
    backgroundColor: colors.surfaceMuted,
  },
  htCoverImage: {
    width: '100%',
    height: '100%',
  },
  htCoverTop: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    zIndex: 2,
  },
  htCoverBottom: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    right: 10,
    zIndex: 2,
  },
  htTitle: {
    fontFamily: fonts.serifMedium,
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    lineHeight: 15,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  htDate: {
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: fonts.sansMedium,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  htBody: {
    paddingHorizontal: 10,
    paddingLeft: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    gap: 6,
  },
  htMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  htMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  htMetaText: {
    fontSize: 10,
    color: colors.text500,
  },
  htMetaStrong: {
    color: colors.text900,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
  },
  htPriceLabel: {
    fontSize: 10,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: colors.text900,
  },
  htCuratorMini: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: colors.goldSoft,
    borderLeftWidth: 2,
    borderLeftColor: colors.gold,
    borderRadius: 6,
  },
  htCuratorText: {
    fontSize: 10.5,
    color: colors.text700,
    fontFamily: fonts.serif,
    fontStyle: 'italic',
    lineHeight: 14,
  },
  htFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    borderStyle: 'dashed',
  },
  htFooterMeta: {
    flex: 1,
    fontSize: 9,
    color: colors.text500,
    fontFamily: fonts.sansMedium,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  htCta: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.black,
    borderRadius: radii.pill,
  },
  htCtaText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
  },
  htCtaWaitlist: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  htCtaTextWaitlist: {
    color: colors.text500,
  },

  // ========== Square ==========
  square: {
    flex: 1,
    aspectRatio: 1 / 1.15,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldSoft,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  sqCover: {
    flex: 1,
    position: 'relative',
    backgroundColor: colors.surfaceMuted,
  },
  sqCoverImage: {
    width: '100%',
    height: '100%',
  },
  sqTop: {
    position: 'absolute',
    top: 9,
    left: 9,
    right: 9,
    zIndex: 2,
  },
  sqOverlay: {
    position: 'absolute',
    bottom: 9,
    left: 11,
    right: 11,
    zIndex: 2,
  },
  sqTitle: {
    fontFamily: fonts.serifMedium,
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
    lineHeight: 16,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  sqSubtitle: {
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.88)',
    fontFamily: fonts.sansMedium,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  sqFooter: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.goldSoft,
    backgroundColor: '#fffef8',
  },
  sqStars: {
    fontSize: 11,
    color: colors.gold,
    letterSpacing: 0.5,
  },
  sqCount: {
    marginLeft: 'auto',
    fontSize: 9,
    color: colors.text500,
    fontFamily: fonts.sansMedium,
    fontWeight: '500',
  },

  // ========== Poster ==========
  poster: {
    flex: 1,
    aspectRatio: 3 / 4.5,
    backgroundColor: '#0a0a0a',
    borderRadius: radii.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  posterContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
    zIndex: 2,
  },
  posterTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  posterBottom: {
    marginTop: 'auto',
  },
  posterDateStrip: {
    fontSize: 9.5,
    fontWeight: '600',
    color: colors.goldLight || colors.gold,
    letterSpacing: 1.5,
    fontFamily: fonts.sansBold,
    marginBottom: 4,
  },
  posterTitle: {
    fontFamily: fonts.serifMedium,
    fontSize: 17,
    fontWeight: '500',
    color: '#fff',
    lineHeight: 18,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  posterSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.75)',
    fontStyle: 'italic',
    fontFamily: fonts.serif,
    lineHeight: 13,
  },
});
