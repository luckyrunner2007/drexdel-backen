import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useStripe } from '@stripe/stripe-react-native';
import { InputField } from '../../components/Common/InputField';
import { drexdelApiClient } from '../../services/api/client';

const PAYMENT_METHODS = [
  { id: 'CREDIT_CARD', label: 'Credit Card' },
  { id: 'PAYPAL', label: 'PayPal' },
  { id: 'MTN_MOMO', label: 'MTN MoMo' },
  { id: 'AIRTEL_MONEY', label: 'Airtel Money' },
] as const;

export const CheckoutScreen: React.FC = () => {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const {
    eventTitle,
    selectedTierName,
    selectedTierPrice,
    currency,
    ticketQuantity,
    eventId,
    selectedTierId,
  } = params || {};

  const [paymentMethod, setPaymentMethod] = useState<'CREDIT_CARD' | 'PAYPAL' | 'MTN_MOMO' | 'AIRTEL_MONEY'>('CREDIT_CARD');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getNumberParam = (value: string | string[] | undefined, fallback: number) => {
    const parsed = Number(Array.isArray(value) ? value[0] : value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const selectedTierPriceNumber = getNumberParam(selectedTierPrice, 0);
  const ticketQuantityNumber = getNumberParam(ticketQuantity, 1);
  const totalAmount = selectedTierPriceNumber * ticketQuantityNumber;

  // Navigate to the receipt with the transaction details once we're ready.
  const goToReceipt = (transactionId: string, status: string) => {
    router.push({ pathname: '/receipt', params: {
      transactionId,
      eventTitle,
      tierName: selectedTierName,
      amount: totalAmount,
      currency,
      status,
    } });
  };

  // Poll the backend for a terminal payment status. Card payments are confirmed
  // client-side and the ticket is issued via webhook shortly after, so we keep
  // checking until the transaction reaches a terminal state.
  const pollPaymentStatus = async (transactionId: string, attemptsLeft: number = 30): Promise<boolean> => {
    for (let attempt = 0; attempt < attemptsLeft; attempt++) {
      try {
        const res = await drexdelApiClient.get<any>(`/payments/status/${transactionId}`);
        if (res.data && (res.data.status === 'COMPLETED' || res.data.status === 'completed')) {
          return true;
        }
        if (res.data && (res.data.status === 'FAILED' || res.data.status === 'failed')) {
          return false;
        }
      } catch {
        // Backend may still be processing; keep polling.
      }
      await new Promise<void>(resolve => setTimeout(resolve, 2000));
    }
    return false;
  };

  const handleCompletePurchase = async () => {
    if (!paymentMethod) {
      Alert.alert('Payment Required', 'Please select a payment method before continuing.');
      return;
    }

    if ((paymentMethod === 'CREDIT_CARD' || paymentMethod === 'PAYPAL') && !customerEmail) {
      Alert.alert('Email Required', 'Please enter your email address to complete the payment.');
      return;
    }

    if ((paymentMethod === 'MTN_MOMO' || paymentMethod === 'AIRTEL_MONEY') && !customerPhone) {
      Alert.alert('Phone Required', 'Please enter your phone number to complete mobile money payment.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        eventId,
        tierId: selectedTierId,
        quantity: ticketQuantityNumber,
        amount: totalAmount,
        currency,
        paymentMethod,
        customerPhone: customerPhone.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
      };

      const response = await drexdelApiClient.post('/payments/checkout', payload);

      if (!response.success || !response.data) {
        Alert.alert('Payment Failed', response.message || 'Unable to process payment.');
        return;
      }

      const data = response.data as any;
      const transactionId = data.transactionId;

      // Card payments return a PaymentIntent client secret that must be confirmed
      // through the Stripe PaymentSheet before the ticket is issued.
      if (data.paymentIntentClientSecret) {
        if (Platform.OS === 'web') {
          Alert.alert(
            'Card Payment',
            'Complete the card payment using the secure Stripe flow in the popup.',
            [{ text: 'OK' }]
          );
          return;
        }

        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: data.paymentIntentClientSecret,
          merchantDisplayName: 'Drexdel',
          allowsDelayedPaymentMethods: false,
          defaultBillingDetails: {
            email: customerEmail.trim() || undefined,
            phone: customerPhone.trim() || undefined,
          },
        });

        if (initError) {
          Alert.alert('Payment Error', initError.message || 'Unable to start secure payment.');
          return;
        }

        const { error: presentError } = await presentPaymentSheet();
        if (presentError) {
          Alert.alert(
            presentError.code === 'Canceled' ? 'Payment Canceled' : 'Payment Failed',
            presentError.message || 'The card payment could not be completed.'
          );
          return;
        }

        // PaymentSheet succeeded — wait for the webhook to issue the ticket,
        // then navigate to the receipt.
        const paid = await pollPaymentStatus(transactionId);
        goToReceipt(transactionId, paid ? 'COMPLETED' : 'PROCESSING');
        return;
      }

      // Async providers (MoMo/Airtel) are pending until confirmed via webhook.
      // Navigate to the receipt immediately and let the user track its status.
      goToReceipt(transactionId, data.status || 'pending');
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

      {(paymentMethod === 'CREDIT_CARD' || paymentMethod === 'PAYPAL') && (
        <InputField
          label="Email Address"
          placeholder="name@example.com"
          value={customerEmail}
          onChangeText={setCustomerEmail}
          keyboardType="email-address"
          error={!customerEmail ? 'Required for this payment method' : null}
        />
      )}

      {(paymentMethod === 'MTN_MOMO' || paymentMethod === 'AIRTEL_MONEY') && (
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
