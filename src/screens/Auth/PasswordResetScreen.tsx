import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { drexdelApiClient } from '../../services/api/client';

export const PasswordResetScreen: React.FC = () => {
  const router = useRouter();
  const [identity, setIdentity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRequest = async () => {
    if (!identity.trim()) {
      setErrorMessage('Please enter your email or phone number.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await drexdelApiClient.requestPasswordReset(identity.trim());
      if (!res.success) {
        setErrorMessage(res.message || 'Failed to request reset.');
        return;
      }
      router.push({ pathname: '/auth/verify-otp', params: { identity: identity.trim() } });
    } catch {
      setErrorMessage('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset Your Password</Text>
      <Text style={styles.subtitle}>
        Enter your email or phone number to receive a verification code.
      </Text>
      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
      <TextInput
        style={styles.input}
        placeholder="Email or phone number"
        value={identity}
        onChangeText={setIdentity}
        autoCapitalize="none"
        keyboardType="default"
      />
      {isSubmitting ? (
        <ActivityIndicator color="#7B2CBF" />
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleRequest}>
          <Text style={styles.buttonText}>Send Verification Code</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={() => router.back()} style={styles.link}>
        <Text style={styles.linkText}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 24, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 },
  button: { backgroundColor: '#7B2CBF', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 12 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  error: { color: '#EF4444', marginBottom: 8, textAlign: 'center' },
  link: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#7B2CBF', fontSize: 14 },
});
