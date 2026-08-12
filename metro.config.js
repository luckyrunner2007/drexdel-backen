const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Stripe's react-native SDK deep-imports native react-native internals that do
// not exist on the `web` platform (e.g. Utilities/Platform.web.js), which makes
// Metro fail to graph the web bundle (blank screen). On web only, redirect the
// package to a web-safe stub. Native platforms keep the real SDK.
const webStripeStub = path.resolve(__dirname, 'src', 'components', 'StripeWebFallback.ts');

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === '@stripe/stripe-react-native') {
    return {
      type: 'sourceFile',
      filePath: webStripeStub,
    };
  }
  if (typeof defaultResolveRequest === 'function') {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
