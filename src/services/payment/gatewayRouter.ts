import { airtelGateway } from './airtelGateway';
import { mtnMoMoGateway } from './momoGateway';

/**
 * PROJECT DREXDEL - SECURE MULTI-RAIL PAYMENT ROUTER SERVICE
 * FILE: src/services/payment/gatewayRouter.ts
 */

export type PaymentMethodType = 'credit_card' | 'paypal' | 'mtn_momo' | 'airtel_money';

export interface PaymentRequestPayload {
  transactionId: string;
  eventId: string;
  userId: string;
  amount: number;
  currency: 'RWF' | 'USD' | 'EUR';
  paymentMethod: PaymentMethodType;
  customerPhone?: string; // Compulsory for MTN MoMo and Airtel Money USSD push notifications
  customerEmail?: string; // Required for card + PayPal receipts
}

export interface PaymentResponseResult {
  success: boolean;
  transactionId: string;
  gatewayReference: string;
  error?: string;
  escrowStatus: 'held_in_escrow' | 'failed';
}

class GatewayRouter {
  /**
   * Primary route execution point. Detects payment rail and executes corresponding gateway.
   */
  public async processTransaction(
    method: PaymentMethodType,
    payload: PaymentRequestPayload
  ): Promise<PaymentResponseResult> {
    console.log(`[Drexdel Pay] Routing transaction ${payload.transactionId} via [${method.toUpperCase()}]`);

    switch (method) {
      case 'mtn_momo':
        return await mtnMoMoGateway.requestPayment(payload);
      case 'airtel_money':
        return await airtelGateway.collectPayment(payload);
      case 'credit_card':
        return await this.executeCardTransaction(payload);
      case 'paypal':
        return await this.executePayPalTransaction(payload);
      default:
        return this.createFailureResponse(payload.transactionId, `Unsupported payment method: ${method}`);
    }
  }

  private async executeCardTransaction(payload: PaymentRequestPayload): Promise<PaymentResponseResult> {
    try {
      const mockStripeReference = `ch_stripe_${Math.random().toString(36).substring(2, 11)}`;
      return {
        success: true,
        transactionId: payload.transactionId,
        gatewayReference: mockStripeReference,
        escrowStatus: 'held_in_escrow'
      };
    } catch (error) {
      console.error('[Payment Router] Critical transaction failure processing card gateway rails:', error);
      return this.createFailureResponse(payload.transactionId, 'Card authorization declined by issuing bank.');
    }
  }

  private async executePayPalTransaction(payload: PaymentRequestPayload): Promise<PaymentResponseResult> {
    try {
      const mockPayPalReference = `PAYPAL-ID-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      return {
        success: true,
        transactionId: payload.transactionId,
        gatewayReference: mockPayPalReference,
        escrowStatus: 'held_in_escrow'
      };
    } catch (error) {
      console.error('[Payment Router] Critical transaction failure processing PayPal gateway rails:', error);
      return this.createFailureResponse(payload.transactionId, 'PayPal secure token handshake failed.');
    }
  }

  private createFailureResponse(txId: string, errorMsg: string): PaymentResponseResult {
    return {
      success: false,
      transactionId: txId,
      gatewayReference: 'FAILED_REF',
      error: errorMsg,
      escrowStatus: 'failed'
    };
  }
}

export const paymentGatewayRouter = new GatewayRouter();
