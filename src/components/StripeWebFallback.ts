/**
 * PROJECT DREXDEL - WEB FALLBACK FOR @stripe/stripe-react-native
 *
 * The Stripe React-Native SDK is native-only and internally deep-imports
 * `react-native/Libraries/...` paths (e.g. Components/TextInput/TextInputState).
 * On web, Expo aliases the top-level `react-native` package to
 * `react-native-web`, but these deep subpaths are NOT aliased, so bundling the
 * real Stripe SDK for web blows up Metro (Platform.web.js doesn't exist) →
 * blank screen.
 *
 * metro.config.js redirects `@stripe/stripe-react-native` to this module on the
 * `web` platform only. Native builds still use the real SDK.
 */
import React from 'react';

export interface StripeErrorLike {
  code?: string;
  message?: string;
}

const notAvailable = (name: string) => ({ error: { code: 'WEB_UNSUPPORTED', message: `${name} is not available on web` } } as const);

export const useStripe = () => ({
  initPaymentSheet: async () => notAvailable('initPaymentSheet'),
  presentPaymentSheet: async () => notAvailable('presentPaymentSheet'),
  createPaymentMethod: async () => notAvailable('createPaymentMethod'),
  confirmPayment: async () => notAvailable('confirmPayment'),
  retrievePaymentIntent: async () => ({ error: null, paymentIntent: null }),
  retrieveSetupIntent: async () => notAvailable('retrieveSetupIntent'),
  handleNextAction: async () => ({ error: null }),
});

export const StripeProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) =>
  React.createElement(React.Fragment, null, children);

export default StripeProvider;
