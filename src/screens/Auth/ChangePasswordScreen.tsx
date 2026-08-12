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

export const ChangePasswordScreen: React.FC = () => {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return 'Password must be at least 8 characters.';
    if (!/[a-z]/.test(pwd)) return 'Password must contain a lowercase letter.';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain an uppercase letter.';
    if (!/[0-9]/.test(pwd)) return 'Password must contain a digit.';
    return null;
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }
    const pwdError = validatePassword(newPassword);
    if (pwdError) {
      setErrorMessage(pwdError);
      return;
    }
    if (currentPassword === newPassword) {
      setErrorMessage('New password must be different from current password.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await drexdelApiClient.changePassword(currentPassword, newPassword);
      if (!res.success) {
        setErrorMessage(res.message || 'Failed to change password.');
        return;
      }
      await drexdelApiClient.logout();
      Alert.alert('Password Changed', 'Your password has been changed. Please log in again.', [
        { text: 'OK', onPress: () => router.replace('/auth/login') },
      ]);
    } catch {
      setErrorMessage('Network error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Change Password</Text>
      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
      <TextInput
        style={styles.input}
        placeholder="Current password"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        secureTextEntry
      />
      <TextInput
        style={styles.input}
        placeholder="New password"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm new password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      {isSubmitting ? (
        <ActivityIndicator color="#7B2CBF" />
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleChangePassword}>
          <Text style={styles.buttonText}>Change Password</Text>
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
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 },
  button: { backgroundColor: '#7B2CBF', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 12 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  error: { color: '#EF4444', marginBottom: 8, textAlign: 'center' },
  link: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#7B2CBF', fontSize: 14 },
});
