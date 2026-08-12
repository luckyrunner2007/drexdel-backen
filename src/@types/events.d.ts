/**
 * PROJECT DREXDEL - GLOBAL TYPE DEFINITIONS
 * FILE: src/@types/events.d.ts
 */

// 1. USER & ACCOUNT INFRASTRUCTURE
export type UserRole = 'casual_user' | 'promoter_admin' | 'gate_staff';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  phoneNumber: string; // Critical for MTN MoMo / Airtel Money verification
  profilePicUrl?: string;
  bio?: string;
  role: UserRole;
  subscribedOrganizerIds: string[]; // List of host IDs this user follows
  attendedEventIds: string[];      // The user's lifetime History Vault container
  backupRecoveryCodes: string[];   // Emergency account rescue tokens
  createdAt: string;
}

// 2. TICKETING & ACCESSIBILITY SYSTEMS
export interface TicketTier {
  id: string;
  name: string;          // e.g., "Early Bird", "Regular", "VIP", "VVIP Backstage"
  price: number;         // Set to 0 for Free Events / Charity Banquets
  currency: 'RWF' | 'USD' | 'EUR'; // Supports global cards and regional Mobile Money
  totalAllocation: number; // Max tickets available for this tier
  ticketsSold: number;
  description: string;   // e.g., "Includes a free drink and front-row seating"
  isActive: boolean;
}

export interface EncryptedTicket {
  id: string;
  eventId: string;
  userId: string;
  tierId: string;
  purchaseTimestamp: string;
  cryptographicToken: string; // The rolling 30-second token for offline validation
  qrCodeString: string;       // Unique hashed string to render the QR code
  status: 'booked' | 'checked_in' | 'refunded' | 'used';
  event: {
    title: string;
    date: string;
    location: string;
    coverImageUrl?: string;
  };
  tier: {
    name: string;
    price: number;
    currency: string;
  };
}

// 3. MEDIA & SOCIAL PROOF NODES
export interface MediaPost {
  id: string;
  organizerId: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  caption: string;
  viewsCount: number;
  likesCount: number;
  likedByUserIds: string[];
  commentsCount: number;
  isLinkedToPastEvent: boolean;
  eventId?: string; // Optional reference link to the specific event
  createdAt: string;
}

export interface Comment {
  id: string;
  mediaPostId: string;
  userId: string;
  username: string;
  profilePicUrl?: string;
  text: string;
  createdAt: string;
}

// 4. THE CORE EVENT OBJECT
export type EventCategory = 
  | 'ai_conference' 
  | 'cosplay' 
  | 'workshop' 
  | 'business_forum' 
  | 'party' 
  | 'sports' 
  | 'hotel_promotion' 
  | 'charity';

export interface EventLocation {
  venueName: string;
  address: string;
  latitude: number;  // GPS decimal coordinate
  longitude: number; // GPS decimal coordinate
}

// Media attachment node inside a chat message.
export interface ChatAttachment {
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

// ---------------------------------------------------------------------------
// REAL-TIME VOICE / VIDEO CALLS (WebRTC signaling over the chat socket)
// ---------------------------------------------------------------------------
export type CallMode = 'audio' | 'video';
export type CallStatus = 'ringing' | 'in-progress' | 'ended' | 'rejected' | 'cancelled' | 'failed';

export interface CallSession {
  id: string;
  roomId: string;
  callerUserId: string;
  calleeUserId: string;
  mode: CallMode;
  status: CallStatus;
  isIncoming: boolean; // true when THIS device is the callee
  startedAt: string;
  answeredAt?: string;
  endedAt?: string;
  /** Local WebRTC sink the active state machine uses to plumb SDP/ICE. */
  signaling?: {
    remoteSdp?: any;
    remoteIce?: any[];
    localSdp?: any;
  };
}

export interface IncomingCallPayload {
  roomId: string;
  callId: string;
  callerUserId: string;
  calleeUserId: string;
  mode: CallMode;
  sdp?: any;
  startedAt: string;
}

export interface CallSignalingEvent {
  roomId: string;
  callId: string;
  userId: string;
  sdp?: any;
  candidate?: any;
  mode?: CallMode;
  rejectedAt?: string;
}

export interface DrexdelEvent {
  id: string;
  organizerId: string;
  title: string;
  description: string;
  category: EventCategory;
  location: EventLocation;
  isPrivate: boolean; // true = visible only via group chats (House Parties/Karaoke)
  imageUrl: string;
  startTime: string; // ISO Timestamp (e.g., "2026-06-15T20:00:00Z")
  endTime: string;
  ticketTiers: TicketTier[];
  isOrganizerVerified: boolean;
  tags: string[]; // For the custom recommendation engine
}

// 5. GROUP CHAT & BONDING ROOMS
export interface VotingPoll {
  id: string;
  question: string;
  options: {
    eventId: string;
    eventTitle: string;
    votesCount: number;
    votedUserIds: string[];
  }[];
  expiresAt: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderUsername?: string;
  text?: string;
  sharedEventId?: string; // If a user drops an event card into the chat room
  attachedPoll?: VotingPoll; // If a user launches a voting poll
  messageType?: 'TEXT' | 'IMAGE' | 'EVENT_CARD' | 'POLL' | 'SYSTEM';
  attachments?: ChatAttachment[];
  reactions?: Record<string, string[]>; // emoji -> userId[]
  isEdited?: boolean; // set when a message has been edited
  editedAt?: string; // ISO timestamp of the last edit
  callData?: {
    callId?: string;
    mode?: 'audio' | 'video';
    durationSeconds?: number;
    status?: 'completed' | 'missed' | 'rejected';
  };
  createdAt: string;
}

// 6. BUSINESS ANALYTICS SYSTEM
export interface OrganizerAnalytics {
  organizerId: string;
  totalRevenueAllTime: number;
  currency: string;
  totalTicketsSoldAllTime: number;
  profileViews: number;
  activeStaffAccessCodes: {
    code: string;       // The "Gate Keeper Code" given to bouncers
    staffName: string;
    expiryDate: string;
  }[];
}
