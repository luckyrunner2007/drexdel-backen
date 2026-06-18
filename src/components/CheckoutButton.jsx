import React, { useState } from 'react';
import api from '../services/api';

export const CheckoutButton = ({ amount, phoneNumber }) => {
  const [loading, setLoading] = useState(false);

  const triggerPaymentPaymentFlow = async () => {
    setLoading(true);
    try {
      const transactionReference = `DRE-${Date.now()}`;
      const response = await api.post('/v1/payments/checkout', {
        amount,
        phoneNumber,
        reference: transactionReference
      });
      
      alert('Payment Request Dispatched Successfully! Check your phone for the PIN prompt.');
      console.log('Backend response packet locked:', response.data);
    } catch (error) {
      console.error('Checkout routing failure:', error);
      alert('Network processing failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={triggerPaymentPaymentFlow} 
      disabled={loading}
      className="btn-checkout"
    >
      {loading ? 'Processing Interconnect...' : `Pay ${amount} RWF Now`}
    </button>
  );
};
