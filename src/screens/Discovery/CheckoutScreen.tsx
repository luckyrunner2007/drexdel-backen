import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { GlobalNavigationProp } from '../../@types/navigation';
import { InputField } from '../../components/Common/InputField';
import { drexdelApiClient } from '../../services/api/client';

const PAYMENT_METHODS = [
  { id: 'credit_card', label: 'Credit Card' },
  { id: 'paypal', label: 'PayPal' },
  { id: 'mtn_momo', label: 'MTN MoMo' },
  { id: 'airtel_money', label: 'Airtel Money' },
] as const;

export const CheckoutScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<GlobalNavigationProp>();
  const {
    eventTitle,
    selectedTierName,
    selectedTierPrice,
    currency,
    ticketQuantity,
    eventId,
  } = route.params || {};

  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'paypal' | 'mtn_momo' | 'airtel_money'>('credit_card');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalAmount = selectedTierPrice ? selectedTierPrice * (ticketQuantity || 1) : 0;

  const handleCompletePurchase = async () => {
    if (!paymentMethod) {
      Alert.alert('Payment Required', 'Please select a payment method before continuing.');
      return;
    }

    if ((paymentMethod === 'credit_card' || paymentMethod === 'paypal') && !customerEmail) {
      Alert.alert('Email Required', 'Please enter your email address to complete the payment.');
      return;
    }

    if ((paymentMethod === 'mtn_momo' || paymentMethod === 'airtel_money') && !customerPhone) {
      Alert.alert('Phone Required', 'Please enter your phone number to complete mobile money payment.');
      return;
    }

    setIsSubmitting(true);

    try {
      const transactionId = `tx_${Date.now()}`;
      const payload = {
        transactionId,
        eventId,
        userId: 'user_guest_01',
        amount: totalAmount,
        currency,
        paymentMethod,
        customerPhone: customerPhone.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
      };

      const response = await drexdelApiClient.post('/payments/checkout', payload);

      if (!response.success) {
        Alert.alert('Payment Failed', response.message || 'Unable to process payment.');
        return;
      }

      navigation.navigate('TicketReceipt', {
        ticketId: `TICKET-${Date.now()}`,
        encryptedToken: `TOK-${Math.random().toString(36).substring(2, 12).toUpperCase()}`,
        eventTitle,
        tierName: selectedTierName,
        amount: totalAmount,
        currency,
      });
    } catch (error: any) {
      Alert.alert('Payment Error', error.message || 'Unable to complete purchase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Secure Checkout</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Event</Text>
        <Text style={styles.value}>{eventTitle || 'Unknown event'}</Text>
        <Text style={styles.label}>Ticket</Text>
        <Text style={styles.value}>{selectedTierName || 'General Admission'}</Text>
        <Text style={styles.label}>Quantity</Text>
        <Text style={styles.value}>{ticketQuantity || 1}</Text>
        <Text style={styles.label}>Total</Text>
        <Text style={styles.total}>
          {currency} {totalAmount}
        </Text>
      </View>

      <View style={styles.paymentSection}>
        <Text style={styles.sectionTitle}>Payment Method</Text>
        {PAYMENT_METHODS.map(method => {
          const active = paymentMethod === method.id;
          return (
            <TouchableOpacity
              key={method.id}
              style={[styles.paymentOption, active && styles.paymentOptionActive]}
              onPress={() => setPaymentMethod(method.id)}
              activeOpacity={0.85}
            >
              <Text style={[styles.paymentOptionLabel, active && styles.paymentOptionLabelActive]}>{method.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {(paymentMethod === 'credit_card' || paymentMethod === 'paypal') && (
        <InputField
          label="Email Address"
          placeholder="name@example.com"
          value={customerEmail}
          onChangeText={setCustomerEmail}
          keyboardType="email-address"
          error={!customerEmail ? 'Required for this payment method' : null}
        />
      )}

      {(paymentMethod === 'mtn_momo' || paymentMethod === 'airtel_money') && (
        <InputField
          label="Phone Number"
          placeholder="+2507XXXXXXXX"
          value={customerPhone}
          onChangeText={setCustomerPhone}
          keyboardType="phone-pad"
          error={!customerPhone ? 'Required for mobile money payments' : null}
        />
      )}

      <TouchableOpacity
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleCompletePurchase}
        activeOpacity={0.85}
        disabled={isSubmitting}
      >
        <Text style={styles.buttonText}>{isSubmitting ? 'Processing...' : 'Complete Purchase'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFE',
    padding: 24,
  },
  heading: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 24,
    color: '#121214',
  },
  card: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 3,
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    color: '#6C757D',
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    color: '#121214',
    marginTop: 4,
  },
  total: {
    fontSize: 22,
    fontWeight: '900',
    color: '#7B2CBF',
    marginTop: 8,
  },
  paymentSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#495057',
    marginBottom: 12,
  },
  paymentOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  paymentOptionActive: {
    backgroundColor: '#7B2CBF',
    borderColor: '#7B2CBF',
  },
  paymentOptionLabel: {
    fontSize: 15,
    color: '#495057',
    fontWeight: '700',
  },
  paymentOptionLabelActive: {
    color: '#FFFFFF',
  },
  buttonDisabled: {
    backgroundColor: '#ADB5BD',
  },
  button: {
    marginTop: 'auto',
    backgroundColor: '#7B2CBF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
});
