import { PaymentRequestPayload, PaymentResponseResult } from '../../@types/drexdel_app_types';

export class AirtelGateway {
  public async collectPayment(payload: PaymentRequestPayload): Promise<PaymentResponseResult> {
    if (!payload.customerPhone) {
      return {
        success: false,
        transactionId: payload.transactionId,
        gatewayReference: 'FAILED_AIRTEL_MISSING_PHONE',
        error: 'Airtel Money requires a valid customer phone number.',
        escrowStatus: 'failed'
      };
    }

    const providerReference = `AIRTEL-TX-${Math.floor(100000 + Math.random() * 900000)}`;

    console.log('[AirtelGateway] Simulating collection for', payload.customerPhone);

    return {
      success: true,
      transactionId: payload.transactionId,
      gatewayReference: providerReference,
      escrowStatus: 'held_in_escrow'
    };
  }
}

export const airtelGateway = new AirtelGateway();
