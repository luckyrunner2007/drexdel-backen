export const locationService = {
  requestDevicePermissions: async () => true,
  getCurrentLocation: async () => ({
    latitude: -1.9441,
    longitude: 30.0619,
    timestamp: new Date().toISOString(),
  }),
  calculateDistanceInKm: () => 0,
  isUserInsideGeofence: () => true,
};