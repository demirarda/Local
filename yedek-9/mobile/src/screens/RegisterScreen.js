import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useColorScheme,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import useAuthStore from '../store/authStore';
import { checkUniversityFromEmail } from '../services/api';

const PRIMARY = '#000000';
const BACKGROUND_LIGHT = '#FFFFFF';
const BACKGROUND_DARK = '#0A0A0A';
const BORDER_LIGHT = '#D1D5DB';
const BORDER_DARK = '#27272a';
const TEXT_PRIMARY_LIGHT = '#111827';
const TEXT_PRIMARY_DARK = '#FFFFFF';
const TEXT_MUTED_LIGHT = '#6B7280';
const TEXT_MUTED_DARK = '#9CA3AF';
const PLACEHOLDER_LIGHT = '#9CA3AF';
const PLACEHOLDER_DARK = '#9CA3AF';
const UNI_REQUESTS_KEY = '@local_university_requests';

export default function RegisterScreen({ navigation, route }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [city, setCity] = useState('Milano');
  const [university, setUniversity] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailValid, setEmailValid] = useState(null); // null, true, false
  const [emailError, setEmailError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [manualUniversityName, setManualUniversityName] = useState('');
  const [manualUniversityWebsite, setManualUniversityWebsite] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [registerMode, setRegisterMode] = useState(route?.params?.registerMode || 'student');

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const register = useAuthStore(state => state.register);

  useEffect(() => {
    if (!route?.params) return;
    const p = route.params;
    if (typeof p.email === 'string') setEmail(p.email);
    if (typeof p.firstName === 'string') setFirstName(p.firstName);
    if (typeof p.lastName === 'string') setLastName(p.lastName);
    if (typeof p.city === 'string') setCity(p.city);
    if (typeof p.university === 'string') setUniversity(p.university);
  }, [route?.params]);

  const bg = isDark ? BACKGROUND_DARK : BACKGROUND_LIGHT;
  const borderColor = isDark ? BORDER_DARK : BORDER_LIGHT;
  const textPrimary = isDark ? TEXT_PRIMARY_DARK : TEXT_PRIMARY_LIGHT;
  const textMuted = isDark ? TEXT_MUTED_DARK : TEXT_MUTED_LIGHT;
  const placeholder = isDark ? PLACEHOLDER_DARK : PLACEHOLDER_LIGHT;
  const buttonBg = isDark ? BACKGROUND_LIGHT : PRIMARY;
  const buttonText = isDark ? PRIMARY : BACKGROUND_LIGHT;

  // Real-time university detection when email changes
  useEffect(() => {
    const validateUniversityEmail = async () => {
      if (!email || !email.includes('@')) {
        setEmailValid(null);
        setUniversity('');
        setEmailError('');
        return;
      }

      setCheckingEmail(true);
      setEmailError('');

      try {
        const uniData = await checkUniversityFromEmail(email);
        
        if (uniData && uniData.valid && uniData.name) {
          setUniversity(uniData.name);
          setEmailValid(true);
          setEmailError('');
          if (uniData.city && !city) {
            setCity(uniData.city);
          }
        } else if (uniData?._networkError) {
          setUniversity('');
          setEmailValid(false);
          setEmailError('Universite e-postasi dogrulanamadi');
        } else {
          setUniversity('');
          setEmailValid(false);
          setEmailError('E-posta taninmis bir universite uzantisina ait olmali');
        }
      } catch (error) {
        setEmailValid(false);
        setUniversity('');
        setEmailError('Universite e-postasi dogrulanamadi');
      } finally {
        setCheckingEmail(false);
      }
    };

    // Debounce email check
    const timer = setTimeout(validateUniversityEmail, 500);
    return () => clearTimeout(timer);
  }, [email]);
  useEffect(() => {
    const lower = email.trim().toLowerCase();
    if (!lower.includes('@')) return;
    if (lower.endsWith('.it') || lower.includes('polimi') || lower.includes('unimi')) {
      setCity('Milano');
    }
  }, [email, city]);
  const suggestedCityFromDomain = (() => {
    const lower = email.trim().toLowerCase();
    if (!lower.includes('@')) return null;
    if (lower.endsWith('.it') || lower.includes('polimi') || lower.includes('unimi')) return 'Milano';
    return null;
  })();
  useEffect(() => {
    if (route?.params?.selectedCity) {
      setCity(route.params.selectedCity);
    }
  }, [route?.params?.selectedCity]);

  const handleRegister = async () => {
    setServerError('');

    // Validation
    if (!email || !password || !firstName.trim() || !lastName.trim() || !city) {
      setServerError('Lutfen zorunlu alanlarin tumunu doldur.');
      return;
    }

    if (password.length < 8) {
      setServerError('Sifre en az 8 karakter olmali.');
      return;
    }

    if (password !== confirmPassword) {
      setServerError('Sifreler eslesmiyor.');
      return;
    }

    if (emailValid !== true) {
      setServerError('Lutfen gecerli bir universite e-postasi kullan.');
      return;
    }

    setLoading(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const result = await register(email, password, fullName, city, university);
    setLoading(false);

    if (result.success) {
      const devCode = result.data?.dev_code;
      Alert.alert(
        'Kayit Basarili',
        'Hesabini dogrulamak icin e-postani kontrol et.',
        [
          {
            text: 'Tamam',
            onPress: () =>
              navigation.navigate('VerifyEmail', {
                email,
                password,
                codeSent: true,
                devCode,
                venueApplyAfter: registerMode === 'venue',
                city,
              }),
          },
        ]
      );
    } else {
      let message = result.error || 'Bir seyler ters gitti. Lutfen tekrar dene.';

      if (result.error?.toLowerCase().includes('email already registered')) {
        message = 'Bu e-posta zaten kayitli. Bunun yerine giris yapmayi dene.';
      }

      if (result.error?.toLowerCase().includes('recognized university')) {
        message = 'E-postan taninmis bir universite uzantisina ait olmali.';
      }

      if (result.error?.toLowerCase().includes('failed to register user')) {
        message = 'Hesabini su an olusturamadik. Lutfen birazdan tekrar dene.';
      }

      setServerError(message);
    }
  };

  const handleUniversityRequest = async () => {
    if (!manualUniversityName.trim()) {
      Alert.alert('Eksik Bilgi', 'Lutfen universite adini gir.');
      return;
    }
    setRequestSubmitting(true);
    try {
      const existingRaw = await AsyncStorage.getItem(UNI_REQUESTS_KEY);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const payload = {
        created_at: new Date().toISOString(),
        email: email.trim(),
        university_name: manualUniversityName.trim(),
        website: manualUniversityWebsite.trim() || null,
      };
      await AsyncStorage.setItem(UNI_REQUESTS_KEY, JSON.stringify([payload, ...existing].slice(0, 50)));
      Alert.alert(
        'Talep Gonderildi',
        'Tesekkurler. Universite talebin manuel inceleme icin kaydedildi (genelde 24-48 saat).'
      );
      setManualUniversityName('');
      setManualUniversityWebsite('');
    } catch (_) {
      Alert.alert('Hata', 'Talebin kaydedilemedi. Lutfen tekrar dene.');
    } finally {
      setRequestSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo - L. + LOCAL */}
        <View style={styles.logoWrap}>
          <Text style={[styles.logoL, { color: textPrimary }]}>L.</Text>
          <Text style={[styles.logoLabel, { color: textMuted }]}>LOCAL</Text>
        </View>

        <View style={styles.header}>
          <Text style={[styles.title, { color: textPrimary }]}>Hesap Olustur</Text>
          <Text style={[styles.subtitle, { color: textMuted }]}>
            {registerMode === 'venue' ? 'LOCAL Venue basvurusu icin once hesap ac' : 'Sadece universite ogrencileri'}
          </Text>
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeChip, registerMode === 'student' && styles.modeChipOn, { borderColor }]}
              onPress={() => setRegisterMode('student')}
            >
              <Text style={[styles.modeChipText, registerMode === 'student' && styles.modeChipTextOn, { color: registerMode === 'student' ? '#fff' : textPrimary }]}>
                Bireysel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeChip, registerMode === 'venue' && styles.modeChipOn, { borderColor }]}
              onPress={() => setRegisterMode('venue')}
            >
              <Text style={[styles.modeChipText, registerMode === 'venue' && styles.modeChipTextOn, { color: registerMode === 'venue' ? '#fff' : textPrimary }]}>
                LOCAL Venue
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.microcopy, { color: textMuted }]}>
            {registerMode === 'venue'
              ? 'Kayit sonrasi isletme basvuru formuna yonlendirileceksin. Ayni app icinde mekan yonetimi acilir.'
              : 'Takipci yok, begeni yok. Sadece sehrindeki gercek Rituals. Universite e-postan sadece guvenlik ve kampus erisimi icin kullanilir.'}
          </Text>
        </View>

        {/* University Email */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: textPrimary }]}>Universite E-postasi *</Text>
          <View style={[
            styles.inputContainer,
            { borderColor },
            emailValid === true && styles.inputValid,
            emailValid === false && styles.inputError
          ]}>
            <MaterialIcons
              name="mail"
              size={22}
              color={emailValid === true ? '#22C55E' : emailValid === false ? '#EF4444' : placeholder}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.input, { color: textPrimary }]}
              placeholder="your.email@university.edu"
              placeholderTextColor={placeholder}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            {checkingEmail && (
              <ActivityIndicator size="small" color={placeholder} style={styles.checkingIndicator} />
            )}
            {!checkingEmail && emailValid === true && (
              <MaterialIcons name="check-circle" size={22} color="#22C55E" />
            )}
            {!checkingEmail && emailValid === false && (
              <MaterialIcons name="error" size={22} color="#EF4444" />
            )}
          </View>
          {emailError ? (
            <>
              <Text style={styles.errorText}>{emailError}</Text>
              <Text style={styles.helpLink}>
                Universiten listede yok mu? Bize yaz: hello@local.app
              </Text>
              <View style={styles.noMatchCard}>
                <Text style={styles.noMatchTitle}>Universite bulunamadi mi?</Text>
                <Text style={styles.noMatchSubtitle}>
                  Universiteni manuel inceleme icin gonder (24-48 saat).
                </Text>
                <TextInput
                  style={styles.noMatchInput}
                  placeholder="Universite adi"
                  placeholderTextColor="#9CA3AF"
                  value={manualUniversityName}
                  onChangeText={setManualUniversityName}
                />
                <TextInput
                  style={styles.noMatchInput}
                  placeholder="Universite web sitesi (opsiyonel)"
                  placeholderTextColor="#9CA3AF"
                  value={manualUniversityWebsite}
                  onChangeText={setManualUniversityWebsite}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.noMatchButton, requestSubmitting && styles.registerButtonDisabled]}
                  onPress={handleUniversityRequest}
                  disabled={requestSubmitting}
                >
                  <Text style={styles.noMatchButtonText}>
                    {requestSubmitting ? 'Gonderiliyor...' : 'Universiteyi Gonder'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : emailValid === true && university ? (
            <View style={styles.matchCard}>
              <Text style={styles.successText}>✓ Detected: {university}</Text>
              <Text style={styles.matchCardText}>
                Harika, uzantiniz eslesti. Hesap olustuktan sonra dogrulama e-postasi gonderilecek.
              </Text>
              <TouchableOpacity
                style={styles.sendCodeButton}
                onPress={() => navigation.navigate('VerifyEmail', { email, autoSend: true })}
              >
                <Text style={styles.sendCodeButtonText}>Dogrulama Kodu Gonder</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* Password */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: textPrimary }]}>Sifre *</Text>
          <View style={[styles.inputContainer, { borderColor }]}>
            <MaterialIcons name="lock" size={22} color={placeholder} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: textPrimary }]}
              placeholder="En az 8 karakter"
              placeholderTextColor={placeholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <MaterialIcons
                name={showPassword ? 'visibility' : 'visibility-off'}
                size={22}
                color={placeholder}
              />
            </TouchableOpacity>
          </View>
          {password.length > 0 && (
            <View style={styles.passwordStrengthContainer}>
              <View
                style={[
                  styles.passwordStrengthBar,
                  password.length < 8
                    ? styles.passwordWeak
                    : /[A-Z]/.test(password) && /[0-9]/.test(password)
                    ? styles.passwordStrong
                    : styles.passwordMedium,
                ]}
              />
              <Text style={[styles.passwordStrengthText, { color: textMuted }]}>
                {password.length < 8
                  ? 'Cok kisa'
                  : /[A-Z]/.test(password) && /[0-9]/.test(password)
                  ? 'Guclu sifre'
                  : 'Bir rakam ve buyuk harf eklemek sifreni guclendirir'}
              </Text>
            </View>
          )}
        </View>

        {/* Confirm Password */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: textPrimary }]}>Sifreyi Onayla *</Text>
          <View style={[styles.inputContainer, { borderColor }]}>
            <MaterialIcons name="lock" size={22} color={placeholder} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: textPrimary }]}
              placeholder="Sifreni onayla"
              placeholderTextColor={placeholder}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.eyeIcon}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <MaterialIcons
                name={showConfirmPassword ? 'visibility' : 'visibility-off'}
                size={22}
                color={placeholder}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* First Name */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: textPrimary }]}>Ad *</Text>
          <View style={[styles.inputContainer, { borderColor }]}>
            <MaterialIcons name="person" size={22} color={placeholder} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: textPrimary }]}
              placeholder="Adin"
              placeholderTextColor={placeholder}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
          </View>
        </View>

        {/* Last Name */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: textPrimary }]}>Soyad *</Text>
          <View style={[styles.inputContainer, { borderColor }]}>
            <MaterialIcons name="badge" size={22} color={placeholder} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: textPrimary }]}
              placeholder="Soyadin"
              placeholderTextColor={placeholder}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
          </View>
        </View>

        {/* City */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: textPrimary }]}>Sehir *</Text>
          <View style={[styles.inputContainer, { borderColor }]}>
            <MaterialIcons name="apartment" size={22} color={placeholder} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: textPrimary }]}
              placeholder="Sehrin"
              placeholderTextColor={placeholder}
              value={city}
              editable={false}
              autoCapitalize="words"
            />
            <TouchableOpacity onPress={() => navigation.navigate('CitySelection', { selected: city, suggestedCity: suggestedCityFromDomain || 'Milano' })}>
              <MaterialIcons name="arrow-drop-down" size={24} color={placeholder} />
            </TouchableOpacity>
          </View>
        </View>

        {/* University (Auto-detected) */}
        {university ? (
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: textPrimary }]}>Universite (Otomatik Algilandi)</Text>
            <View style={[styles.universityDisplay, { borderColor: '#22C55E' }]}>
              <MaterialIcons name="school" size={20} color="#22C55E" />
              <Text style={[styles.universityText, { color: textPrimary }]}>{university}</Text>
            </View>
          </View>
        ) : null}

        {/* Create Account Button */}
        <TouchableOpacity
          style={[
            styles.registerButton,
            { backgroundColor: buttonBg },
            (loading || emailValid !== true) && styles.registerButtonDisabled
          ]}
          onPress={handleRegister}
          disabled={loading || emailValid !== true}
          activeOpacity={0.95}
        >
          {loading ? (
            <ActivityIndicator color={buttonText} />
          ) : (
            <Text style={[styles.registerButtonText, { color: buttonText }]}>
              {registerMode === 'venue' ? 'Hesap Olustur ve Basvur' : 'Hesap Olustur'}
            </Text>
          )}
        </TouchableOpacity>

        {serverError ? (
          <Text style={styles.serverErrorText}>{serverError}</Text>
        ) : null}

        {/* Sign In link + footer */}
        <View style={styles.footerBlock}>
          <View style={styles.loginContainer}>
            <Text style={[styles.loginText, { color: textPrimary }]}>Zaten hesabin var mi? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={[styles.loginLink, { color: textPrimary, borderBottomColor: textPrimary }]}>Giris Yap</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Login', { redirectVenueApply: true })}>
            <Text style={[styles.venueLink, { color: textMuted }]}>
              Isletme sahibi misin? LOCAL Venue basvurusu
            </Text>
          </TouchableOpacity>
          <Text style={[styles.legalText, { color: textMuted }]}>
            Hesap olusturarak <Text style={styles.legalLink}>Kullanim Kosullari</Text> ve <Text style={styles.legalLink}>Gizlilik Politikasi</Text> metinlerini kabul edersin
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 32,
    paddingTop: 64,
    paddingBottom: 48,
    flexGrow: 1,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoL: {
    fontSize: 60,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 60,
  },
  logoLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 4.8,
    marginTop: 8,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
  },
  microcopy: {
    fontSize: 14,
    lineHeight: 22,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputValid: {
    borderColor: '#22C55E',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  eyeIcon: {
    padding: 4,
  },
  checkingIndicator: {
    marginLeft: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 6,
  },
  helpLink: {
    fontSize: 12,
    color: '#2563EB',
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  successText: {
    fontSize: 12,
    color: '#22C55E',
    marginTop: 6,
    fontWeight: '500',
  },
  matchCard: {
    marginTop: 8,
    backgroundColor: '#ECFDF5',
    borderColor: '#22C55E',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  matchCardText: {
    marginTop: 4,
    fontSize: 12,
    color: '#166534',
  },
  sendCodeButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#16a34a',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sendCodeButtonText: {
    color: '#ecfdf5',
    fontSize: 11,
    fontWeight: '700',
  },
  noMatchCard: {
    marginTop: 8,
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  noMatchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  noMatchSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#92400E',
  },
  noMatchInput: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: '#FFFFFF',
    color: '#111827',
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  noMatchButton: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    paddingVertical: 10,
  },
  noMatchButtonText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  passwordStrengthContainer: {
    marginTop: 6,
  },
  passwordStrengthBar: {
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
  },
  passwordWeak: {
    backgroundColor: '#F97373',
    width: '33%',
  },
  passwordMedium: {
    backgroundColor: '#FACC15',
    width: '66%',
  },
  passwordStrong: {
    backgroundColor: '#22C55E',
    width: '100%',
  },
  passwordStrengthText: {
    marginTop: 4,
    fontSize: 12,
  },
  universityDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  universityText: {
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  registerButton: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  serverErrorText: {
    marginTop: 12,
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center',
  },
  footerBlock: {
    marginTop: 32,
    alignItems: 'center',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  loginText: {
    fontSize: 15,
  },
  loginLink: {
    fontSize: 15,
    fontWeight: '700',
    borderBottomWidth: 2,
  },
  venueLink: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    textDecorationLine: 'underline',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    marginTop: 4,
  },
  modeChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  modeChipOn: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  modeChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modeChipTextOn: {
    color: '#fff',
  },
  legalText: {
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  legalLink: {
    textDecorationLine: 'underline',
  },
});
