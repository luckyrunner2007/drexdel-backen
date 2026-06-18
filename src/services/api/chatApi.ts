export async function connectChat() {
  return null;
}
/**
 * PROJECT DREXDEL - SOCIAL BOND ROOMS DATA API SERVICE
 * FILE: src/services/api/chatApi.ts
 */

import { drexdelApiClient, ApiResponse } from './client';
import { ChatMessage, VotingPoll } from '../../@types/events';

class ChatApi {
  /**
   * Fetches the message timeline history for a specific group bond room.
   */
  public async fetchRoomMessages(roomId: string): Promise<ApiResponse<ChatMessage[]>> {
    return await drexdelApiClient.get<ChatMessage[]>(`/chat/rooms/${roomId}/messages`);
  }

  /**
   * Dispatches a fresh message node to the group chat server channel.
   * Can transmit plain text, shared event card IDs, or interactive voting polls.
   */
  public async submitMessage(
    roomId: string, 
    messagePayload: { text?: string; sharedEventId?: string; attachedPoll?: Omit<VotingPoll, 'id'> }
  ): Promise<ApiResponse<ChatMessage>> {
    console.log(`[Chat API] Emitting live chat package to Bond Room: ${roomId}`);
    
    // In production, this can also hook into real-time WebSockets (e.g. socket.emit('sendMessage', ...))
    return await drexdelApiClient.post<ChatMessage>(`/chat/rooms/${roomId}/send`, messagePayload);
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
    console.log(`[Chat API] Submitting vote mutation for poll ${pollId} on event target: ${selectedEventId}`);
    
    return await drexdelApiClient.post<{ updatedPoll: VotingPoll }>(
      `/chat/rooms/${roomId}/messages/${messageId}/polls/${pollId}/vote`,
      { selectedEventId }
    );
  }
}

export const chatApi = new ChatApi();
