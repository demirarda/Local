import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

export default function OnboardingNameScreen({ navigation }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const canContinue = useMemo(
    () => firstName.trim().length > 0 && lastName.trim().length > 0,
    [firstName, lastName]
  );

  const handleContinue = () => {
    if (!canContinue) return;
    navigation.navigate('OnboardingUniversityEmail', {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>L.</Text>
      <Text style={styles.title}>OB-03 · Isim Girisi</Text>
      <Text style={styles.subtitle}>Ad ve soyad zorunlu.</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Ad"
          placeholderTextColor="#9ca3af"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          placeholder="Soyad"
          placeholderTextColor="#9ca3af"
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
        />
      </View>

      <TouchableOpacity
        style={[styles.button, !canContinue && styles.buttonDisabled]}
        disabled={!canContinue}
        onPress={handleContinue}
      >
        <Text style={styles.buttonText}>Devam Et</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf9f6',
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  logo: {
    textAlign: 'center',
    fontSize: 64,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 10,
  },
  title: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
    color: '#4b5563',
    fontSize: 14,
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#111827',
    fontSize: 16,
  },
  button: {
    marginTop: 18,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
