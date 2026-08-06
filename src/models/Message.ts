export interface MessageModel {
  id: string;
  senderId: string;
  text?: string;
  sharedEventId?: string;
  pollWeight?: number;
}
/**
 * PROJECT DREXDEL - REAL-TIME STREAMING MESSAGE SCHEMA
 * FILE: drexdel-backend/src/models/Message.ts
 */

interface VotingPollOption {
  eventId: string;
  eventTitle: string;
  votesCount: number;
  votedUserIds: string[];
}

interface VotingPoll {
  id: string;
  question: string;
  options: VotingPollOption[];
  expiresAt: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
  sharedEventId?: string;
  attachedPoll?: VotingPoll;
}

export interface MessageDatabaseDocument extends ChatMessage {
  roomId: string; // The specific group bond room tracking channel link
  isSoftDeleted: boolean;
}

/**
 * CONCURRENCY MANAGEMENT CLUSTER INDEXES:
 * CREATE INDEX idx_messages_room_time ON "Messages" ("roomId", "createdAt" DESC);
 */
export class MessageModel {
  private static messageDatastore: MessageDatabaseDocument[] = [];

  public static async saveMessage(document: MessageDatabaseDocument): Promise<MessageDatabaseDocument> {
    this.messageDatastore.push(document);
    return document;
  }

  public static async getRoomHistory(roomId: string, limit: number = 50): Promise<MessageDatabaseDocument[]> {
    return this.messageDatastore
      .filter(msg => msg.roomId === roomId && !msg.isSoftDeleted)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-limit); // Pulls latest chunks smoothly to keep load times low
  }

  /**
   * ATOMIC POLL VOTE COUNTER MUTATOR
   * Processes selections securely, updating vote weights inside deep JSON structures
   */
  public static async mutatePollVote(
    roomId: string,
    messageId: string,
    optionEventId: string,
    userId: string
  ): Promise<VotingPoll | null> {
    const targetMsg = this.messageDatastore.find(msg => msg.id === messageId && msg.roomId === roomId);
    if (!targetMsg || !targetMsg.attachedPoll) return null;

    const poll = targetMsg.attachedPoll;

    poll.options = poll.options.map(option => {
      const userHasVoted = option.votedUserIds.includes(userId);

      if (option.eventId === optionEventId) {
        return {
          ...option,
          votesCount: userHasVoted ? option.votesCount : option.votesCount + 1,
          votedUserIds: userHasVoted ? option.votedUserIds : [...option.votedUserIds, userId]
        };
      } else {
        return {
          ...option,
          votesCount: option.votedUserIds.includes(userId) ? option.votesCount - 1 : option.votesCount,
          votedUserIds: option.votedUserIds.filter(id => id !== userId)
        };
      }
    });

    return poll;
  }
}
