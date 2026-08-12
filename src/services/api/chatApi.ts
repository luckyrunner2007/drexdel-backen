export async function connectChat() {
  return null;
}
/**
 * PROJECT DREXDEL - SOCIAL BOND ROOMS DATA API SERVICE
 * FILE: src/services/api/chatApi.ts
 */

import { drexdelApiClient, ApiResponse } from './client';
import { ChatMessage, VotingPoll } from '../../@types/events';

export interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  eventId?: string;
  eventDate?: string;
  location?: string;
  category?: string;
}

class ChatApi {
  /**
   * Lists bond rooms the authenticated user has access to (events with BOOKED tickets).
   */
  public async listRooms(): Promise<ApiResponse<{ rooms: ChatRoom[] }>> {
    return await drexdelApiClient.get<{ rooms: ChatRoom[] }>('/chat/rooms');
  }

  /**
   * Fetches the message timeline history for a specific group bond room.
   */
  public async fetchRoomMessages(
    roomId: string,
    before?: string
  ): Promise<ApiResponse<{ messages: ChatMessage[]; nextCursor: string | null }>> {
    const q = before ? `?before=${encodeURIComponent(before)}` : '';
    return await drexdelApiClient.get<{ messages: ChatMessage[]; nextCursor: string | null }>(
      `/chat/rooms/${roomId}/messages${q}`
    );
  }

  /**
   * Dispatches a fresh message node to the group chat server channel.
   * Can transmit plain text, shared event card IDs, interactive voting polls, or media attachments.
   */
  public async submitMessage(
    roomId: string,
    messagePayload: {
      content: string;
      sharedEventId?: string;
      messageType?: 'TEXT' | 'IMAGE' | 'EVENT_CARD' | 'POLL' | 'SYSTEM';
      pollData?: any;
      callData?: any;
      attachments?: Array<{
        type: 'image' | 'video';
        url: string;
        thumbnailUrl?: string;
        width?: number;
        height?: number;
        durationSeconds?: number;
      }>;
    }
  ): Promise<ApiResponse<{ message: ChatMessage }>> {
    return await drexdelApiClient.post<{ message: ChatMessage }>(`/chat/rooms/${roomId}/send`, messagePayload);
  }

  /**
   * Toggles a reaction on a message. `action` is 'add' or 'remove'.
   */
  public async toggleReaction(
    roomId: string,
    messageId: string,
    emoji: string,
    action: 'add' | 'remove'
  ): Promise<ApiResponse<{ reactions: Record<string, string[]> }>> {
    return await drexdelApiClient.post<{ reactions: Record<string, string[]> }>(
      `/chat/rooms/${roomId}/messages/${messageId}/reactions`,
      { emoji, action }
    );
  }

  /**
   * PATCHs an edited message (owner-only on the server).
   */
  public async editMessage(
    roomId: string,
    messageId: string,
    content: string
  ): Promise<ApiResponse<{ message: ChatMessage }>> {
    return await drexdelApiClient.patch<{ message: ChatMessage }>(`/chat/rooms/${roomId}/messages/${messageId}`, { content });
  }

  /**
   * Soft-deletes a message (owner-only on the server).
   */
  public async deleteMessage(roomId: string, messageId: string): Promise<ApiResponse<{ messageId: string }>> {
    return await drexdelApiClient.delete<{ messageId: string }>(`/chat/rooms/${roomId}/messages/${messageId}`);
  }

  /**
   * Mints a Supabase signed upload URL for chat media. The caller then PUTs
   * the binary to `uploadUrl` directly (CDN edge) and references the file in
   * a subsequent sendMessage IMAGE/VIDEO payload.
   */
  public async createUploadSession(
    mediaType: 'IMAGE' | 'VIDEO',
    filename: string,
    mimeType: string,
    fileSize?: number
  ): Promise<ApiResponse<{ uploadUrl: string; fileKey: string; bucket: string }>> {
    return await drexdelApiClient.post<{ uploadUrl: string; fileKey: string; bucket: string }>(
      '/chat/media/upload-session',
      { mediaType, filename, mimeType, ...(fileSize ? { fileSize } : {}) },
    );
  }

  /**
   * PUTs a binary blob to a pre-signed Supabase URL.
   */
  public async uploadToPresignedUrl(uploadUrl: string, file: Blob | { uri: string; type?: string; name?: string }): Promise<void> {
    let body: any = file;
    if ('uri' in (file as any)) {
      // React Native: fetch the local file to a blob first.
      const resp = await fetch((file as any).uri);
      body = await resp.blob();
    }
    const contentType = (file as any).type || 'application/octet-stream';
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body,
    });
    if (!res.ok) throw new Error('Chat media upload failed with status ' + res.status);
  }

  /**
   * Mutates the state of a group poll whenever a friend selects an alternative event option.
   */
  public async castPollVote(
    roomId: string,
    messageId: string,
    pollId: string,
    selectedEventId: string
  ): Promise<ApiResponse<{ updatedPoll: VotingPoll }>> {
    return await drexdelApiClient.post<{ updatedPoll: VotingPoll }>(
      `/chat/rooms/${roomId}/messages/${messageId}/polls/${pollId}/vote`,
      { selectedEventId }
    );
  }
}

export const chatApi = new ChatApi();
