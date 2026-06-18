/**
 * PROJECT DREXDEL - UPGRADED REAL-TIME WEBSOCKET CHAT STATE CONTEXT
 * FILE: src/state/LiveChatContext.tsx
 */

import React, { createContext, useContext, useState } from 'react';
import { ChatMessage } from '../@types/events';

interface LiveChatContextType {
  activeMessages: ChatMessage[];
  isConnectingChat: boolean;
  joinRoomChannel: (roomId: string, userId: string) => void;
  emitTextMessage: (roomId: string, currentUserId: string, currentUserName: string, text: string) => void;
  registerPollVote: (roomId: string, messageId: string, pollId: string, selectedEventId: string, currentUserId: string) => void;
}

const LiveChatContext = createContext<LiveChatContextType | undefined>(undefined);

export const LiveChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);
  // FIX: Declaring the missing state allocation tracking parameter to satisfy your contract context
  const [isConnectingChat, setIsConnectingChat] = useState<boolean>(false);
  
  // Simulated handle representing your websocket socket.io-client engine connection tunnel
  // In your production app, this instantiates: const socket = io('https://drexdel.com');
  const mockSocketRef = {
    emit: (_eventName: string, _payload: any) => console.log(`[WebSocket Emit] Fired with payload data packet.`),
    on: (_eventName: string, _callback: Function) => {}
  };

  /**
   * Connects and locks the user's phone line into a specific friend group bond room stream
   */
  const joinRoomChannel = (roomId: string, userId: string) => {
    setIsConnectingChat(true);
    mockSocketRef.emit('join_bond_room', { roomId, userId });
    // Production fetches historical background texts asynchronously from cloud caches here:
    setActiveMessages([]);
    setIsConnectingChat(false);
  };

  /**
   * Emitters process transformations via lightweight streaming duplex packets instantly
   */
  const emitTextMessage = (roomId: string, currentUserId: string, currentUserName: string, text: string) => {
    const messageNode: ChatMessage = {
      id: `msg_local_${Date.now()}`,
      senderId: currentUserId,
      senderName: currentUserName,
      text: text,
      createdAt: new Date().toISOString()
    };

    // OPTIMISTIC UI PRINCIPLE: Render message instantly locally before network cycles even start
    setActiveMessages(prev => [...prev, messageNode]);

    // Blast raw data token packet down the continuous persistent WebSocket pipeline corridor
    mockSocketRef.emit('send_group_packet', { roomId, message: messageNode });
  };

  /**
   * Blasts voting choices to the cluster instantly, syncing options visual meters across friend groups
   */
  const registerPollVote = (roomId: string, messageId: string, pollId: string, selectedEventId: string, currentUserId: string) => {
    // 1. Mutate locally instantly for fluid percentage bar scrolling tracking
    setActiveMessages(prevMessages => 
      prevMessages.map(msg => {
        if (msg.id !== messageId || !msg.attachedPoll) return msg;
        const choices = msg.attachedPoll.options.map(opt => {
          const alreadySelected = opt.votedUserIds.includes(currentUserId);
          if (opt.eventId === selectedEventId) {
            return {
              ...opt,
              votesCount: alreadySelected ? opt.votesCount : opt.votesCount + 1,
              votedUserIds: alreadySelected ? opt.votedUserIds : [...opt.votedUserIds, currentUserId]
            };
          } else {
            return {
              ...opt,
              votesCount: opt.votedUserIds.includes(currentUserId) ? opt.votesCount - 1 : opt.votesCount,
              votedUserIds: opt.votedUserIds.filter(id => id !== currentUserId)
            };
          }
        });
        return { ...msg, attachedPoll: { ...msg.attachedPoll, options: choices } };
      })
    );

    // 2. Stream the token payload through the socket corridor to update everyone else's devices
    mockSocketRef.emit('cast_poll_vote_packet', { roomId, messageId, optionEventId: selectedEventId, userId: currentUserId });
  };

  return (
    <LiveChatContext.Provider value={{ activeMessages, isConnectingChat, joinRoomChannel, emitTextMessage, registerPollVote }}>
      {children}
    </LiveChatContext.Provider>
  );
};

export const useLiveChat = () => {
  const context = useContext(LiveChatContext);
  if (context === undefined) throw new Error('useLiveChat constraints violation.');
  return context;
};