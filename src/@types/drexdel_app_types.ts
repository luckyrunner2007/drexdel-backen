export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
}

export interface EncryptedTicket {
  id: string;
  eventId: string;
  userId: string;
  tierId: string;
  purchaseTimestamp: string;
  cryptographicToken: string;
  qrCodeString: string;
  status: 'booked' | 'used' | 'cancelled';
}

export interface PaymentRequestPayload {
  transactionId: string;
  eventId?: string;
  userId?: string;
  amount?: number;
  currency?: 'RWF' | 'USD' | 'EUR';
  paymentMethod?: 'credit_card' | 'paypal' | 'mtn_momo' | 'airtel_money';
  customerPhone?: string;
  customerEmail?: string;
}

export interface PaymentResponseResult {
  success: boolean;
  transactionId: string;
  gatewayReference: string;
  error?: string;
  escrowStatus: 'held_in_escrow' | 'failed';
}
