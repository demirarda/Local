import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { colors, fonts, radii } from '../../theme';
import CurationBadge from './CurationBadge';

/**
 * WideShortCard — Full-width thin horizontal.
 * Partnership announcements, guest highlights, urgent limited, trending micros.
 *
 * Sol accent rengi signal'e göre değişir:
 *   - partner → navy
 *   - special-guest → purple
 *   - trending → orange
 *   - limited → live (red)
 *
 * data: {
 *   id, name, subtitle,                     // "Form Ritueli", "Alessi 100. yılında..."
 *   avatar,                                 // küçük yuvarlak görsel
 *   avatarSquare,                           // true ise square (partner logolar için)
 *   curationSignals,
 *   ctaLabel,                               // "Kayıt", "Hemen Al"
 *   ctaUrgent,                              // kırmızı CTA (limited için)
 *   _computed,
 * }
 */
export function WideShortCard({ data, onPress, onCTA }) {
  const signals = data.curationSignals || [];
  const computed = data._computed || {};
  const mainSignal = signals[0] || 'editors-pick';

  const limitedLabel = mainSignal === 'limited' && computed.limitedText
    ? computed.limitedText
    : undefined;

  const accentColor = getAccentColor(mainSignal);
  const avatarBorderColor = accentColor;

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => onPress?.(data)}
      style={styles.wideContainer}
    >
      {/* Sol accent */}
      <View style={[styles.wideAccent, { backgroundColor: accentColor }]} />

      {/* Avatar */}
      {data.avatar ? (
        <View
          style={[
            styles.wideAvatarWrap,
            data.avatarSquare && styles.wideAvatarSquare,
            { shadowColor: avatarBorderColor },
          ]}
        >
          <View
            style={[
              styles.wideAvatarInner,
              data.avatarSquare && styles.wideAvatarInnerSquare,
            ]}
          >
            <Image
              source={{ uri: data.avatar }}
              style={[
                styles.wideAvatarImg,
                data.avatarSquare && styles.wideAvatarImgSquare,
              ]}
            />
          </View>
        </View>
      ) : (
        // Icon fallback (limited countdown)
        <View
          style={[
            styles.wideIconWrap,
            { borderColor: accentColor, backgroundColor: getAccentSoft(mainSignal) },
          ]}
        >
          <Icon name="clock" size={18} color={accentColor} strokeWidth={2.5} />
        </View>
      )}

      {/* Info */}
      <View style={styles.wideInfo}>
        <View style={styles.wideTopLabel}>
          <CurationBadge
            signal={mainSignal}
            mini
            overrideLabel={limitedLabel}
          />
        </View>
        <Text style={styles.wideName}>{data.name}</Text>
        <Text style={styles.wideSub} numberOfLines={2}>
          {renderSubtitle(data.subtitle)}
        </Text>
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={[
          styles.wideCta,
          data.ctaUrgent && styles.wideCtaUrgent,
        ]}
        onPress={(e) => {
          e.stopPropagation?.();
          onCTA?.(data);
        }}
      >
        <Text style={styles.wideCtaText}>{data.ctaLabel || 'Kayıt'}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

/**
 * Subtitle'da <strong> simülasyonu — metin '**bold**' patterni ile formatlanabilir.
 * Kullanıcı "Kayıt bu gece 23:59'da kapanıyor. **25 Nis · 19:30 · 6 yer kaldı**" gibi yazabilir.
 */
function renderSubtitle(subtitle) {
  if (!subtitle) return null;
  const parts = subtitle.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) => {
    // Çift index'ler normal, tek index'ler bold
    if (i % 2 === 1) {
      return (
        <Text key={i} style={styles.wideSubBold}>
          {part}
        </Text>
      );
    }
    return part;
  });
}

function getAccentColor(signal) {
  switch (signal) {
    case 'partner': return colors.navy;
    case 'special-guest': return colors.purple;
    case 'trending': return colors.orange;
    case 'limited': return colors.live;
    case 'super-event': return colors.gold;
    default: return colors.gold;
  }
}

function getAccentSoft(signal) {
  switch (signal) {
    case 'partner': return '#e3ecf7';
    case 'special-guest': return colors.purpleSoft;
    case 'trending': return colors.orangeSoft;
    case 'limited': return '#fde4e6';
    case 'super-event': return colors.goldSoft;
    default: return colors.goldSoft;
  }
}

/**
 * MicroCard — Küçük thin chip, dual/triple grid içinde.
 * Tek satır duyurular, quick-glance.
 *
 * data: {
 *   id, title,                              // "Brera Atölye Turu"
 *   date, priceLabel,                       // "19 NİS · 14:00", "DAVETİYELİ"
 *   curationSignals,
 *   _computed,
 * }
 */
export function MicroCard({ data, onPress }) {
  const signals = data.curationSignals || [];
  const computed = data._computed || {};
  const mainSignal = signals[0] || 'editors-pick';

  const limitedLabel = mainSignal === 'limited' && computed.limitedText
    ? computed.limitedText
    : undefined;

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => onPress?.(data)}
      style={styles.microContainer}
    >
      <View style={styles.microAccent} />

      <View style={styles.microLabelRow}>
        <CurationBadge
          signal={mainSignal}
          mini
          overrideLabel={limitedLabel}
        />
      </View>

      <Text style={styles.microTitle} numberOfLines={2}>
        {data.title}
      </Text>

      <Text style={styles.microMeta} numberOfLines={1}>
        {data.date && <Text style={styles.microMetaStrong}>{data.date}</Text>}
        {data.date && data.priceLabel ? ' · ' : ''}
        {data.priceLabel || ''}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // ========== WideShort ==========
  wideContainer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingLeft: 17,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  wideAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  wideAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 1.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowColor: 'transparent',
  },
  wideAvatarSquare: {
    borderRadius: 8,
  },
  wideAvatarInner: {
    width: 41,
    height: 41,
    borderRadius: 20.5,
    backgroundColor: colors.screen,
    overflow: 'hidden',
  },
  wideAvatarInnerSquare: {
    borderRadius: 6.5,
  },
  wideAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 20.5,
  },
  wideAvatarImgSquare: {
    borderRadius: 6.5,
  },
  wideIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wideInfo: {
    flex: 1,
    minWidth: 0,
  },
  wideTopLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  wideName: {
    fontSize: 13,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    color: colors.text900,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  wideSub: {
    fontSize: 10.5,
    color: colors.text500,
    fontStyle: 'italic',
    fontFamily: fonts.serif,
    lineHeight: 14,
  },
  wideSubBold: {
    color: colors.text700,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
    fontStyle: 'normal',
  },
  wideCta: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.black,
    borderRadius: radii.pill,
    flexShrink: 0,
  },
  wideCtaUrgent: {
    backgroundColor: colors.live,
  },
  wideCtaText: {
    color: '#fff',
    fontSize: 10.5,
    fontFamily: fonts.sansSemiBold,
    fontWeight: '600',
  },

  // ========== Micro ==========
  microContainer: {
    flex: 1,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.borderWarm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    minHeight: 90,
    position: 'relative',
    gap: 4,
  },
  microAccent: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 2,
    backgroundColor: colors.gold,
    borderRadius: 1,
  },
  microLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  microTitle: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text900,
    lineHeight: 14,
    letterSpacing: -0.2,
  },
  microMeta: {
    fontSize: 9.5,
    color: colors.text500,
    fontFamily: fonts.sansMedium,
    fontWeight: '500',
    letterSpacing: 0.3,
    marginTop: 'auto',
  },
  microMetaStrong: {
    color: colors.text900,
    fontFamily: fonts.sansBold,
    fontWeight: '700',
  },
});
