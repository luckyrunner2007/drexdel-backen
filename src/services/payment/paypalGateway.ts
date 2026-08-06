import { PaymentRequestPayload, PaymentResponseResult } from '../../@types/drexdel_app_types';

export class PayPalGateway {
  private readonly clientId: string;
  private readonly secret: string;
  private readonly mode: string;
  private paypalClient: any;

  constructor(clientId: string, secret: string, mode: string) {
    this.clientId = clientId;
    this.secret = secret;
    this.mode = mode;

    if (clientId && secret) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const paypal = require('@paypal/checkout-server-sdk');
        const environment = paypal.core[this.mode === 'live' ? 'LiveEnvironment' : 'SandboxEnvironment'];
        this.paypalClient = new paypal.core.PayPalHttpClient(
          new environment(clientId, secret)
        );
      } catch {
        this.paypalClient = null;
      }
    }
  }

  public async processPayment(payload: PaymentRequestPayload): Promise<PaymentResponseResult> {
    if (!payload.customerEmail) {
      return {
        success: false,
        transactionId: payload.transactionId,
        gatewayReference: 'FAILED_PAYPAL_MISSING_EMAIL',
        error: 'PayPal payments require a customer email address.',
        escrowStatus: 'failed'
      };
    }

    if (!this.paypalClient) {
      return {
        success: false,
        transactionId: payload.transactionId,
        gatewayReference: 'FAILED_PAYPAL_GATEWAY_UNINITIALIZED',
        error: 'PayPal credentials are missing or PayPal SDK is unavailable.',
        escrowStatus: 'failed'
      };
    }

    try {
      const request = new (require('@paypal/checkout-server-sdk').orders.OrdersCreateRequest)();
      request.prefer('return=representation');
      request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: payload.currency || 'USD',
            value: (payload.amount || 0).toFixed(2),
          },
          description: `Ticket purchase ${payload.transactionId}`,
        }],
        payer: {
          email_address: payload.customerEmail,
        },
        application_context: {
          brand_name: 'Drexdel',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
        },
      });

      const order = await this.paypalClient.execute(request);
      return {
        success: true,
        transactionId: payload.transactionId,
        gatewayReference: order.result.id,
        escrowStatus: 'held_in_escrow'
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId: payload.transactionId,
        gatewayReference: 'FAILED_PAYPAL_PAYMENT',
        error: error?.message || 'PayPal authorization failed.',
        escrowStatus: 'failed'
      };
    }
  }
}
