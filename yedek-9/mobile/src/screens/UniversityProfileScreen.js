import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getUniversityProfile,
  updateUniversityProfile,
  createUniversityOfficialEvent,
} from '../services/api';
import BagliHostlarList from '../components/BagliHostlarList';

const VIS_LABELS = {
  closed: 'Kapalı (yalnız üyeler)',
  external_uni: 'Dış üni',
  everyone: 'Herkes',
};

/** §14 Üni-profili — vitrin · görünürlük · resmi etkinlik · öğrenci Ritualine yetki yok */
export default function UniversityProfileScreen({ navigation, route }) {
  const name = route?.params?.name || route?.params?.university || '';
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [headline, setHeadline] = useState('');
  const [tagline, setTagline] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await getUniversityProfile(name);
      setProfile(data);
      setHeadline(data?.vitrine?.headline || '');
      setTagline(data?.vitrine?.tagline || '');
    } catch (_) {
      setProfile({ name, member_count: 0, locked: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [name]);

  const onSaveVitrine = async () => {
    setSaving(true);
    try {
      await updateUniversityProfile({
        name,
        vitrine: { headline, tagline },
      });
      Alert.alert('Kaydedildi', 'Vitrin güncellendi');
      await load();
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const onSetVisibility = async (visibility) => {
    try {
      await updateUniversityProfile({ name, visibility });
      await load();
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Görünürlük güncellenemedi');
    }
  };

  const onCreateEvent = async () => {
    if (!String(eventTitle).trim()) return;
    try {
      await createUniversityOfficialEvent({ name, title: eventTitle.trim() });
      setEventTitle('');
      await load();
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Etkinlik açılamadı');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← Geri</Text>
      </TouchableOpacity>
      <Text style={styles.kicker}>ÜNİVERSİTE PROFİLİ</Text>
      <Text style={styles.title}>{name || '—'}</Text>
      {loading ? (
        <ActivityIndicator color="#162331" style={{ marginTop: 24 }} />
      ) : profile?.locked ? (
        <Text style={styles.body}>{profile?.note || 'Bu üni profili kapalı.'}</Text>
      ) : (
        <>
          {profile?.vitrine?.headline ? (
            <Text style={styles.headline}>{profile.vitrine.headline}</Text>
          ) : null}
          {profile?.vitrine?.tagline ? (
            <Text style={styles.meta}>{profile.vitrine.tagline}</Text>
          ) : null}
          <Text style={styles.meta}>
            {profile?.member_count ?? 0} görünür üye · {VIS_LABELS[profile?.visibility] || profile?.visibility}
          </Text>
          <Text style={styles.hint}>Öğrenci Ritualsine yetki yok (silme/onay/moderasyon yok).</Text>

          <BagliHostlarList
            hosts={profile?.affiliated_hosts || []}
            onPressHost={(h) =>
              navigation.navigate('SocialPassport', { userId: h.user_id })
            }
          />

          <Text style={styles.section}>Resmi etkinlikler</Text>
          {(profile?.official_events || []).length === 0 ? (
            <Text style={styles.meta}>Henüz yok</Text>
          ) : (
            (profile.official_events || []).map((ev) => (
              <View key={ev.id} style={styles.card}>
                <Text style={styles.cardTitle}>{ev.title}</Text>
                {ev.description ? <Text style={styles.meta}>{ev.description}</Text> : null}
              </View>
            ))
          )}

          {profile?.can_manage ? (
            <View style={styles.adminBox}>
              <Text style={styles.section}>Yönetici</Text>
              <TextInput
                style={styles.input}
                value={headline}
                onChangeText={setHeadline}
                placeholder="Vitrin başlık"
                placeholderTextColor="#9a9a9a"
              />
              <TextInput
                style={styles.input}
                value={tagline}
                onChangeText={setTagline}
                placeholder="Vitrin alt yazı"
                placeholderTextColor="#9a9a9a"
              />
              <TouchableOpacity style={styles.btn} onPress={onSaveVitrine} disabled={saving}>
                <Text style={styles.btnText}>{saving ? '…' : 'Vitrini kaydet'}</Text>
              </TouchableOpacity>
              <Text style={styles.meta}>Görünürlük</Text>
              {Object.keys(VIS_LABELS).map((v) => (
                <TouchableOpacity key={v} style={styles.visRow} onPress={() => onSetVisibility(v)}>
                  <Text style={styles.visText}>
                    {profile?.visibility === v ? '● ' : '○ '}
                    {VIS_LABELS[v]}
                  </Text>
                </TouchableOpacity>
              ))}
              <TextInput
                style={styles.input}
                value={eventTitle}
                onChangeText={setEventTitle}
                placeholder="Resmi etkinlik başlığı"
                placeholderTextColor="#9a9a9a"
              />
              <TouchableOpacity style={styles.btnDark} onPress={onCreateEvent}>
                <Text style={styles.btnText}>Resmi etkinlik aç</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf9f6' },
  content: { padding: 24, paddingTop: 56, paddingBottom: 48 },
  back: { color: '#425466', fontWeight: '700', marginBottom: 18 },
  kicker: { color: '#a16207', letterSpacing: 1.4, fontSize: 11, fontWeight: '800' },
  title: { marginTop: 8, fontSize: 28, fontWeight: '800', color: '#162331' },
  headline: { marginTop: 12, fontSize: 18, fontWeight: '700', color: '#162331' },
  meta: { marginTop: 8, color: '#5c6770', fontWeight: '600' },
  hint: { marginTop: 12, color: '#78716c', lineHeight: 20, fontSize: 13 },
  body: { marginTop: 18, color: '#5c6770', lineHeight: 22 },
  section: { marginTop: 22, fontSize: 13, fontWeight: '800', color: '#162331' },
  card: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e5e0',
  },
  cardTitle: { fontWeight: '700', color: '#162331' },
  adminBox: { marginTop: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e5e0' },
  input: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#162331',
  },
  btn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#f9a13d',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  btnDark: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  btnText: { color: '#fff', fontWeight: '700' },
  visRow: { marginTop: 6 },
  visText: { color: '#162331', fontWeight: '600' },
});
