import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView 
} from 'react-native';
import { useRouter } from 'expo-router';
import { useUser } from '../../state/UserContext';

const { height } = Dimensions.get('window');

export const LoginScreen: React.FC = () => {
  const router = useRouter();
  const { loginUser } = useUser();
  
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMessage(null);

    if (!identity.trim() || !password.trim()) {
      setErrorMessage('Please enter both your credentials and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const success = await loginUser(identity.trim(), password);
      if (!success) {
        setErrorMessage('Invalid credentials. Please try again.');
        return;
      }
      router.replace('/(tabs)');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.masterContainer} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        <View style={styles.brandContainer}>
          <Text style={styles.brandLogo}>DREXDEL</Text>
          <Text style={styles.brandTagline}>Your direct path to the city's heartbeat.</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Welcome Back</Text>

          {errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            </View>
          )}

          <Text style={styles.inputLabel}>Email Address or Mobile Number</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter email or phone"
            placeholderTextColor="#ADB5BD"
            value={identity}
            onChangeText={setIdentity}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSubmitting}
          />

          <View style={styles.passwordHeaderRow}>
            <Text style={styles.inputLabel}>Password</Text>
            <TouchableOpacity 
              disabled={isSubmitting}
                          onPress={() => router.push('/(auth)/password-reset')}
            >
              <Text style={styles.forgotPasswordLink}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>
          
          <TextInput
            style={styles.textInput}
            placeholder="Enter secure password"
            placeholderTextColor="#ADB5BD"
            secureTextEntry={true}
            autoCapitalize="none"
            autoCorrect={false}
            value={password}
            onChangeText={setPassword}
            editable={!isSubmitting}
          />

          <TouchableOpacity 
            style={[styles.loginButton, isSubmitting && styles.loginButtonActive]} 
            onPress={handleLogin}
            disabled={isSubmitting}
            activeOpacity={0.9}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.registrationFooter}>
            <Text style={styles.footerBaseText}>New to Drexdel? </Text>
            <TouchableOpacity 
              disabled={isSubmitting}
              onPress={() => router.push('/(auth)/signup')}
            >
              <Text style={styles.signupActionLink}>Create Account</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  masterContainer: {
    flex: 1,
    backgroundColor: '#FAFAFE',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: height * 0.05,
  },
  brandLogo: {
    fontSize: 42,
    fontWeight: '900',
    color: '#7B2CBF',
    letterSpacing: 4,
    textShadowColor: 'rgba(123, 44, 191, 0.15)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  brandTagline: {
    fontSize: 13,
    color: '#6C757D',
    fontWeight: '500',
    marginTop: 6,
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#212529',
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: '#FFE3E3',
    borderWidth: 1,
    borderColor: '#FFA8A8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#E03131',
    fontSize: 13,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#495057',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 10,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#212529',
    marginBottom: 20,
  },
  passwordHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  forgotPasswordLink: {
    fontSize: 12,
    color: '#7B2CBF',
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#7B2CBF',
    borderRadius: 10,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#7B2CBF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  loginButtonActive: {
    backgroundColor: '#9D4EDD',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  registrationFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerBaseText: {
    fontSize: 13,
    color: '#6C757D',
  },
  signupActionLink: {
    fontSize: 13,
    color: '#7B2CBF',
    fontWeight: '700',
  },
});
