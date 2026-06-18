export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
/**
 * PROJECT DREXDEL - CORE HAVERSINE SPATIAL DISTANCE ENGINE
 * FILE: src/utils/locationMath.ts
 */

interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Pure mathematical formula calculating the exact distance in kilometers 
 * between two GPS points, factoring in the planetary curvature of the Earth.
 */
export const calculateHaversineDistance = (point1: Coordinates, point2: Coordinates): number => {
  const EarthRadiusKm = 6371; // Global physical radius constant

  const dLat = degreesToRadians(point2.latitude - point1.latitude);
  const dLng = degreesToRadians(point2.longitude - point1.longitude);

  const lat1Rad = degreesToRadians(point1.latitude);
  const lat2Rad = degreesToRadians(point2.latitude);

  // Haversine core matrix logic
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return EarthRadiusKm * c; // Absolute km value output
};

/**
 * Verifies if a user's current device position physically crosses an event perimeter
 * @param userCoords Device GPS position
 * @param venueCoords Target Event center point
 * @param radiusMeters Strict containment limit boundary (Default: 150 meters)
 */
export const verifyGeofenceContainment = (
  userCoords: Coordinates,
  venueCoords: Coordinates,
  radiusMeters: number = 150
): boolean => {
  const distanceKm = calculateHaversineDistance(userCoords, venueCoords);
  const distanceMeters = distanceKm * 1000;
  
  return distanceMeters <= radiusMeters;
};

const degreesToRadians = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};
