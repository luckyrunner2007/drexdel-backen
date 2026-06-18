/**
 * PROJECT DREXDEL - GLOBAL NAVIGATION TYPE MAPS
 * FILE: src/@types/navigation.d.ts
 */

import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { DrexdelEvent, EventCategory } from './events';

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

// 1. THE ROOT MASTER NAVIGATOR
export type RootStackParamList = {
  AuthLoading: undefined;
  AuthStack: undefined;
  MainTabs: undefined;
  GateStaffStack: { staffCode: string; organizerId: string }; // Bouncers enter with credentials
  ActiveRoom: { roomId: string; roomName: string; initialSharedEventId?: string };
  CreateEvent: undefined;
  EventDetails: { eventId: string; eventData?: DrexdelEvent };
  Checkout: { eventId: string; eventTitle: string; selectedTierId: string; selectedTierName: string; selectedTierPrice: number; currency: 'USD' | 'RWF' | 'EUR'; ticketQuantity: number };
  TicketReceipt: { ticketId: string; encryptedToken: string; eventTitle?: string; tierName?: string; amount?: number; currency?: 'USD' | 'RWF' | 'EUR' };
};

// 2. AUTHENTICATION FLOW ROUTING (No parameters needed for basic views)
export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  OTPVerification: { destination: string; type: 'email' | 'sms' }; // Passes where to send the token
  ResetPassword: { verificationToken: string }; // Protects password reset with verified token
  Onboarding: undefined; // The Category Selector grid
};

// 3. CORE APPLICATIONAL TABS
export type TabParamList = {
  Explore: undefined;   // Main algorithmic event feed
  Radar: undefined;     // Map view with radial sliders
  BondRooms: undefined; // The group chat lists
  Wallet: undefined;    // Saved offline tickets
  Dashboard: undefined; // Host business analytics (Promoters only)
};

// 4. SUB-STACK: DISCOVERY & TICKETING SYSTEM (Crucial for passing object data)
export type DiscoveryStackParamList = {
  HomeFeed: { selectedCategory?: EventCategory }; // Allows filtering the feed via home taps
  EventDetails: { eventId: string; eventData?: DrexdelEvent }; // Passes full event data to detail view
  Checkout: { eventId: string; selectedTierId: string; ticketQuantity: number }; // Locks in checkout metadata
  TicketReceipt: { ticketId: string; encryptedToken: string }; // Renders final successful purchase screen
  OrganizerProfile: { organizerId: string }; // Opens social layout with past/future reels
};

// 5. SUB-STACK: SOCIAL BOND ROOMS & GROUP COORDINATION
export type ChatStackParamList = {
  ChatList: undefined;
  ActiveRoom: { roomId: string; roomName: string; initialSharedEventId?: string }; // Routes directly into chats
  CreatePoll: { roomId: string }; // Launches voting modal inside a specific group chat
};

// 6. GENERAL HELPER TYPINGS FOR HOOKS
// These allow you to type useNavigation() inside any component effortlessly
export type GlobalNavigationProp = NativeStackNavigationProp<RootStackParamList & DiscoveryStackParamList & ChatStackParamList>;
export type TabNavigationProp = BottomTabNavigationProp<TabParamList>;


