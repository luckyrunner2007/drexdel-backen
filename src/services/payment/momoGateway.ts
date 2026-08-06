import { PaymentRequestPayload, PaymentResponseResult } from '../../@types/drexdel_app_types';

export class MtnMoMoGateway {
  public async requestPayment(payload: PaymentRequestPayload): Promise<PaymentResponseResult> {
    if (!payload.customerPhone) {
      return {
        success: false,
        transactionId: payload.transactionId,
        gatewayReference: 'FAILED_MTN_MISSING_PHONE',
        error: 'MTN MoMo requires a valid customer phone number.',
        escrowStatus: 'failed'
      };
    }

    const providerReference = `MTN-MOMO-TX-${Math.floor(100000 + Math.random() * 900000)}`;

    console.log('[MtnMoMoGateway] Simulating RequestToPay for', payload.customerPhone);

    return {
      success: true,
      transactionId: payload.transactionId,
      gatewayReference: providerReference,
      escrowStatus: 'held_in_escrow'
    };
  }
}

export const mtnMoMoGateway = new MtnMoMoGateway();
