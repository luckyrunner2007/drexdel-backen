module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^expo-router$': '<rootDir>/__mocks__/expo-router.ts',
    '^test-renderer$': '<rootDir>/__mocks__/test-renderer.ts'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo|expo-modules-core|expo-constants|expo-secure-store|expo-router|expo-asset|@react-navigation|react-native-reanimated|react-native-gesture-handler|@react-native-community)/)',
  ],
};
