import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { createModReport, fetchZone, scanZoneMarker, startZoneSpark, joinZoneSpark, followZone, unfollowZone, setZoneFollowBell } from '../services/api';
import useConfigStore from '../store/configStore';
import useAuthStore from '../store/authStore';
import ReportModal from '../components/ReportModal';
import FollowBellControls from '../components/FollowBellControls';

const PRIMARY = '#f9a13d';
const TEXT = '#1a1a1a';
const MUTED = '#6b6b6b';

/** v2 §11 zone profili — canlı/arşiv/Aura/forum/dağılım · Trust YOK · §13 zil */
export default function ZoneDetailScreen({ route, navigation }) {
  const zoneId = route.params?.zoneId;
  const [zone, setZone] = useState(route.params?.zone || null);
  const [loading, setLoading] = useState(!route.params?.zone?.live_rituals);
  const [showReport, setShowReport] = useState(false);
  const [following, setFollowing] = useState(false);
  const [bell, setBell] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [bellLoading, setBellLoading] = useState(false);
  const [sparkMeetup, setSparkMeetup] = useState(null);
  const sparkEnabled = useConfigStore((s) => s.config?.zone?.spark_enabled) === true;
  const currentUserId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!zoneId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchZone(zoneId);
        if (!cancelled) {
          setZone(data);
          setFollowing(Boolean(data?.follow?.is_following));
          setBell(Boolean(data?.follow?.bell));
        }
      } catch (e) {
        if (!cancelled) Alert.alert('Hata', e?.message || 'Zone yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  const toggleFollow = async () => {
    if (!zoneId || followLoading) return;
    setFollowLoading(true);
    try {
      if (following) {
        await unfollowZone(zoneId);
        setFollowing(false);
        setBell(false);
      } else {
        await followZone(zoneId, false);
        setFollowing(true);
        setBell(false);
      }
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Takip guncellenemedi');
    } finally {
      setFollowLoading(false);
    }
  };

  const toggleBell = async () => {
    if (!zoneId || !following || bellLoading) return;
    setBellLoading(true);
    try {
      await setZoneFollowBell(zoneId, !bell);
      setBell(!bell);
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Zil guncellenemedi');
    } finally {
      setBellLoading(false);
    }
  };
  const onMarkerScan = async () => {
    try {
      const data = await scanZoneMarker(zoneId || zone?.id);
      Alert.alert('ZONE-KEY', `Marker okundu · +${data?.points_awarded || 1}p`);
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Scan basarisiz');
    }
  };

  const onSpark = async () => {
    try {
      const meetup = await startZoneSpark(zoneId || zone?.id);
      setSparkMeetup(meetup);
      if (meetup?.ritual_id && meetup?.status === 'born') {
        Alert.alert('SPARK', 'Ritual dogdu', [
          {
            text: 'Ac',
            onPress: () => navigation.navigate('RitualDetail', { ritualId: meetup.ritual_id }),
          },
          { text: 'Tamam', style: 'cancel' },
        ]);
        return;
      }
      Alert.alert(
        'SPARK',
        meetup?.card_copy || `${meetup?.member_count || 1} kisi baslatti`
      );
    } catch (e) {
      Alert.alert('SPARK', e?.message || 'Kapali veya basarisiz');
    }
  };

  const onSparkJoin = async () => {
    if (!sparkMeetup?.id) return;
    try {
      const meetup = await joinZoneSpark(sparkMeetup.id);
      setSparkMeetup(meetup);
      if (meetup?.ritual_id) {
        Alert.alert('SPARK', 'Ritual dogdu', [
          {
            text: 'Ac',
            onPress: () => navigation.navigate('RitualDetail', { ritualId: meetup.ritual_id }),
          },
        ]);
      } else {
        Alert.alert('SPARK', meetup?.card_copy || 'Katildin');
      }
    } catch (e) {
      Alert.alert('SPARK', e?.message || 'Join basarisiz');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={PRIMARY} />
      </View>
    );
  }

  if (!zone && !zoneId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Zone bulunamadı</Text>
      </View>
    );
  }

  const live = zone?.live_rituals || [];
  const archive = zone?.archive || [];
  const dist = zone?.distribution?.hakimiyet || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
        <MaterialIcons name="arrow-back" size={22} color={TEXT} />
      </TouchableOpacity>
      <Text style={styles.eyebrow}>ZONE</Text>
      <Text style={styles.title}>{zone?.name || 'Zone'}</Text>
      <Text style={styles.meta}>
        {zone?.marker_type || 'TREE'}
        {zone?.radius_m ? ` · ${zone.radius_m}m` : ''}
      </Text>
      {zone?.geo_lat != null && zone?.geo_lng != null ? (
        <Text style={styles.meta}>
          {Number(zone.geo_lat).toFixed(5)}, {Number(zone.geo_lng).toFixed(5)}
        </Text>
      ) : null}

      {currentUserId ? (
        <FollowBellControls
          following={following}
          bell={bell}
          followLoading={followLoading}
          bellLoading={bellLoading}
          onToggleBell={toggleBell}
          onToggleFollow={toggleFollow}
          followLabel="Zone'u Takip Et"
          followingLabel="Takiptesin"
        />
      ) : null}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Aura</Text>
        <Text style={styles.panelBody}>
          {zone?.aura?.score != null ? zone.aura.score.toFixed(2) : '—'}
          {zone?.aura?.n_eff != null ? ` · ${zone.aura.n_eff} gozlem` : ''}
        </Text>
        <Text style={styles.muted}>Trust yok (zone)</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Canli Rituals</Text>
        {live.length === 0 ? (
          <Text style={styles.muted}>Simdi canli yok</Text>
        ) : (
          live.map((r) => (
            <TouchableOpacity
              key={r.id}
              onPress={() => navigation.navigate('RitualDetail', { ritualId: r.id })}
            >
              <Text style={styles.listItem}>
                {r.title} · {r.joined || 0}/{r.capacity || 0}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Arsiv</Text>
        {archive.length === 0 ? (
          <Text style={styles.muted}>Arsiv bos</Text>
        ) : (
          archive.slice(0, 8).map((r) => (
            <Text key={r.id} style={styles.listItem}>
              {r.title}
            </Text>
          ))
        )}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Forum</Text>
        <Text style={styles.panelBody}>{zone?.forum?.post_count || 0} post</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Dagitim (hakimiyet)</Text>
        {dist.length === 0 ? (
          <Text style={styles.muted}>Veri yok</Text>
        ) : (
          dist.map((d) => (
            <Text key={d.category} style={styles.listItem}>
              {d.category}: {d.n}
            </Text>
          ))
        )}
      </View>

      <TouchableOpacity style={styles.secondaryBtn} onPress={onMarkerScan}>
        <Text style={styles.secondaryBtnText}>ZONE-KEY tara (+1p)</Text>
      </TouchableOpacity>

      {sparkEnabled ? (
        <>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onSpark}>
            <Text style={styles.secondaryBtnText}>SPARK baslat / katil</Text>
          </TouchableOpacity>
          {sparkMeetup?.id ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={onSparkJoin}>
              <Text style={styles.secondaryBtnText}>
                Meetup yenile · {sparkMeetup.member_count || 0}/{sparkMeetup.min_size || 3}
              </Text>
            </TouchableOpacity>
          ) : null}
          {sparkMeetup?.ritual_id ? (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('RitualDetail', { ritualId: sparkMeetup.ritual_id })}
            >
              <Text style={styles.secondaryBtnText}>SPARK Rituali ac</Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : (
        <Text style={[styles.muted, { marginTop: 12 }]}>SPARK kapali (flag)</Text>
      )}

      <Text style={styles.hint}>
        Zone raporları moderasyon + OPS çift kuyruğa düşer.
      </Text>
      <TouchableOpacity style={styles.reportBtn} onPress={() => setShowReport(true)}>
        <Text style={styles.reportBtnText}>Zone bildir</Text>
      </TouchableOpacity>
      <ReportModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        reportType="zone"
        onReport={async (payload) => {
          try {
            await createModReport({
              targetType: 'zone',
              targetId: zoneId || zone?.id,
              categoryKey: payload.category_key || payload.reason,
              description: payload.description,
              queueLane: 'ops',
            });
            Alert.alert('Rapor', 'Zone raporu (mod + OPS) kuyruğa alındı');
            setShowReport(false);
          } catch (e) {
            Alert.alert('Hata', e?.message || 'Rapor gönderilemedi');
          }
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf9f6' },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#faf9f6' },
  back: { marginBottom: 12, alignSelf: 'flex-start' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: PRIMARY },
  title: { fontSize: 26, fontWeight: '700', color: TEXT, marginTop: 4 },
  meta: { fontSize: 14, color: MUTED, marginTop: 6 },
  panel: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e5e0',
  },
  panelTitle: { fontSize: 13, fontWeight: '800', color: TEXT },
  panelBody: { fontSize: 18, fontWeight: '700', color: TEXT, marginTop: 4 },
  listItem: { fontSize: 13, color: TEXT, marginTop: 6 },
  hint: { fontSize: 13, color: MUTED, marginTop: 16, lineHeight: 18 },
  muted: { color: MUTED, fontSize: 13, marginTop: 4 },
  secondaryBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  secondaryBtnText: { color: '#fff', fontWeight: '700' },
  reportBtn: {
    marginTop: 20,
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#b45309',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  reportBtnText: { color: '#b45309', fontWeight: '700' },
});
