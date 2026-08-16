import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

import RepostedBadge from './RepostedBadge';
import PulseRing from './PulseRing';

const TIME_STATE_LABELS = {
  live_now: 'Şimdi Canlı',
  starting_soon: 'Başlamak Üzere',
  almost_full: 'Neredeyse Dolu',
  reopened: 'Yeniden Açıldı',
};

const ENTRY_TYPE_LABELS = {
  open: 'Herkese Açık',
  request_seat: 'Yer İste',
  invite_only: 'Sadece Davetli',
};

export function RitualCard({ ritual, onPress }) {
  const getTimeLabel = () => {
    if (ritual.time_state === 'live_now') {
      return 'Şimdi Canlı';
    }
    if (ritual.time_state === 'starting_soon') {
      const startTime = new Date(ritual.start_time);
      const now = new Date();
      const minutes = Math.floor((startTime - now) / 60000);
      return `${minutes}dk sonra`;
    }
    if (ritual.time_state === 'almost_full') {
      const remaining = ritual.capacity - ritual.current_attendees;
      return `${remaining} koltuk kaldı`;
    }
    return TIME_STATE_LABELS[ritual.time_state] || '';
  };

  // Mask host name: show only first letter + "Host"
  const getMaskedHostName = (name) => {
    if (!name || name.trim() === '') return 'Host';
    const firstLetter = name.trim().charAt(0).toUpperCase();
    return `${firstLetter} Host`;
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <RepostedBadge
        repostCount={ritual.repost_count}
        repostedAt={ritual.reposted_at}
        compact
      />
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {ritual.title}
          </Text>
          {ritual.type && (
            <Text style={styles.type} numberOfLines={1}>
              {ritual.type}
            </Text>
          )}
          {ritual.spark_born ? (
            <Text style={{ fontSize: 10, color: '#b45309', marginTop: 2 }}>⚡ SPARK'tan doğdu</Text>
          ) : null}
          {(ritual.has_fee || ritual.fee?.amount != null || ritual.fee_amount != null) ? (
            <Text style={styles.feeBadge}>
              ₺{Number(ritual.fee?.amount ?? ritual.fee_amount).toFixed(
                Number(ritual.fee?.amount ?? ritual.fee_amount) % 1 === 0 ? 0 : 2
              )}
            </Text>
          ) : null}
          {ritual.local_takeover ? (
            <Text style={{ fontSize: 10, color: '#0f766e', fontWeight: '700', marginTop: 2 }}>
              LOCAL TAKEOVER · mekan sadece LOCAL'e
            </Text>
          ) : null}
          {ritual.audience_label ? (
            <Text style={{ fontSize: 10, color: ritual.audience_match ? '#1d4ed8' : '#64748b', marginTop: 2 }}>
              {ritual.audience_label}
              {ritual.audience_match ? ' · sana uygun' : ''}
            </Text>
          ) : null}
          {ritual.featured_event?.title ? (
            <Text style={{ fontSize: 10, color: '#92400e', marginTop: 2 }}>
              ★ {ritual.featured_event.title}
            </Text>
          ) : null}
          {ritual.series?.card_label || (ritual.series_id && ritual.series_week) ? (
            <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
              {ritual.series?.card_label ||
                `${ritual.series?.series_name || ritual.title} · ${ritual.series_week}. hafta`}
            </Text>
          ) : ritual.type_badge === 'Seri' || ritual.time_type === 'recurring' ? (
            <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Seri</Text>
          ) : null}
        </View>
        <PulseRing
          mode={
            ritual.pulse?.mode ||
            (ritual.time_state === 'live_now' || ritual.status === 'live'
              ? 'LIVE'
              : ritual.status === 'archived' || ritual.status === 'ended'
                ? 'ARCHIVE'
                : 'PRELOBBY')
          }
          ratio={
            ritual.pulse?.value ??
            ritual.pulse?.rq_average ??
            ritual.pulse?.occupancy_ratio ??
            (Number(ritual.capacity) > 0
              ? Number(ritual.current_attendees || 0) / Number(ritual.capacity)
              : 0)
          }
          count={Number(ritual.pulse?.count ?? ritual.current_attendees ?? 0)}
          checkinRatio={ritual.pulse?.checkin_ratio ?? ritual.checkin_ratio}
          memoryTempo={ritual.pulse?.memory_tempo ?? ritual.memory_tempo}
          rqAverage={ritual.pulse?.rq_average ?? ritual.rq_average}
          liveMix={ritual.pulse?.live_mix}
          lowThreshold={ritual.pulse?.bands?.low ?? 0.4}
          midThreshold={ritual.pulse?.bands?.mid ?? 0.7}
        />
      </View>

      <View style={styles.body}>
        <Text style={styles.venue} numberOfLines={1}>
          📍 {ritual.venue_name}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>
            {ritual.current_attendees}/{ritual.capacity} people
          </Text>
          <Text style={styles.metaText}>
            {ENTRY_TYPE_LABELS[ritual.entry_type]}
          </Text>
        </View>
      </View>

      {ritual.host && (
        <View style={styles.footer}>
          <View style={styles.hostRow}>
            <Text style={styles.hostText}>
              {getMaskedHostName(ritual.host.name)}
            </Text>
            {ritual.is_host_verified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedBadgeText}>✓ Dogrulanmis Host</Text>
              </View>
            )}
            {ritual.is_venue_verified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedBadgeText}>✓ Dogrulanmis Mekan</Text>
              </View>
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  type: {
    fontSize: 14,
    color: '#666',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  badgeLive: {
    backgroundColor: '#ff4444',
  },
  badgeStarting: {
    backgroundColor: '#ffaa00',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  feeBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
    backgroundColor: '#dcfce7',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  body: {
    marginBottom: 8,
  },
  venue: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: 12,
    color: '#666',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 8,
    marginTop: 8,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  hostText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  verifiedBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
});
