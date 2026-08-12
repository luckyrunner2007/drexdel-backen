/**
 * PROJECT DREXDEL - LIVE EVENT PRESENCE API SERVICE
 * FILE: src/services/api/presenceApi.ts
 *
 * "Who's here now": report your presence at an event (ticket + geofence
 * verified server-side), list events where your friends are currently
 * present, read friend-arrival notifications, and control your presence
 * privacy (PUBLIC / FRIENDS_ONLY / HIDDEN).
 */

import { drexdelApiClient, ApiResponse } from './client';

export type PresenceVisibility = 'PUBLIC' | 'FRIENDS_ONLY' | 'HIDDEN';

export interface LiveEventMember {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  /** Live coordinates shared for the radar map (null until a friend shares GPS). */
  lat?: number | null;
  lng?: number | null;
}

export interface LiveEvent {
  id: string;
  title: string;
  location: string;
  date: string;
  latitude: number | null;
  longitude: number | null;
  members: LiveEventMember[];
}

export interface FriendArrival {
  friendId: string;
  eventId: string;
  eventTitle: string | null;
  at: number;
  friend: {
    id: string;
    name: string;
    username: string | null;
    avatarUrl: string | null;
    isVerified: boolean;
  } | null;
}

class PresenceApi {
  /** Report "I am at this event right now" (validated server-side). */
  public async heartbeat(eventId: string, lat: number, lng: number): Promise<ApiResponse<{ inside: boolean; shared: boolean; visibility: PresenceVisibility }>> {
    return await drexdelApiClient.post<{ inside: boolean; shared: boolean; visibility: PresenceVisibility }>('/presence/heartbeat', { eventId, lat, lng });
  }

  /** Events where my friends are currently present (with live coords for the radar). */
  public async fetchLiveEvents(): Promise<ApiResponse<{ events: LiveEvent[] }>> {
    return await drexdelApiClient.get<{ events: LiveEvent[] }>('/presence/events');
  }

  /** Friend-arrival feed: "X just arrived at Y". */
  public async fetchFriendArrivals(): Promise<ApiResponse<{ arrivals: FriendArrival[] }>> {
    return await drexdelApiClient.get<{ arrivals: FriendArrival[] }>('/presence/notifications');
  }

  /** Clear the friend-arrival feed after the user has seen it. */
  public async clearArrivals(): Promise<ApiResponse<{ success: boolean }>> {
    return await drexdelApiClient.delete<{ success: boolean }>('/presence/notifications');
  }

  /** Read the caller's current presence privacy setting. */
  public async getVisibility(): Promise<ApiResponse<{ visibility: PresenceVisibility }>> {
    return await drexdelApiClient.get<{ visibility: PresenceVisibility }>('/presence/visibility');
  }

  /** Update the caller's presence privacy setting. */
  public async updateVisibility(visibility: PresenceVisibility): Promise<ApiResponse<{ visibility: PresenceVisibility }>> {
    return await drexdelApiClient.patch<{ visibility: PresenceVisibility }>('/presence/visibility', { visibility });
  }
}

export const presenceApi = new PresenceApi();
