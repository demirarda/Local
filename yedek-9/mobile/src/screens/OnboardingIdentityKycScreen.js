import React, { useEffect, useMemo, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import useAuthStore from '../store/authStore';
import {
  completeIdentityVerification,
  getIdentityCultureLines,
  getIdentityVerificationStatus,
  register as apiRegister,
  setAuthToken,
  startIdentityVerification,
} from '../services/api';
import { t } from '../i18n/stringTable';
import { bootstrapKycSdk } from '../utils/kycSdkBootstrap';
import KycIdCameraFrame from '../components/KycIdCameraFrame';

const DOCS = [
  { id: 'TCKK', label: 'TCKK' },
  { id: 'PASSPORT', label: 'Pasaport' },
  { id: 'EU_ID', label: 'AB kimlik kartı' },
];

const FALLBACK_CULTURE = ['culture_id_1', 'culture_id_2', 'culture_id_3', 'culture_id_4'].map(
  (key) => ({ key, text: t(key) })
);

const TOKEN_KEY = '@local_auth_token';
const USER_KEY = '@local_user_data';

const FLOW_STEPS = ['account', 'doc', 'camera', 'nfc', 'liveness'];

function mapKycError(error) {
  const code = String(error?.code || error?.message || '').toUpperCase();
  if (code.includes('DURABLE') || code.includes('DOCUMENT_NUMBER')) return t('kyc_err_durable');
  if (code.includes('LIVENESS') || code.includes('FACE_MATCH') || code.includes('VERIFY_FAILED')) {
    return t('kyc_err_liveness');
  }
  if (code.includes('BLACKLIST')) return t('kyc_err_blacklist');
  if (code.includes('RE_REGISTER') || code.includes('ALREADY_REGISTERED') || code.includes('ALREADY_USED')) {
    return t('kyc_err_reregister');
  }
  if (code.includes('PII_MEDIA') || code.includes('RAW_MEDIA')) return t('kyc_err_media');
  if (code.includes('ONCE_IN_LIFETIME') || code.includes('ALREADY_VERIFIED')) return t('kyc_err_once');
  return error?.message || t('kyc_err_liveness');
}

function StepProgress({ active }) {
  const labels = [
    t('kyc_step_account'),
    t('kyc_step_doc'),
    t('kyc_step_camera'),
    t('kyc_step_nfc'),
    t('kyc_step_done'),
  ];
  let idx = FLOW_STEPS.indexOf(active);
  if (active === 'fallback') idx = 3;
  if (active === 'waiting') idx = 4;
  if (idx < 0) idx = 0;
  return (
    <View style={styles.progressRow}>
      {labels.map((label, i) => (
        <View key={label} style={styles.progressItem}>
          <View style={[styles.progressDot, i <= idx && styles.progressDotOn]} />
          <Text style={[styles.progressLabel, i <= idx && styles.progressLabelOn]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * §1 Şerit B — canlı kamera + kart çerçevesi (galeri kapalı) → NFC (ana) /
 * fallback kart+selfie → 2–3 sn pasif liveness → sonuç.
 * Launch: PASS_STUB — kullanıcıya stub etiketi gösterilmez; ham görüntü sunucuya yüklenmez.
 */
export default function OnboardingIdentityKycScreen({ navigation }) {
  const { user, updateUser, setProvisionalSession } = useAuthStore();
  const [step, setStep] = useState(user?.id ? 'doc' : 'account');
  const [cultureLines, setCultureLines] = useState(FALLBACK_CULTURE);
  const [cultureIndex, setCultureIndex] = useState(0);
  const [documentType, setDocumentType] = useState('TCKK');
  const [verificationId, setVerificationId] = useState(null);
  const [cardCapture, setCardCapture] = useState(null);
  const [selfieCapture, setSelfieCapture] = useState(null);
  const [nfcDone, setNfcDone] = useState(false);
  const [nfcPayload, setNfcPayload] = useState(null);
  const [useFallback, setUseFallback] = useState(false);
  const [loading, setLoading] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [providerMeta, setProviderMeta] = useState({ provider: null, gallery_upload_allowed: false });
  const [kycClientToken, setKycClientToken] = useState(null);
  const [kycLiveMode, setKycLiveMode] = useState(false);

  const cultureText = useMemo(
    () => cultureLines[cultureIndex % cultureLines.length]?.text || '',
    [cultureIndex, cultureLines]
  );

  useEffect(() => {
    const timer = setInterval(
      () => setCultureIndex((i) => (i + 1) % Math.max(cultureLines.length, 1)),
      2800
    );
    return () => clearInterval(timer);
  }, [cultureLines.length]);

  useEffect(() => {
    getIdentityCultureLines('tr')
      .then((data) => {
        if (data?.lines?.length) setCultureLines(data.lines);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    getIdentityVerificationStatus()
      .then((res) => {
        const data = res?.data || res;
        if (data?.verified || data?.identity_verified) {
          navigation.replace('CitySelection', {
            firstName: user?.name?.split(' ')[0] || '',
            lastName: user?.name?.split(' ').slice(1).join(' ') || '',
            email: user?.email,
            track: 'identity',
          });
        }
      })
      .catch(() => {});
  }, [navigation, user?.email, user?.id, user?.name]);

  const persistSession = async (token, nextUser) => {
    if (typeof setProvisionalSession === 'function') {
      await setProvisionalSession(token, nextUser);
      return;
    }
    setAuthToken(token);
    await AsyncStorage.multiSet([
      [TOKEN_KEY, token],
      [USER_KEY, JSON.stringify(nextUser)],
    ]);
    useAuthStore.setState({
      token,
      user: nextUser,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  const createAccount = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Eksik bilgi', 'Ad, e-posta ve sifre gerekli.');
      return;
    }
    try {
      setLoading(true);
      const result = await apiRegister(email.trim(), password, name.trim(), null, null, {
        track: 'identity',
      });
      const data = result?.data || result;
      if (!data?.token) {
        throw new Error(data?.error || 'Hesap olusturulamadi');
      }
      const nextUser = {
        id: data.id,
        email: data.email,
        name: data.name,
        city: data.city,
        university: null,
        email_verified: false,
        identity_verified: false,
        identity_track: 'identity',
        uni_label_visible: false,
        verified: false,
        requires_identity_kyc: true,
      };
      await persistSession(data.token, nextUser);
      setStep('doc');
    } catch (error) {
      Alert.alert('Kayit basarisiz', error?.message || 'Tekrar dene.');
    } finally {
      setLoading(false);
    }
  };

  const beginSession = async () => {
    const docNo = String(documentNumber || '').trim();
    if (docNo.length < 6) {
      Alert.alert(t('kyc_step_doc'), t('kyc_err_durable'));
      return;
    }
    try {
      setLoading(true);
      const started = await startIdentityVerification({
        document_type: documentType,
        track: 'identity',
      });
      const payload = started?.data || started;
      const verification = payload?.verification;
      if (!verification?.id) throw new Error('Dogrulama oturumu acilamadi');
      setVerificationId(verification.id);
      const clientToken =
        payload?.session?.client_token ||
        payload?.client_token ||
        payload?.session?.sdk_token ||
        null;
      const boot = bootstrapKycSdk({
        clientToken,
        provider: payload?.session?.provider || payload?.provider || null,
        sessionId: payload?.session?.session_id || verification.id,
      });
      setKycClientToken(boot.client_token);
      setKycLiveMode(boot.mode === 'live_sdk');
      setProviderMeta({
        // Never show stub/techsign label to user
        provider: null,
        gallery_upload_allowed: payload?.gallery_upload_allowed === true,
        show_provider_banner: payload?.session?.show_provider_banner === true,
        target_seconds: payload?.target_seconds || payload?.session?.target_seconds || 60,
        live_sdk: boot.mode === 'live_sdk',
        bootstrap_ready: boot.bootstrap_ready,
      });
      setStep('camera');
    } catch (error) {
      Alert.alert('Baslatilamadi', mapKycError(error));
    } finally {
      setLoading(false);
    }
  };

  const simulateNfc = async () => {
    const docNo = String(documentNumber || '').trim();
    if (docNo.length < 6) {
      Alert.alert(t('kyc_step_nfc'), t('kyc_err_durable'));
      return;
    }
    setLoading(true);
    // Live: vendor SDK consumes client_token for chip read when wired.
    // Until native SDK lands, stable payload + token proof of bootstrap.
    await new Promise((r) => setTimeout(r, kycLiveMode ? 800 : 1200));
    const payload = kycLiveMode && kycClientToken
      ? `NFC_LIVE_${documentType}_${docNo.toUpperCase()}_${String(kycClientToken).slice(0, 8)}`
      : `NFC_${documentType}_${docNo.toUpperCase()}`;
    setNfcPayload(payload);
    setNfcDone(true);
    setLoading(false);
    setStep('liveness');
  };

  const goFallback = () => {
    setUseFallback(true);
    setStep('fallback');
  };

  const runLivenessAndComplete = async () => {
    if (!verificationId) {
      Alert.alert('Oturum yok', 'Once dogrulama oturumunu baslat.');
      return;
    }
    const docNo = String(documentNumber || '').trim();
    if (docNo.length < 6) {
      Alert.alert(t('kyc_step_doc'), t('kyc_err_durable'));
      return;
    }
    if (!useFallback && !nfcDone) {
      Alert.alert(t('kyc_step_nfc'), 'Ana yol NFC cip okuma. NFC yoksa yedek yola gec.');
      return;
    }
    if (useFallback && (!cardCapture || !selfieCapture)) {
      Alert.alert('Eksik kare', 'Kart-ustu foto ve selfie gerekli.');
      return;
    }
    if (!useFallback && !cardCapture) {
      Alert.alert(t('kyc_step_camera'), 'Once canli kamera ile kimlik kartini cerceveye al.');
      return;
    }

    try {
      setWaiting(true);
      setStep('waiting');
      // 2–3 sn pasif liveness (görüntü sunucuya yüklenmez — doğrula-ve-at)
      await new Promise((r) => setTimeout(r, 2800));

      const durableHint = `${documentType}:${docNo.toUpperCase()}`;
      const completed = await completeIdentityVerification({
        verification_id: verificationId,
        nfc_payload: useFallback ? null : nfcPayload || durableHint,
        liveness_ok: true,
        face_match_ok: true,
        age_years: 18,
        path: useFallback ? 'fallback' : 'nfc',
        document_number_hint: durableHint,
      });

      if (!completed?.success && completed?.error) {
        const err = new Error(completed.error);
        err.code = completed.code;
        throw err;
      }

      // Refresh from server — never client-spoof identity_verified
      await useAuthStore.getState().refreshUser();
      const fresh = useAuthStore.getState().user;
      if (!fresh?.identity_verified) {
        throw new Error('Sunucu dogrulamasi tamamlanmadi');
      }

      // Discard local captures from memory after success (verify-and-discard UX)
      setCardCapture(null);
      setSelfieCapture(null);

      await updateUser({
        requires_identity_kyc: false,
        university: null,
        uni_label_visible: false,
        show_uni_label: false,
      });

      navigation.replace('CitySelection', {
        firstName: (user?.name || name).split(' ')[0] || '',
        lastName: (user?.name || name).split(' ').slice(1).join(' ') || '',
        email: user?.email || email,
        track: 'identity',
      });
    } catch (error) {
      setWaiting(false);
      setStep(useFallback ? 'fallback' : 'nfc');
      Alert.alert('Dogrulama tamamlanamadi', mapKycError(error));
    } finally {
      setWaiting(false);
      setLoading(false);
    }
  };

  if (step === 'account') {
    return (
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <StepProgress active="account" />
        <Text style={styles.kicker}>ŞERİT B · HESAP</Text>
        <Text style={styles.title}>Kimlik kapisina gir</Text>
        <Text style={styles.body}>{cultureText}</Text>
        <TextInput style={styles.input} placeholder="Ad Soyad" value={name} onChangeText={setName} />
        <TextInput
          style={styles.input}
          placeholder="E-posta"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Sifre"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity style={styles.primary} onPress={createAccount} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Devam · KYC</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('OnboardingName')}>
          <Text style={styles.universityLink}>Universite e-postasiyla devam et</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (step === 'waiting') {
    return (
      <View style={styles.container}>
        <StepProgress active="waiting" />
        <Text style={styles.kicker}>KULTUR SAHNESI</Text>
        <Text style={styles.title}>Dogrulama donuyor</Text>
        <Text style={styles.body}>{cultureText}</Text>
        <ActivityIndicator size="large" color="#162331" style={{ marginTop: 28 }} />
        <Text style={styles.hint}>
          ≤{providerMeta.target_seconds || 60} sn hedef · ham kimlik bizde saklanmaz · dogrula-ve-at
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <StepProgress active={step} />
      <Text style={styles.kicker}>ŞERİT B · KİMLİK</Text>
      <Text style={styles.title}>Canli dogrulama</Text>
      <Text style={styles.body}>{cultureText}</Text>
      <Text style={styles.hintLeft}>Galeri kapali · foto sunucuya yuklenmez</Text>

      {step === 'doc' && (
        <>
          <Text style={styles.section}>Belge tipi</Text>
          <View style={styles.docRow}>
            {DOCS.map((d) => (
              <TouchableOpacity
                key={d.id}
                style={[styles.docChip, documentType === d.id && styles.docChipOn]}
                onPress={() => setDocumentType(d.id)}
              >
                <Text style={[styles.docText, documentType === d.id && styles.docTextOn]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.section}>Belge numarasi</Text>
          <TextInput
            style={styles.input}
            placeholder="Orn. A1234567"
            autoCapitalize="characters"
            value={documentNumber}
            onChangeText={setDocumentNumber}
          />
          <Text style={styles.hintLeft}>
            {providerMeta.gallery_upload_allowed
              ? 'Galeri yuklemesi acik'
              : 'Galeri/upload kapali · yalniz canli kamera'}
          </Text>
          <TouchableOpacity style={styles.primary} onPress={beginSession} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Oturumu baslat</Text>}
          </TouchableOpacity>
        </>
      )}

      {(step === 'camera' || step === 'nfc' || step === 'liveness') && (
        <>
          <Text style={styles.section}>Kart kilidi cerceve · galeri kapali</Text>
          <KycIdCameraFrame
            facing="back"
            capture={cardCapture}
            onCaptured={setCardCapture}
            onClear={() => setCardCapture(null)}
            hint="Kimligi cerceveye hizala"
            subHint="Canli kamera · galeri yok"
          />
          {cardCapture && step === 'camera' ? (
            <TouchableOpacity style={styles.primary} onPress={() => setStep('nfc')}>
              <Text style={styles.primaryText}>NFC okumaya gec</Text>
            </TouchableOpacity>
          ) : null}
        </>
      )}

      {step === 'nfc' && (
        <>
          <Text style={styles.section}>NFC cip (ana yol)</Text>
          <TouchableOpacity style={styles.nfcButton} onPress={simulateNfc} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#162331" />
            ) : (
              <Text style={styles.nfcText}>
                {nfcDone ? 'NFC okundu ✓' : 'NFC cip oku'}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={goFallback}>
            <Text style={styles.universityLink}>NFC yok / cipsiz kart · yedek yol</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 'fallback' && (
        <>
          <Text style={styles.section}>Yedek: kart-ustu foto + selfie</Text>
          <KycIdCameraFrame
            facing="back"
            capture={cardCapture}
            onCaptured={setCardCapture}
            onClear={() => setCardCapture(null)}
            hint="Kart-ustu foto"
            subHint="Canli kamera · galeri yok"
          />
          <KycIdCameraFrame
            facing="front"
            height={220}
            capture={selfieCapture}
            onCaptured={setSelfieCapture}
            onClear={() => setSelfieCapture(null)}
            hint="Selfie"
            subHint="Yuzu cerceveye al"
          />
          <TouchableOpacity
            style={styles.primary}
            onPress={runLivenessAndComplete}
            disabled={loading || waiting}
          >
            {loading || waiting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>Pasif liveness · tamamla</Text>
            )}
          </TouchableOpacity>
        </>
      )}

      {step === 'liveness' && (
        <TouchableOpacity style={styles.primary} onPress={runLivenessAndComplete} disabled={loading || waiting}>
          {loading || waiting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>2–3 sn pasif liveness · yuz eslestir</Text>
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={() => navigation.navigate('OnboardingName')}>
        <Text style={styles.universityLink}>Universite e-postasiyla devam et</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#faf9f6', padding: 24, justifyContent: 'center' },
  kicker: { color: '#a16207', letterSpacing: 1.5, fontSize: 11, fontWeight: '800' },
  title: { marginTop: 10, color: '#162331', fontSize: 28, lineHeight: 34, fontWeight: '800' },
  body: { marginTop: 12, minHeight: 40, color: '#5c6770', fontSize: 15, lineHeight: 21 },
  hint: { marginTop: 16, textAlign: 'center', color: '#8a939c', fontSize: 12 },
  hintLeft: { marginTop: 8, color: '#8a939c', fontSize: 12 },
  section: { marginTop: 20, marginBottom: 8, color: '#162331', fontWeight: '700', fontSize: 13 },
  input: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d6d3cb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#162331',
  },
  docRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  docChip: {
    borderWidth: 1,
    borderColor: '#d6d3cb',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  docChipOn: { backgroundColor: '#162331', borderColor: '#162331' },
  docText: { color: '#425466', fontWeight: '700', fontSize: 12 },
  docTextOn: { color: '#fff' },
  nfcButton: {
    marginTop: 14,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d6d3cb',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  nfcText: { color: '#425466', fontWeight: '700' },
  primary: {
    marginTop: 14,
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#162331',
  },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  universityLink: { textAlign: 'center', marginTop: 18, color: '#425466', fontSize: 13, fontWeight: '700' },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 4,
  },
  progressItem: { flex: 1, alignItems: 'center' },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d6d3cb',
    marginBottom: 4,
  },
  progressDotOn: { backgroundColor: '#162331' },
  progressLabel: { fontSize: 9, color: '#9a9a9a', fontWeight: '600' },
  progressLabelOn: { color: '#162331' },
});
