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
  Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import useAuthStore from '../store/authStore';

export default function ResetPasswordScreen({ route, navigation }) {
  const { token } = route.params || {};
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const resetPassword = useAuthStore(state => state.resetPassword);

  const handleReset = async () => {
    if (!token) {
      Alert.alert('Hata', 'Gecersiz sifirlama anahtari');
      navigation.replace('Login');
      return;
    }

    if (!password || !confirmPassword) {
      Alert.alert('Hata', 'Lutfen tum alanlari doldur');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Hata', 'Sifre en az 8 karakter olmali');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Hata', 'Sifreler eslesmiyor');
      return;
    }

    setLoading(true);
    const result = await resetPassword(token, password);
    setLoading(false);

    if (result.success) {
      Alert.alert(
        'Sifre Sifirlama Basarili',
        'Sifren sifirlandi. Artik yeni sifrenle giris yapabilirsin.',
        [
          {
            text: 'Giris Yap',
            onPress: () => navigation.replace('Login')
          }
        ]
      );
    } else {
      Alert.alert('Sifirlama Basarisiz', result.error || 'Gecersiz veya suresi dolmus sifirlama anahtari');
    }
  };

  if (!token) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <MaterialIcons name="error" size={80} color="#F44336" style={styles.icon} />
          <Text style={styles.title}>Gecersiz Sifirlama Baglantisi</Text>
          <Text style={styles.subtitle}>
            Bu sifre sifirlama baglantisi gecersiz veya suresi dolmus.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.replace('Login')}
          >
            <Text style={styles.buttonText}>Giris Ekranina Don</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <MaterialIcons name="lock" size={80} color="#D4AF37" style={styles.icon} />
        
        <Text style={styles.title}>Sifreyi Sifirla</Text>
        
        <Text style={styles.subtitle}>
          Asagidan yeni sifreni gir.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Yeni Sifre</Text>
          <View style={styles.inputContainer}>
            <MaterialIcons name="lock" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="En az 8 karakter"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <MaterialIcons
                name={showPassword ? 'visibility' : 'visibility-off'}
                size={20}
                color="#666"
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Sifreyi Onayla</Text>
          <View style={styles.inputContainer}>
            <MaterialIcons name="lock" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Sifreni tekrar gir"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.eyeIcon}
            >
              <MaterialIcons
                name={showConfirmPassword ? 'visibility' : 'visibility-off'}
                size={20}
                color="#666"
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleReset}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sifreyi Sifirla</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.replace('Login')}
        >
          <Text style={styles.linkText}>Giris Ekranina Don</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F6',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  icon: {
    alignSelf: 'center',
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
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
  },
  eyeIcon: {
    padding: 4,
  },
  button: {
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  linkButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    color: '#D4AF37',
    fontWeight: '600',
  },
});
