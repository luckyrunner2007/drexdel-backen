import { PaymentRequestPayload, PaymentResponseResult } from '../../@types/drexdel_app_types';

export class CardGateway {
  private stripeClient: any;

  constructor(secretKey: string) {
    if (secretKey) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Stripe = require('stripe');
        this.stripeClient = new Stripe(secretKey, { apiVersion: '2024-11-01' });
      } catch {
        this.stripeClient = null;
      }
    }
  }

  public get isConfigured(): boolean {
    return Boolean(this.stripeClient);
  }

  public async createPaymentIntent(payload: PaymentRequestPayload): Promise<{ id: string; clientSecret: string }> {
    if (!payload.customerEmail) {
      throw new Error('Credit card payments require a customer email for receipts.');
    }

    if (!this.stripeClient) {
      throw new Error('Stripe credentials are not available in the backend environment.');
    }

    try {
      const paymentIntent = await this.stripeClient.paymentIntents.create({
        amount: Math.round((payload.amount || 0) * 100),
        currency: payload.currency?.toLowerCase() || 'usd',
        receipt_email: payload.customerEmail,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        metadata: {
          transactionId: payload.transactionId,
          eventId: payload.eventId,
          userId: payload.userId || 'guest',
        },
      });

      if (!paymentIntent.client_secret) throw new Error('Stripe did not provide a client secret.');
      return { id: paymentIntent.id, clientSecret: paymentIntent.client_secret };
    } catch (error: any) {
      throw new Error(error?.message || 'Stripe payment intent creation failed.');
    }
  }

  public constructWebhookEvent(rawBody: Buffer, signature: string | undefined, webhookSecret: string): any {
    if (!this.stripeClient || !webhookSecret) throw new Error('Stripe webhook is not configured.');
    if (!signature) throw new Error('Missing Stripe signature.');
    return this.stripeClient.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }
}
