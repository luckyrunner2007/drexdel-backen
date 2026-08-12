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
  ScrollView,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { drexdelApiClient } from '../../services/api/client';

const { height } = Dimensions.get('window');

export const SignupScreen: React.FC = () => {
  const router = useRouter();
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignup = async () => {
    setErrorMessage(null);

    // Validation
    if (!fullName.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

        if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    // Password strength validation matching backend requirements
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }
    if (!/[a-z]/.test(password)) {
      setErrorMessage('Password must contain at least one lowercase letter.');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setErrorMessage('Password must contain at least one uppercase letter.');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setErrorMessage('Password must contain at least one digit.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await drexdelApiClient.signup({ name: fullName.trim(), email: email.trim(), phoneNumber: phone.trim() || undefined, password });
      if (!response.success || !response.data) {
        setErrorMessage(response.data === null ? response.message : 'Unable to create account.');
        return;
      }
      await SecureStore.setItemAsync('drexdel_token', response.data.token);
      drexdelApiClient.setAuthToken(response.data.token);
      router.replace('/(auth)/onboarding');
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
        
        {/* Brand Section */}
        <View style={styles.brandContainer}>
          <Text style={styles.brandLogo}>DREXDEL</Text>
          <Text style={styles.brandTagline}>Join the city's heartbeat.</Text>
        </View>

        {/* Form Container */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Create Account</Text>

          {errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            </View>
          )}

          <Text style={styles.inputLabel}>Full Name</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter your full name"
            placeholderTextColor="#ADB5BD"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            editable={!isSubmitting}
          />

          <Text style={styles.inputLabel}>Email Address</Text>
          <TextInput
            style={styles.textInput}
            placeholder="name@example.com"
            placeholderTextColor="#ADB5BD"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!isSubmitting}
          />

          <Text style={styles.inputLabel}>Phone Number</Text>
          <TextInput
            style={styles.textInput}
            placeholder="+2507XXXXXXXX"
            placeholderTextColor="#ADB5BD"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            editable={!isSubmitting}
          />

                     <Text style={styles.inputLabel}>Password</Text>
           <TextInput
             style={styles.textInput}
             placeholder="Create a secure password"
             placeholderTextColor="#ADB5BD"
             secureTextEntry={true}
             value={password}
             onChangeText={setPassword}
             editable={!isSubmitting}
           />

           {/* Password Strength Indicator */}
           {password.length > 0 && (
             <View style={styles.strengthIndicator}>
               <Text style={styles.strengthLabel}>Password Strength:</Text>
               <View style={styles.strengthRow}>
                 <View style={[styles.strengthBar, password.length >= 8 && styles.strengthBarMet]} />
                 <Text style={styles.strengthText}>8+ chars</Text>
               </View>
               <View style={styles.strengthRow}>
                 <View style={[styles.strengthBar, /[a-z]/.test(password) && styles.strengthBarMet]} />
                 <Text style={styles.strengthText}>Lowercase letter</Text>
               </View>
               <View style={styles.strengthRow}>
                 <View style={[styles.strengthBar, /[A-Z]/.test(password) && styles.strengthBarMet]} />
                 <Text style={styles.strengthText}>Uppercase letter</Text>
               </View>
               <View style={styles.strengthRow}>
                 <View style={[styles.strengthBar, /[0-9]/.test(password) && styles.strengthBarMet]} />
                 <Text style={styles.strengthText}>Digit</Text>
               </View>
             </View>
           )}

          <Text style={styles.inputLabel}>Confirm Password</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Re-enter your password"
            placeholderTextColor="#ADB5BD"
            secureTextEntry={true}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            editable={!isSubmitting}
          />

          {/* Signup Button */}
          <TouchableOpacity 
            style={[styles.signupButton, isSubmitting && styles.signupButtonActive]} 
            onPress={handleSignup}
            disabled={isSubmitting}
            activeOpacity={0.9}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.signupButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.loginFooter}>
            <Text style={styles.footerBaseText}>Already have an account? </Text>
            <TouchableOpacity 
              disabled={isSubmitting}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={styles.loginActionLink}>Sign In</Text>
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
    marginBottom: 16,
  },
  signupButton: {
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
  signupButtonActive: {
    backgroundColor: '#9D4EDD',
  },
  signupButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  loginFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerBaseText: {
    fontSize: 13,
    color: '#6C757D',
  },
    loginActionLink: {
    fontSize: 13,
    color: '#7B2CBF',
    fontWeight: '700',
  },
  strengthIndicator: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 6,
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  strengthBar: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E9ECEF',
    marginRight: 8,
  },
  strengthBarMet: {
    backgroundColor: '#10B981',
  },
  strengthText: {
    fontSize: 12,
    color: '#6C757D',
  },
});
