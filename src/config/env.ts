import Constants from 'expo-constants';

/**
 * PROJECT DREXDEL - ARCHITECTURE ENVIRONMENT ROUTING PROFILE
 * FILE: src/config/env.ts
 */

// Safely extracts the configured store endpoint profile from app.json with verified route fallbacks
const rawApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || Constants.expoConfig?.extra?.apiBaseUrl || 'https://drexdel.com';
export const API_BASE_URL = rawApiBaseUrl.replace(/\/v1\/?$/, '') + '/v1';
