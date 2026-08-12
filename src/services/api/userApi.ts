/**
 * PROJECT DREXDEL - EVENT-BACKED SOCIAL GRAPH API SERVICE
 * FILE: src/services/api/userApi.ts
 *
 * Client for profiles (@username), Instagram-style follows, and the
 * event-backed relationship graph (mutual events + mutual friends).
 */

import { drexdelApiClient, ApiResponse } from './client';

export interface PublicProfile {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  role: string;
  isVerified: boolean;
  followerCount: number;
  followingCount: number;
  relationship: {
    isSelf: boolean;
    status: string | null;
    isFollowing: boolean;
    isBlocked?: boolean;
  };
  mutualEvents: number;
}

export interface RelationshipSummary {
  status: string | null;
  isFollowing: boolean;
  isFollowedBy: boolean;
  isBlocked?: boolean;
  mutualEvents: number;
  mutualFriends: number;
  sharedEventNames: string[];
}

export interface AccountUpdate {
  username?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface UserSearchResult {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  relationship?: {
    isFollowing: boolean;
    isBlocked: boolean;
  };
}

class UserApi {
  /** Fetch a public profile by @username or user id. */
  public async fetchProfile(identifier: string): Promise<ApiResponse<{ profile: PublicProfile }>> {
    return await drexdelApiClient.get<{ profile: PublicProfile }>(`/users/${identifier}`);
  }

  /** Update the current user's @username / bio / avatar. */
  public async updateProfile(payload: AccountUpdate): Promise<ApiResponse<{ profile: PublicProfile }>> {
    return await drexdelApiClient.patch<{ profile: PublicProfile }>(`/users/me`, payload);
  }

  /** Event-backed relationship summary between me and another user. */
  public async fetchRelationship(userId: string): Promise<ApiResponse<{ relationship: RelationshipSummary }>> {
    return await drexdelApiClient.get<{ relationship: RelationshipSummary }>(`/users/me/relationship/${userId}`);
  }

  /** Friend suggestions ranked by shared events + mutual friends. */
  public async fetchSuggestions(limit = 20): Promise<ApiResponse<Array<{ id: string; name: string; username: string | null; avatarUrl: string | null; sharedEvents: number }>>> {
    return await drexdelApiClient.get<Array<{ id: string; name: string; username: string | null; avatarUrl: string | null; sharedEvents: number }>>(`/users/me/suggestions?limit=${limit}`);
  }

  /** Follow (or request to follow) another user. */
  public async followUser(userId: string): Promise<ApiResponse<{ status: string }>> {
    return await drexdelApiClient.post<{ status: string }>(`/users/${userId}/follow`, {});
  }

  /** Unfollow another user. */
  public async unfollowUser(userId: string): Promise<ApiResponse<{ success: boolean }>> {
    return await drexdelApiClient.delete<{ success: boolean }>(`/users/${userId}/follow`);
  }

  /** Search users by name or @username. */
  public async searchUsers(query: string, limit = 20): Promise<ApiResponse<{ users: UserSearchResult[] }>> {
    return await drexdelApiClient.get<{ users: UserSearchResult[] }>(`/users/search?query=${encodeURIComponent(query)}&limit=${limit}`);
  }

  /** Block a user. */
  public async blockUser(userId: string): Promise<ApiResponse<{ status: string }>> {
    return await drexdelApiClient.post<{ status: string }>(`/users/${userId}/block`, {});
  }

  /** Unblock a user. */
  public async unblockUser(userId: string): Promise<ApiResponse<{ success: boolean }>> {
    return await drexdelApiClient.delete<{ success: boolean }>(`/users/${userId}/block`);
  }

  /** Report a user. */
  public async reportUser(userId: string, reason: string, details?: string): Promise<ApiResponse<{ id: string; reported: boolean }>> {
    return await drexdelApiClient.post<{ id: string; reported: boolean }>(`/users/${userId}/report`, { reason, details });
  }

  /** Get followers list for a user. */
  public async getFollowers(userId: string, cursor?: string, limit = 50): Promise<ApiResponse<{ users: UserSearchResult[]; nextCursor?: string }>> {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (cursor) qs.set('cursor', cursor);
    return await drexdelApiClient.get<{ users: UserSearchResult[]; nextCursor?: string }>(`/users/${userId}/followers?${qs.toString()}`);
  }

  /** Get following list for a user. */
  public async getFollowing(userId: string, cursor?: string, limit = 50): Promise<ApiResponse<{ users: UserSearchResult[]; nextCursor?: string }>> {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (cursor) qs.set('cursor', cursor);
    return await drexdelApiClient.get<{ users: UserSearchResult[]; nextCursor?: string }>(`/users/${userId}/following?${qs.toString()}`);
  }
}

export const userApi = new UserApi();
