import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import useAuthStore from '../store/authStore';

export default function VerifyEmailScreen({ route, navigation }) {
  const { email, token, autoSend, password, codeSent: initialCodeSent, devCode: initialDevCode, venueApplyAfter, city: registerCity } = route.params || {};
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(!!token);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [codeSent, setCodeSent] = useState(!!token || !!initialCodeSent);
  const [showOb06, setShowOb06] = useState(false);
  const [devCodeHint, setDevCodeHint] = useState(initialDevCode ? String(initialDevCode) : '');
  const inputRefs = useRef([]);
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);

  const verifyEmail = useAuthStore(state => state.verifyEmail);
  const verifyEmailCode = useAuthStore(state => state.verifyEmailCode);
  const resendVerification = useAuthStore(state => state.resendVerification);
  const login = useAuthStore(state => state.login);

  useEffect(() => {
    if (token) {
      handleVerify(token);
    }
  }, [token]);
  useEffect(() => {
    if (!autoSend || !email) return;
    handleResend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend, email]);

  useEffect(() => {
    if (verifying) return;
    if (!codeSent || secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [secondsLeft, verifying, codeSent]);

  const mmss = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;

  const handleVerify = async (verifyToken) => {
    setVerifying(true);
    setLoading(true);
    
    const result = await verifyEmail(verifyToken);
    setLoading(false);
    setVerifying(false);

    if (result.success) {
      if (password) {
        const loginResult = await login(email, password, true);
        if (loginResult.success) {
          return;
        }
      }
      setShowOb06(true);
    } else {
      Alert.alert('Verification Failed', result.error || 'Invalid or expired token');
    }
  };

  const handleResend = async () => {
    if (!email) {
      Alert.alert('Error', 'Email address is required');
      return;
    }

    setLoading(true);
    const result = await resendVerification(email);
    setLoading(false);

    if (result.success) {
      if (result.dev_code) {
        setDevCodeHint(String(result.dev_code));
      }
      Alert.alert('Kod Gonderildi', 'Dogrulama kodu e-posta adresine gonderildi.');
      setSecondsLeft(300);
      setCodeSent(true);
      setCode(['', '', '', '', '', '']);
      setIsSubmittingCode(false);
      setTimeout(() => {
        inputRefs.current[0]?.focus?.();
      }, 50);
    } else {
      Alert.alert('Error', result.error || 'Failed to resend verification email');
    }
  };

  const onCodeChange = (idx, value) => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    setCode((prev) => {
      const next = [...prev];
      next[idx] = digit;
      const joined = next.join('');
      if (digit && idx < 5) {
        setTimeout(() => inputRefs.current[idx + 1]?.focus?.(), 0);
      }
      if (codeSent && !isSubmittingCode && joined.length === 6 && !next.includes('')) {
        setIsSubmittingCode(true);
        setTimeout(() => {
          handleCodeSubmit(joined);
        }, 0);
      }
      return next;
    });
  };

  const onCodeKeyPress = (idx, key) => {
    if (key === 'Backspace' && !code[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus?.();
    }
  };

  const handleCodeSubmit = async (forcedCode) => {
    const entered = forcedCode || code.join('');
    if (entered.length !== 6) {
      setIsSubmittingCode(false);
      Alert.alert('Code required', 'Please enter all 6 digits.');
      return;
    }
    if (!email) {
      setIsSubmittingCode(false);
      Alert.alert('E-posta gerekli', 'Dogrulama icin e-posta adresi bulunamadi.');
      return;
    }
    if (!codeSent || secondsLeft <= 0) {
      setIsSubmittingCode(false);
      Alert.alert('Kod gecersiz', 'Kod suresi doldu. Lutfen yeni kod iste.');
      return;
    }

    setLoading(true);
    const result = await verifyEmailCode(email, entered);
    setLoading(false);
    setIsSubmittingCode(false);

    if (!result.success) {
      Alert.alert('Dogrulama Basarisiz', result.error || 'Gecersiz veya suresi dolmus kod.');
      return;
    }

    if (password) {
      const loginResult = await login(email, password, true);
      if (loginResult.success) {
        return;
      }
    }

    setShowOb06(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <MaterialIcons name="email" size={80} color="#D4AF37" style={styles.icon} />
        
        <Text style={styles.title}>
          {verifying ? 'E-posta dogrulaniyor...' : 'Neredeyse hazirsin'}
        </Text>
        
        <Text style={styles.subtitle}>
          {verifying
            ? 'E-posta adresin dogrulanirken lutfen bekle.'
            : email
            ? `${email} adresinle dogrulama kodunu al ve hesabi aktive et.`
            : 'E-posta dogrulama kodunu girerek hesabini aktive et.'}
        </Text>

        {verifying && (
          <ActivityIndicator size="large" color="#D4AF37" style={styles.loader} />
        )}

        {!verifying && !showOb06 && (
          <>
            <View style={styles.codeWrap}>
              <Text style={styles.codeTitle}>6 haneli kodu gir</Text>
              {!codeSent ? (
                <Text style={styles.codeHint}>Once dogrulama kodunu gonder.</Text>
              ) : null}
              <View style={styles.codeRow}>
                {code.map((d, i) => (
                  <TextInput
                    key={i}
                    style={styles.codeBox}
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    value={d}
                    onChangeText={(v) => onCodeChange(i, v)}
                    onKeyPress={({ nativeEvent }) => onCodeKeyPress(i, nativeEvent.key)}
                    keyboardType="number-pad"
                    maxLength={1}
                    editable={codeSent}
                  />
                ))}
              </View>
              <Text style={styles.timerText}>Kodun gecerlilik suresi: {mmss}</Text>
              {devCodeHint ? (
                <Text style={styles.devHint}>Dev kodu: {devCodeHint}</Text>
              ) : null}
              {secondsLeft <= 0 && codeSent ? (
                <Text style={styles.expiredText}>Kod suresi doldu. Yeni kod gonder.</Text>
              ) : null}
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleResend}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="refresh" size={20} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>
                    {codeSent ? 'Kodu yeniden gonder' : 'Dogrulama kodu gonder'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.linkText}>Girise don</Text>
            </TouchableOpacity>
          </>
        )}
        {!verifying && showOb06 && (
          <View style={styles.ob06Card}>
            <MaterialIcons name="check-circle" size={56} color="#16a34a" />
            <Text style={styles.ob06Title}>OB-06 · Dogrulama Basarili</Text>
            <Text style={styles.ob06Sub}>Universite teyidin alindi. Hesabini acmak icin devam et.</Text>
            <View style={styles.uniPill}>
              <MaterialIcons name="school" size={14} color="#166534" />
              <Text style={styles.uniPillText}>{email || 'University email verified'}</Text>
            </View>
            <TouchableOpacity
              style={styles.ob06Btn}
              onPress={() => navigation.replace('VerifySuccess', {
                email,
                verifiedUniversity: true,
                password,
                venueApplyAfter,
                city: registerCity,
              })}
            >
              <Text style={styles.ob06BtnText}>Devam et</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
  },
  icon: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  loader: {
    marginTop: 24,
  },
  codeWrap: {
    width: '100%',
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ececec',
    padding: 12,
  },
  codeTitle: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
  },
  codeHint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
    fontWeight: '600',
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  codeBox: {
    width: 44,
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    backgroundColor: '#fff',
  },
  timerText: {
    marginTop: 10,
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
  expiredText: {
    marginTop: 8,
    textAlign: 'center',
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '700',
  },
  devHint: {
    marginTop: 8,
    textAlign: 'center',
    color: '#92400e',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 8,
  },
  button: {
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  linkButton: {
    paddingVertical: 12,
  },
  linkText: {
    fontSize: 14,
    color: '#D4AF37',
    fontWeight: '600',
  },
  ob06Card: {
    width: '100%',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 8,
  },
  ob06Title: {
    color: '#166534',
    fontSize: 16,
    fontWeight: '800',
  },
  ob06Sub: {
    color: '#166534',
    fontSize: 13,
    textAlign: 'center',
  },
  uniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dcfce7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  uniPillText: {
    color: '#166534',
    fontWeight: '700',
    fontSize: 12,
  },
  ob06Btn: {
    marginTop: 4,
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ob06BtnText: {
    color: '#ecfdf5',
    fontWeight: '800',
  },
});
