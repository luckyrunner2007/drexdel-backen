import { STRIPE_SECRET_KEY, PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_MODE, PAYMENT_PROVIDER } from '../../config/env';
import { CardGateway } from './cardGateway';
import { PayPalGateway } from './paypalGateway';
import { MtnMoMoGateway } from './momoGateway';
import { AirtelGateway } from './airtelGateway';

export const cardGateway = new CardGateway(STRIPE_SECRET_KEY);
export const paypalGateway = new PayPalGateway(PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_MODE);
export const mtnMoMoGateway = new MtnMoMoGateway();
export const airtelGateway = new AirtelGateway();

export const defaultPaymentProvider = PAYMENT_PROVIDER;
