import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import useAuthStore from '../store/authStore';
import {
  fetchUserProfile,
  updateUserProfile,
  uploadProfilePhoto,
  fetchUserInterests,
  addUserInterest,
  removeUserInterest,
  fetchPassportEntries,
} from '../services/api';

// Pulse-style colors (from edit-profile-pulse-style.html)
const PULSE_BG = '#e0e0e0';
const PULSE_SCREEN_BG = '#f5f5f5';
const PULSE_CARD_BG = '#fff';
const PULSE_HEADER_BG = '#fff';
const PULSE_BORDER = '#e8e8e8';
const PULSE_BORDER_LIGHT = '#f0f0f0';
const PULSE_TEXT = '#000';
const PULSE_TEXT_META = '#666';
const PULSE_TEXT_SUBTLE = '#999';
const PULSE_INPUT_BG = '#f8f8f8';
const PULSE_BTN_BLACK = '#000';
const PULSE_PILL_INACTIVE = '#e8e8e8';
const PULSE_PILL_ACTIVE = '#000';
const PULSE_ADD_PILL_BG = '#f0f0f0';

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const currentUserId = user?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [uniLabelVisible, setUniLabelVisible] = useState(true);
  const [hostedCountVisible, setHostedCountVisible] = useState(false);
  const [regularVitrineVisible, setRegularVitrineVisible] = useState(false);
  const [identityTrack, setIdentityTrack] = useState(user?.identity_track || null);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [rsScore, setRsScore] = useState(null);
  const [interests, setInterests] = useState([]);
  const [newInterestText, setNewInterestText] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [bioQuoteMemoryId, setBioQuoteMemoryId] = useState(null);
  const [bioQuoteText, setBioQuoteText] = useState('');
  const [quoteOptions, setQuoteOptions] = useState([]);
  const [showQuotePicker, setShowQuotePicker] = useState(false);

  useEffect(() => {
    if (!currentUserId) {
      navigation.replace('Login');
      return;
    }
    loadProfile();
  }, [currentUserId]);

  const loadProfile = async () => {
    if (!currentUserId) return;
    try {
      setLoading(true);
      const profile = await fetchUserProfile(currentUserId);
      const interestsList = await fetchUserInterests(currentUserId).catch(() => []);
      const passport = await fetchPassportEntries({ limit: 100 }).catch(() => null);
      const entries = Array.isArray(passport?.entries)
        ? passport.entries
        : Array.isArray(passport)
          ? passport
          : [];
      const quotes = entries
        .filter(
          (e) =>
            (e.entry_type || '') === 'quote' ||
            e.memory_type === 'quote' ||
            e.type === 'quote'
        )
        .map((e) => ({
          id: e.memory_id || e.id,
          text: String(e.content || e.text || e.title || '').trim(),
        }))
        .filter((q) => q.id && q.text);
      setQuoteOptions(quotes);

      setName(profile.name || '');
      const baseName = (profile.name || 'user').trim();
      setUsername(profile.username || `@${baseName.toLowerCase().replace(/\s/g, '')}`);
      setBio(profile.bio || '');
      setLocation(profile.city || '');
      setEmail(profile.email || user?.email || '');
      setPhone(profile.phone || '');
      setRsScore(profile.rs_score != null ? Number(profile.rs_score) : null);
      setInterests(Array.isArray(interestsList) ? interestsList : []);
      setAvatarUrl(profile.avatar_url || null);
      setUniLabelVisible(profile.uni_label_visible !== false && profile.identity_track !== 'identity');
      setHostedCountVisible(Boolean(profile.hosted_count_visible));
      setRegularVitrineVisible(Boolean(profile.regular_vitrine_visible));
      setIdentityTrack(profile.identity_track || user?.identity_track || null);
      const selectedQuoteId = profile.bio_quote_memory_id || profile.bio_quote?.memory_id || null;
      setBioQuoteMemoryId(selectedQuoteId);
      setBioQuoteText(
        profile.bio_quote?.text ||
          quotes.find((q) => String(q.id) === String(selectedQuoteId))?.text ||
          ''
      );
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentUserId) return;
    try {
      setSaving(true);
      await updateUserProfile(currentUserId, {
        name: name.trim() || undefined,
        city: location.trim() || undefined,
        university: undefined,
        ...(identityTrack !== 'identity'
          ? { uni_label_visible: uniLabelVisible }
          : { uni_label_visible: false }),
        hosted_count_visible: hostedCountVisible,
        regular_vitrine_visible: regularVitrineVisible,
        bio_quote_memory_id: bioQuoteMemoryId || null,
      });
      Alert.alert('Success', 'Profile updated', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePhoto = async () => {
    if (!currentUserId) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photo library to change your profile photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]?.base64) return;
      setUploadingPhoto(true);
      const base64 = result.assets[0].base64;
      const mime = result.assets[0].mimeType || 'image/jpeg';
      const prefix = mime.includes('png') ? 'data:image/png;base64,' : 'data:image/jpeg;base64,';
      const data = await uploadProfilePhoto(currentUserId, prefix + base64);
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      Alert.alert('Success', 'Profile photo updated');
    } catch (error) {
      console.error('Error changing photo:', error);
      Alert.alert('Error', error.message || 'Failed to update photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const addInterest = async () => {
    if (!category || !currentUserId) return;
    const normalized = category.toLowerCase();
    if (interests.some((i) => i.toLowerCase() === normalized)) {
      setNewInterestText('');
      return;
    }
    try {
      await addUserInterest(currentUserId, category);
      setInterests([...interests, normalized]);
      setNewInterestText('');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to add interest');
    }
  };

  const removeInterest = async (category) => {
    if (!currentUserId) return;
    try {
      await removeUserInterest(currentUserId, category);
      setInterests(interests.filter((i) => i !== category));
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to remove interest');
    }
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: PULSE_SCREEN_BG }]}>
        <ActivityIndicator size="large" color={PULSE_BTN_BLACK} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.statusBarSpacer} />
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.mainContent}>
            {/* Profile Photo Section */}
            <View style={styles.photoSection}>
              <View style={styles.profilePhoto}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.profilePhotoImg} resizeMode="cover" />
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.changePhotoBtn}
                onPress={handleChangePhoto}
                disabled={uploadingPhoto}
                activeOpacity={0.8}
              >
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.changePhotoBtnText}>Change Photo</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.helperText}>
                Avatar galeriden. Canlı avatar parked (v1.5) — henüz açık değil.
              </Text>
              <View style={styles.rsBadge}>
                <Text style={styles.rsBadgeLabel}>Reliability Score</Text>
                <Text style={styles.rsValue}>{rsScore != null ? String(rsScore) : '—'}</Text>
              </View>
            </View>

            {/* Basic Information Card */}
            <View style={styles.formCard}>
              <Text style={styles.cardTitle}>Basic Information</Text>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Full Name</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={PULSE_TEXT_SUBTLE}
                />
              </View>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Username</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="@username"
                  placeholderTextColor={PULSE_TEXT_SUBTLE}
                />
                <Text style={styles.helperText}>Your unique username on LOCAL</Text>
              </View>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Bio-Quote</Text>
                <TouchableOpacity
                  style={[styles.fieldInput, { justifyContent: 'center', minHeight: 72 }]}
                  onPress={() => setShowQuotePicker((v) => !v)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={{
                      color: bioQuoteText ? PULSE_TEXT : PULSE_TEXT_SUBTLE,
                      fontStyle: bioQuoteText ? 'italic' : 'normal',
                    }}
                    numberOfLines={3}
                  >
                    {bioQuoteText
                      ? `“${bioQuoteText}”`
                      : quoteOptions.length
                        ? 'Quote arşivinden seç…'
                        : 'Henüz quote yok — Ritualde söz bırak'}
                  </Text>
                </TouchableOpacity>
                {bioQuoteMemoryId ? (
                  <TouchableOpacity
                    onPress={() => {
                      setBioQuoteMemoryId(null);
                      setBioQuoteText('');
                    }}
                    style={{ marginTop: 8 }}
                  >
                    <Text style={[styles.helperText, { color: '#B91C1C' }]}>Bio-quote’u kaldır</Text>
                  </TouchableOpacity>
                ) : null}
                {showQuotePicker ? (
                  <View style={{ marginTop: 10, gap: 8 }}>
                    {quoteOptions.length === 0 ? (
                      <Text style={styles.helperText}>Seçilecek quote bulunamadı.</Text>
                    ) : (
                      quoteOptions.map((q) => {
                        const selected = String(q.id) === String(bioQuoteMemoryId);
                        return (
                          <TouchableOpacity
                            key={String(q.id)}
                            style={{
                              padding: 12,
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: selected ? PULSE_BTN_BLACK : PULSE_BORDER,
                              backgroundColor: selected ? '#111' : PULSE_INPUT_BG,
                            }}
                            onPress={() => {
                              setBioQuoteMemoryId(q.id);
                              setBioQuoteText(q.text);
                              setShowQuotePicker(false);
                            }}
                          >
                            <Text
                              style={{
                                color: selected ? '#fff' : PULSE_TEXT,
                                fontStyle: 'italic',
                                fontSize: 13,
                                lineHeight: 18,
                              }}
                              numberOfLines={4}
                            >
                              “{q.text}”
                            </Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                ) : null}
                <Text style={styles.helperText}>
                  Passport’ta tek bio-quote gösterilir; yalnız kendi quote arşivinden seçilir.
                </Text>
              </View>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Bio</Text>
                <TextInput
                  style={styles.fieldTextarea}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell others about yourself..."
                  placeholderTextColor={PULSE_TEXT_SUBTLE}
                  multiline
                  numberOfLines={3}
                />
              </View>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Location</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="City, Country"
                  placeholderTextColor={PULSE_TEXT_SUBTLE}
                />
              </View>
            </View>

            {/* Contact Card */}
            <View style={styles.formCard}>
              <Text style={styles.cardTitle}>Contact</Text>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@example.com"
                  placeholderTextColor={PULSE_TEXT_SUBTLE}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Text style={styles.helperText}>Private, not shown on profile</Text>
              </View>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Phone</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+1 234 567 8900"
                  placeholderTextColor={PULSE_TEXT_SUBTLE}
                  keyboardType="phone-pad"
                />
                <Text style={styles.helperText}>Private, not shown on profile</Text>
              </View>
            </View>

            {/* LOCAL v2 profile visibility */}
            <View style={styles.formCard}>
              <Text style={styles.cardTitle}>Görünürlük</Text>
              {identityTrack !== 'identity' && (user?.university || user?.email_verified) ? (
                <TouchableOpacity
                  style={{ paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between' }}
                  onPress={() => setUniLabelVisible((v) => !v)}
                >
                  <Text style={{ color: PULSE_TEXT }}>Üni-etiket (🎓)</Text>
                  <Text style={{ fontWeight: '700' }}>{uniLabelVisible ? 'Açık' : 'Kapalı'}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={{ paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between' }}
                onPress={() => setHostedCountVisible((v) => !v)}
              >
                <Text style={{ color: PULSE_TEXT }}>Hosted sayısı</Text>
                <Text style={{ fontWeight: '700' }}>{hostedCountVisible ? 'Açık' : 'Kapalı'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between' }}
                onPress={() => setRegularVitrineVisible((v) => !v)}
              >
                <Text style={{ color: PULSE_TEXT }}>Regular vitrini</Text>
                <Text style={{ fontWeight: '700' }}>{regularVitrineVisible ? 'Açık' : 'Kapalı'}</Text>
              </TouchableOpacity>
              <Text style={styles.helperText}>
                Regular vitrini default kapalı — açınca passport’ta private Regular rozeti gösterilebilir.
              </Text>
            </View>

            {/* Interests & Hobbies Card */}
            <View style={styles.formCard}>
              <Text style={styles.cardTitle}>Interests & Hobbies</Text>
              <View style={styles.interestsPills}>
                {interests.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={styles.interestPillActive}
                    onPress={() => removeInterest(category)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.interestPillTextActive}>{category}</Text>
                    <Text style={styles.pillRemove}>×</Text>
                  </TouchableOpacity>
                ))}
                <View style={styles.addInterestRow}>
                  <TextInput
                    style={styles.addInterestInput}
                    value={newInterestText}
                    onChangeText={setNewInterestText}
                    placeholder="+ Add Interest"
                    placeholderTextColor={PULSE_TEXT_META}
                    onSubmitEditing={addInterest}
                    returnKeyType="done"
                  />
                  <TouchableOpacity style={styles.addInterestBtn} onPress={addInterest} activeOpacity={0.8}>
                    <Text style={styles.addInterestBtnText}>+ Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={[styles.helperText, { marginTop: 12 }]}>
                Help others find you based on shared interests
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Submit Section */}
        <View style={styles.submitSection}>
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.9}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PULSE_SCREEN_BG },
  flex1: { flex: 1 },
  statusBarSpacer: { height: 44 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: PULSE_HEADER_BG,
    borderBottomWidth: 1,
    borderBottomColor: PULSE_BORDER,
  },
  backButton: { marginRight: 16, padding: 4 },
  backBtnText: { fontSize: 24, color: PULSE_TEXT },
  headerTitle: { fontSize: 20, fontWeight: '700', color: PULSE_TEXT },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  mainContent: { padding: 16 },
  photoSection: {
    backgroundColor: PULSE_CARD_BG,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'center',
    gap: 16,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#d4d4d4',
    overflow: 'hidden',
  },
  profilePhotoImg: {
    width: '100%',
    height: '100%',
  },
  changePhotoBtn: {
    backgroundColor: PULSE_BTN_BLACK,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  changePhotoBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  rsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PULSE_BORDER_LIGHT,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  rsBadgeLabel: { fontSize: 14, fontWeight: '600', color: PULSE_TEXT_META },
  rsValue: { fontSize: 16, fontWeight: '600', color: PULSE_TEXT },
  formCard: {
    backgroundColor: PULSE_CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: PULSE_TEXT,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: PULSE_BORDER_LIGHT,
  },
  formField: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: PULSE_TEXT_META, marginBottom: 6 },
  fieldInput: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: PULSE_BG,
    borderRadius: 10,
    fontSize: 16,
    color: PULSE_TEXT,
    backgroundColor: PULSE_INPUT_BG,
  },
  fieldTextarea: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: PULSE_BG,
    borderRadius: 10,
    fontSize: 16,
    color: PULSE_TEXT,
    backgroundColor: PULSE_INPUT_BG,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  helperText: { fontSize: 12, color: PULSE_TEXT_SUBTLE, marginTop: 6 },
  interestsPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interestPillActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PULSE_PILL_ACTIVE,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  interestPillTextActive: { color: '#fff', fontSize: 14, fontWeight: '500' },
  pillRemove: { color: '#fff', fontSize: 16, fontWeight: '600' },
  addInterestRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addInterestInput: {
    backgroundColor: PULSE_INPUT_BG,
    borderWidth: 1,
    borderColor: PULSE_BG,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    fontSize: 14,
    color: PULSE_TEXT,
    minWidth: 120,
  },
  addInterestBtn: {
    backgroundColor: PULSE_ADD_PILL_BG,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  addInterestBtnText: { fontSize: 14, fontWeight: '500', color: PULSE_TEXT_META },
  submitSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: PULSE_HEADER_BG,
    borderTopWidth: 1,
    borderTopColor: PULSE_BORDER,
  },
  submitBtn: {
    backgroundColor: PULSE_BTN_BLACK,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
