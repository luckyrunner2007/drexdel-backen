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
import { useNavigation } from '@react-navigation/native';
import { GlobalNavigationProp } from '../../@types/navigation';

const { height } = Dimensions.get('window');

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<GlobalNavigationProp>();
  
  // State management for user input credentials
  const [identity] = useState(''); // Handles either email or phone number
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Core authorization processing sequence
  const handleLogin = () => {
    // Clear any previous error messages
    setErrorMessage(null);

    // Basic client-side empty input validation loop
    if (!identity.trim() || !password.trim()) {
      setErrorMessage('Please enter both your credentials and password.');
      return;
    }

    setIsSubmitting(true);

    // Simulating database API network response lag
    setTimeout(() => {
      setIsSubmitting(false);
      const cleanIdentity = identity.trim().toLowerCase();

      // --- STRUCTURAL SECURITY ROUTING FOR DREXDEL ---
      // 1. Check if user is entering a gate staff bouncer authorization token
      if (cleanIdentity.includes('bouncer') || cleanIdentity === 'staff@drexdel.com') {
        navigation.replace('GateStaffStack', { 
          staffCode: 'GATE_2026_KIGALI', 
          organizerId: 'org_kcc_55' 
        });
        return;
      }

      // 2. Otherwise, route standard casual users and promoters directly to core tabs
      // In production, the backend returns the actual UserRole object from events.d.ts
      navigation.replace('MainTabs');
    }, 1500);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.masterContainer} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        {/* Upper Brand Section */}
        <View style={styles.brandContainer}>
          <Text style={styles.brandLogo}>DREXDEL</Text>
          <Text style={styles.brandTagline}>Your direct path to the city's heartbeat.</Text>
        </View>

        {/* Form Container */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Welcome Back</Text>

          {/* Dynamic Input Feedback Window */}
          {errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            </View>
          )}

          {/* Identity input node */}
          <Text style={styles.inputLabel}>Email Address or Mobile Number</Text>
          

          {/* Password input node */}
          <View style={styles.passwordHeaderRow}>
            <Text style={styles.inputLabel}>Password</Text>
            <TouchableOpacity 
              disabled={isSubmitting}
              onPress={() => navigation.navigate('AuthStack' as any, { screen: 'ForgotPassword' } as any)}
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

          {/* Main Action Touch Interface Button */}
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

          {/* Registration Funnel Navigation link */}
          <View style={styles.registrationFooter}>
            <Text style={styles.footerBaseText}>New to Drexdel? </Text>
            <TouchableOpacity 
              disabled={isSubmitting}
              onPress={() => navigation.navigate('Onboarding' as any)}
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
    color: '#7B2CBF', // Drexdel Signature Purple
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
