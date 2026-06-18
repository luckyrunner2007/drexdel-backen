/**
 * PROJECT DREXDEL - BACKGROUND GEOLOCATION ENGINE
 * FILE: src/services/native/locationService.ts
 */

export interface GpsCoordinates {
  latitude: number;
  longitude: number;
  timestamp: string;
}

class LocationService {
  // Default coordinates fallback (Kigali Center) if GPS hardware permissions are denied
  private defaultCoords: GpsCoordinates = {
    latitude: -1.9441,
    longitude: 30.0619,
    timestamp: new Date().toISOString(),
  };

  /**
   * Requests native hardware OS permissions from the user's phone (iOS / Android)
   */
  public async requestDevicePermissions(): Promise<boolean> {
    console.log('[GPS Service] Requesting native Background Location tracking privileges...');
    
    // In a production environment, this calls:
    // Platform.OS === 'ios' ? Geolocation.requestAuthorization('always') : PermissionsAndroid.request(...)
    
    const isGranted = true; // Simulating successful user approval
    return isGranted;
  }

  /**
   * Fetches the current exact hardware GPS coordinates of the user's device
   */
  public async getCurrentLocation(): Promise<GpsCoordinates> {
    try {
      const hasPermission = await this.requestDevicePermissions();
      if (!hasPermission) {
        console.warn('[GPS Service] Permissions denied. Reverting to regional baseline coordinates.');
        return this.defaultCoords;
      }

      // Simulating direct hardware callback from native GPS chipsets
      return {
        latitude: -1.9546, // Anchored near Nonko / Kigali Convention Centre grid boundaries
        longitude: 30.0935,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.warn('[Location Service] Hardware GPS access request was denied or timed out:', error);
      return this.defaultCoords;
    }
  }

  /**
   * THE HAVERSINE ALGORITHM
   * Pure mathematical formula calculating the absolute spatial distance 
   * in kilometers between two GPS points, factoring in the curvature of the Earth.
   */
  public calculateDistanceInKm(
    point1: { lat: number; lng: number },
    point2: { lat: number; lng: number }
  ): number {
    const EarthRadiusKm = 6371; // Core physical planetary constant radius
    
    const dLat = this.degreesToRadians(point2.lat - point1.lat);
    const dLng = this.degreesToRadians(point2.lng - point1.lng);

    const lat1Rad = this.degreesToRadians(point1.lat);
    const lat2Rad = this.degreesToRadians(point2.lat);

    // Haversine algebraic mapping logic matrix
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    const totalDistanceKm = EarthRadiusKm * c;
    return totalDistanceKm;
  }

  /**
   * Evaluates if a user has physically entered an event's perimeter to unlock History Vault badges
   * @param userLat Device GPS Latitude
   * @param userLng Device GPS Longitude
   * @param eventLat Target Event Venue Latitude
   * @param eventLng Target Event Venue Longitude
   * @param radiusMeters Validation boundary limit (Defaults to 150 meters from venue center)
   */
  public isUserInsideGeofence(
    userLat: number, 
    userLng: number, 
    eventLat: number, 
    eventLng: number, 
    radiusMeters: number = 150
  ): boolean {
    const distanceKm = this.calculateDistanceInKm(
      { lat: userLat, lng: userLng }, 
      { lat: eventLat, lng: eventLng }
    );
    
    const distanceMeters = distanceKm * 1000;
    console.log(`[Geofence Engine] User is currently ${distanceMeters.toFixed(1)}m from venue center point.`);
    
    return distanceMeters <= radiusMeters;
  }

  private degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

export const locationService = new LocationService();

