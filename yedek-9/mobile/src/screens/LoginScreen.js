import React, { useState } from 'react';
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

const PRIMARY = '#000000';
const BACKGROUND_LIGHT = '#FFFFFF';
const BACKGROUND_DARK = '#0F0F0F';
const BORDER_LIGHT = '#E5E7EB';
const BORDER_DARK = '#27272a';
const TEXT_PRIMARY_LIGHT = '#111827';
const TEXT_PRIMARY_DARK = '#FFFFFF';
const TEXT_MUTED_LIGHT = '#6B7280';
const TEXT_MUTED_DARK = '#A1A1AA';
const PLACEHOLDER_LIGHT = '#9CA3AF';
const PLACEHOLDER_DARK = '#A1A1AA';

export default function LoginScreen({ navigation, route }) {
  const [email, setEmail] = useState(route?.params?.email || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const login = useAuthStore(state => state.login);
  const setPendingVenueApply = useAuthStore(state => state.setPendingVenueApply);

  const handleLogin = async () => {
    setServerError('');

    if (!email || !password) {
      setServerError('Lutfen e-posta ve sifre alanlarini doldur.');
      return;
    }

    setLoading(true);
    const result = await login(email, password, rememberMe);
    setLoading(false);

    if (result.success) {
      const pendingKyc =
        Boolean(result.data?.user?.requires_identity_kyc) ||
        (result.data?.user?.identity_track === 'identity' &&
          !result.data?.user?.identity_verified &&
          !result.data?.user?.email_verified);

      if (pendingKyc) {
        navigation.replace('OnboardingIdentityKyc');
        return;
      }

      if (route?.params?.redirectVenueApply) {
        setPendingVenueApply({ email });
        navigation.replace('Main');
      } else {
        navigation.replace('Main');
      }
    } else {
      if (result.error?.includes('not verified')) {
        Alert.alert(
          'E-posta Dogrulanmadi',
          result.error,
          [
            { text: 'Iptal', style: 'cancel' },
            {
              text: 'Tekrar Gonder',
              onPress: () => navigation.navigate('VerifyEmail', { email, autoSend: true })
            }
          ]
        );
      } else {
        let message = 'Bir seyler ters gitti. Lutfen tekrar dene.';

        if (result.error?.toLowerCase().includes('invalid email or password')) {
          message = 'E-posta veya sifre hatali.';
        } else if (
          result.error?.toLowerCase().includes('network request failed') ||
          result.error?.toLowerCase().includes('failed to fetch') ||
          result.error?.toLowerCase().includes('timeout')
        ) {
          message = 'Baglanti sorunu. Internetini kontrol edip tekrar dene.';
        }

        setServerError(message);
      }
    }
  };

  const bg = isDark ? BACKGROUND_DARK : BACKGROUND_LIGHT;
  const borderColor = isDark ? BORDER_DARK : BORDER_LIGHT;
  const textPrimary = isDark ? TEXT_PRIMARY_DARK : TEXT_PRIMARY_LIGHT;
  const textMuted = isDark ? TEXT_MUTED_DARK : TEXT_MUTED_LIGHT;
  const placeholder = isDark ? PLACEHOLDER_DARK : PLACEHOLDER_LIGHT;
  const buttonBg = isDark ? BACKGROUND_LIGHT : PRIMARY;
  const buttonText = isDark ? PRIMARY : BACKGROUND_LIGHT;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* LOCAL Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoRow}>
            <Text style={[styles.logoL, { color: textPrimary }]}>L</Text>
            <View style={[styles.logoDot, { backgroundColor: textPrimary }]} />
          </View>
          <Text style={[styles.logoLabel, { color: textPrimary }]}>LOCAL</Text>
        </View>

        <View style={styles.header}>
          <Text style={[styles.title, { color: textPrimary }]}>LOCAL'e Hos Geldin</Text>
          <Text style={[styles.tagline, { color: textMuted }]}>
            Gercek anlarda gercek baglantilar...
          </Text>
          <Text style={[styles.subtitle, { color: textMuted }]}>Devam etmek icin giris yap</Text>
        </View>

        {/* Email Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: textPrimary }]}>E-posta</Text>
          <View style={[styles.inputContainer, { borderColor }]}>
            <MaterialIcons name="mail" size={22} color={placeholder} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: textPrimary }]}
              placeholder="e-posta@ornek.com"
              placeholderTextColor={placeholder}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>
        </View>

        {/* Password Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: textPrimary }]}>Sifre</Text>
          <View style={[styles.inputContainer, { borderColor }]}>
            <MaterialIcons name="lock" size={22} color={placeholder} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: textPrimary }]}
              placeholder="Sifreni gir"
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
        </View>

        {/* Forgot Password Link */}
        <View style={styles.forgotRow}>
          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.forgotPasswordLink}
          >
            <Text style={[styles.forgotPasswordText, { color: textPrimary }]}>
              Sifremi Unuttum
            </Text>
          </TouchableOpacity>
        </View>

        {/* Remember Me */}
        <View style={styles.rememberRow}>
          <TouchableOpacity
            onPress={() => setRememberMe(!rememberMe)}
            style={[
              styles.rememberCheckbox,
              { borderColor },
              rememberMe && { backgroundColor: buttonBg }
            ]}
          >
            {rememberMe && (
              <MaterialIcons name="check" size={14} color={buttonText} />
            )}
          </TouchableOpacity>
          <Text style={[styles.rememberText, { color: textMuted }]}>
            Bu cihazda girisimi acik tut
          </Text>
        </View>

        {/* Login Button */}
        <TouchableOpacity
          style={[
            styles.loginButton,
            { backgroundColor: buttonBg },
            loading && styles.loginButtonDisabled
          ]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.95}
        >
          {loading ? (
            <ActivityIndicator color={buttonText} />
          ) : (
            <Text style={[styles.loginButtonText, { color: buttonText }]}>Giris Yap</Text>
          )}
        </TouchableOpacity>

        {serverError ? (
          <Text style={styles.serverErrorText}>{serverError}</Text>
        ) : null}

        {/* Register Link */}
        <View style={styles.registerContainer}>
          <Text style={[styles.registerText, { color: textMuted }]}>
            Hesabin yok mu?{' '}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={[styles.registerLink, { color: textPrimary }]}>Kayit Ol</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: placeholder }]}>
            Giris yaparak su metinleri kabul edersin:{'\n'}
            <Text style={styles.footerLink}>Kullanim Kosullari</Text> ve <Text style={styles.footerLink}>Gizlilik Politikasi</Text>
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
    alignItems: 'center',
  },
  logoWrap: {
    marginBottom: 48,
    alignItems: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  logoL: {
    fontSize: 72,
    fontWeight: '700',
    letterSpacing: -2,
  },
  logoDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 2,
    marginBottom: 8,
  },
  logoLabel: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 6.4,
    marginTop: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
  },
  tagline: {
    fontSize: 13,
    marginBottom: 6,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
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
  forgotRow: {
    width: '100%',
    alignItems: 'flex-end',
    marginTop: -8,
    marginBottom: 8,
  },
  forgotPasswordLink: {},
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  rememberCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rememberText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    width: '100%',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  serverErrorText: {
    marginTop: 12,
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center',
    width: '100%',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 16,
  },
  registerText: {
    fontSize: 14,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
  },
  footer: {
    width: '100%',
    marginTop: 'auto',
    paddingTop: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  footerLink: {
    textDecorationLine: 'underline',
  },
});
