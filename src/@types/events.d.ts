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
  status: 'booked' | 'checked_in' | 'refunded';
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
  text?: string;
  sharedEventId?: string; // If a user drops an event card into the chat room
  attachedPoll?: VotingPoll; // If a user launches a voting poll
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
