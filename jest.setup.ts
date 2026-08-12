import '@testing-library/jest-native/extend-expect';

// Provide a fake expo-constants manifest so modules reading it don't blow up
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {},
    name: 'drexdelnative',
    slug: 'drexdelnative',
    version: '1.0.0',
  },
}));

// expo-secure-store is native; no-op in tests
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

// Mock fetch globally; tests stub it on globalThis.fetch as needed
global.fetch = jest.fn(() =>
  Promise.resolve({
    text: () => Promise.resolve(''),
    json: () => Promise.resolve(null),
    status: 200,
    ok: true,
    headers: new Map(),
  } as any)
) as any;

// Minimal matchMedia shim for any code relying on it
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
