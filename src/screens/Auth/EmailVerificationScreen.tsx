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
import { useRouter } from 'expo-router';
import { drexdelApiClient } from '../../services/api/client';

export const EmailVerificationScreen: React.FC = () => {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSendCode = async () => {
    setErrorMessage(null);
    setIsSending(true);
    try {
      const res = await drexdelApiClient.sendEmailVerification();
      if (!res.success) {
        setErrorMessage(res.message || 'Failed to send verification code.');
        return;
      }
      Alert.alert('Code Sent', 'Check your email for the 6-digit verification code.');
    } catch {
      setErrorMessage('Network error. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async () => {
    setErrorMessage(null);
    if (code.length < 6) {
      setErrorMessage('Please enter the 6-digit code.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await drexdelApiClient.verifyEmail(code);
      if (!res.success) {
        setErrorMessage(res.message || 'Invalid code.');
        return;
      }
      Alert.alert('Verified', 'Your email has been verified successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      setErrorMessage('Network error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify Your Email</Text>
      <Text style={styles.subtitle}>
        A verification code will be sent to the email on your account.
      </Text>
      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
      <TouchableOpacity style={[styles.button, styles.sendButton]} onPress={handleSendCode} disabled={isSending}>
        {isSending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Send Verification Code</Text>
        )}
      </TouchableOpacity>
      <TextInput
        style={styles.input}
        placeholder="6-digit code"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
      />
      {isSubmitting ? (
        <ActivityIndicator color="#7B2CBF" />
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleVerify}>
          <Text style={styles.buttonText}>Verify Email</Text>
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
  sendButton: { backgroundColor: '#5A189A' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  error: { color: '#EF4444', marginBottom: 8, textAlign: 'center' },
  link: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#7B2CBF', fontSize: 14 },
});