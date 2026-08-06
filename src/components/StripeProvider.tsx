import React, { createContext, useContext } from 'react';
import Constants from 'expo-constants';

interface StripeContextType {
  publishableKey: string | null;
}

const StripeContext = createContext<StripeContextType>({ publishableKey: null });

export const useStripeContext = () => useContext(StripeContext);

export const StripeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // The publishable key comes from app.json "extra" config or EXPO_PUBLIC_ env vars.
  // @stripe/stripe-react-native is configured in app.json plugins.
  const publishableKey =
    Constants.expoConfig?.extra?.stripePublishableKey || null;

  return (
    <StripeContext.Provider value={{ publishableKey }}>
      {children}
    </StripeContext.Provider>
  );
};

export default StripeProvider;