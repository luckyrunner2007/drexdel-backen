import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { drexdelApiClient } from '../../services/api/client';

export const VerifyOtpScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ identity: string }>();
  const identity = params.identity || '';
  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleVerify = async () => {
    if (otp.length < 4) {
      setErrorMessage('Please enter the verification code.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await drexdelApiClient.verifyOtp(identity, otp);
      if (!res.success) {
        setErrorMessage(res.message || 'Invalid code.');
        return;
      }
      Alert.alert('Success', 'Code verified. Set your new password.', [
        {
          text: 'OK',
          onPress: () =>
            router.push({ pathname: '/auth/reset-password', params: { identity } }),
        },
      ]);
    } catch {
      setErrorMessage('Network error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter Verification Code</Text>
      <Text style={styles.subtitle}>A 6-digit code has been sent to {identity}.</Text>
      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
      <TextInput
        style={styles.input}
        placeholder="Verification code"
        value={otp}
        onChangeText={setOtp}
        keyboardType="number-pad"
        maxLength={6}
      />
      {isSubmitting ? (
        <ActivityIndicator color="#7B2CBF" />
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleVerify}>
          <Text style={styles.buttonText}>Verify Code</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={() => router.back()} style={styles.link}>
        <Text style={styles.linkText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 24, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16, textAlign: 'center' },
  button: { backgroundColor: '#7B2CBF', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 12 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  error: { color: '#EF4444', marginBottom: 8, textAlign: 'center' },
  link: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#7B2CBF', fontSize: 14 },
});
