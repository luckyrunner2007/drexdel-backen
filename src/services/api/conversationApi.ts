/**
 * PROJECT DREXDEL - DIRECT MESSAGES API SERVICE
 * FILE: src/services/api/conversationApi.ts
 *
 * Inbox, start-or-get DM, message history, send, and mark-read for 1:1 chats.
 */

import { drexdelApiClient, ApiResponse } from './client';

export interface ConversationPeer {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
}

export interface ConversationMember {
  userId: string;
  role: 'ADMIN' | 'MEMBER';
  user: ConversationPeer;
}

export interface ConversationSummary {
  id: string;
  type: 'DIRECT' | 'GROUP';
  title: string | null;
  description: string | null;
  avatarUrl: string | null;
  isPublic: boolean;
  createdBy: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  muted: boolean;
  lastReadAt: string | null;
  unreadHint: number;
  peers: ConversationPeer[];
  members?: ConversationMember[];
}

export interface DmMessage {
  id: string;
  conversationId: string | null;
  senderId: string;
  content: string;
  messageType: string;
  createdAt: string;
  deliveredAt?: string | null;
  readAt?: string | null;
  sender?: {
    id: string;
    name: string;
    username?: string | null;
    avatarUrl?: string | null;
  };
}

class ConversationApi {
  public async listInbox(): Promise<ApiResponse<{ conversations: ConversationSummary[] }>> {
    return drexdelApiClient.get<{ conversations: ConversationSummary[] }>('/conversations');
  }

  public async startOrGetDm(userId: string): Promise<ApiResponse<{ conversation: {
    id: string;
    type: string;
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
    peers: ConversationPeer[];
  } }>> {
    return drexdelApiClient.post('/conversations/dm', { userId });
  }

  public async fetchMessages(
    conversationId: string,
    before?: string,
  ): Promise<ApiResponse<{ messages: DmMessage[]; nextCursor: string | null }>> {
    const q = before ? `?before=${encodeURIComponent(before)}` : '';
    return drexdelApiClient.get(`/conversations/${conversationId}/messages${q}`);
  }

  public async sendMessage(
    conversationId: string,
    content: string,
  ): Promise<ApiResponse<{ message: DmMessage }>> {
    return drexdelApiClient.post(`/conversations/${conversationId}/messages`, {
      content,
      messageType: 'TEXT',
    });
  }

  public async markRead(conversationId: string): Promise<ApiResponse<{ readAt: string }>> {
    return drexdelApiClient.post(`/conversations/${conversationId}/read`, {});
  }

  public async createGroup(data: {
    title: string;
    description?: string | null;
    avatarUrl?: string | null;
    isPublic?: boolean;
    memberIds: string[];
  }): Promise<ApiResponse<{ conversation: ConversationSummary }>> {
    return drexdelApiClient.post('/conversations/group', data);
  }

  public async updateGroup(
    conversationId: string,
    data: { title?: string; description?: string | null; avatarUrl?: string | null; isPublic?: boolean }
  ): Promise<ApiResponse<{ conversation: ConversationSummary }>> {
    return drexdelApiClient.patch(`/conversations/${conversationId}`, data);
  }

  public async addMembers(
    conversationId: string,
    userIds: string[]
  ): Promise<ApiResponse<{ members: ConversationMember[] }>> {
    return drexdelApiClient.post(`/conversations/${conversationId}/members`, { userIds });
  }

  public async removeMember(conversationId: string, userId: string): Promise<ApiResponse<void>> {
    return drexdelApiClient.delete(`/conversations/${conversationId}/members/${userId}`);
  }

  public async leaveGroup(conversationId: string): Promise<ApiResponse<void>> {
    return drexdelApiClient.post(`/conversations/${conversationId}/leave`, {});
  }

  public async transferAdmin(conversationId: string, userId: string): Promise<ApiResponse<void>> {
    return drexdelApiClient.post(`/conversations/${conversationId}/members/${userId}/admin`, {});
  }

  public async dissolveGroup(conversationId: string): Promise<ApiResponse<void>> {
    return drexdelApiClient.delete(`/conversations/${conversationId}`);
  }
}

export const conversationApi = new ConversationApi();
