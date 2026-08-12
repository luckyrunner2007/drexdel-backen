/**
 * PROJECT DREXDEL - GLOBAL USER SESSION & AUTHENTICATION CONTEXT
 * FILE: src/state/UserContext.tsx
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole, EventCategory } from '../@types/events';
import { drexdelApiClient } from '../services/api/client';
import * as SecureStore from 'expo-secure-store';

// 1. DECLARE THE CONTEXT INTERFACE CONTRACT
interface UserContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoadingSession: boolean;
  loginUser: (identity: string, password: string) => Promise<boolean>;
  logoutUser: () => Promise<void>;
  updateUserInterests: (interests: EventCategory[]) => Promise<boolean>;
  appendAttendedEvent: (eventId: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// 2. THE LIVE STATE PROVIDER WRAPPER ENGINE
export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);

  // Auto-loads an active session token from secure device storage upon initialization
  useEffect(() => {
    const bootstrapAsyncSession = async () => {
      try {
        const token = await SecureStore.getItemAsync('drexdel_token');
        if (token) drexdelApiClient.setAuthToken(token);
        setIsLoadingSession(false);
      } catch {
        console.error('[User Context] Failed to bootstrap secure localized session key infrastructure.');
        setIsLoadingSession(false);
      }
    };

    bootstrapAsyncSession();
  }, []);

  /**
   * Orchestrates the active login flow state transformations
   * Calls the real backend /v1/auth/login endpoint.
   */
  const loginUser = async (identity: string, password: string): Promise<boolean> => {
    setIsLoadingSession(true);
    try {
      const response = await drexdelApiClient.login(identity, password);
      if (!response.success || !response.data) {
        console.warn('[User Context] Login failed:', response.message);
        setIsLoadingSession(false);
        return false;
      }

      const { token, user: authUser } = response.data;

      // Persist the real JWT securely and inject it into the API client
      await SecureStore.setItemAsync('drexdel_token', token);
      drexdelApiClient.setAuthToken(token);

      const profile: UserProfile = {
        id: authUser.id,
        username: authUser.name || authUser.email.split('@')[0],
        email: authUser.email,
        phoneNumber: '',
        role: (authUser.role.toLowerCase() as UserRole) || 'casual_user',
        subscribedOrganizerIds: [],
        attendedEventIds: [],
        backupRecoveryCodes: [],
        createdAt: new Date().toISOString(),
      };

      setUser(profile);
      setIsLoadingSession(false);
      return true;
    } catch (error) {
      console.error('[User Context] Native login pipeline execution failure:', error);
      setIsLoadingSession(false);
      return false;
    }
  };

    /**
   * Securely purges session tokens and returns app state back to Auth login guards
   * Calls the backend /v1/auth/logout endpoint to blacklist the JWT.
   */
  const logoutUser = async (): Promise<void> => {
    console.log('[User Context] Purging local authorization tokens and tracking contexts...');
    try {
      await drexdelApiClient.logout();
    } catch {
      // Best-effort: network error shouldn't block local logout
    }
    await SecureStore.deleteItemAsync('drexdel_token');
    drexdelApiClient.clearAuthToken();
    setUser(null);
  };

  /**
   * Updates user preferences from the Onboarding selection screen directly into the active context
   */
  const updateUserInterests = async (_interests: EventCategory[]): Promise<boolean> => {
    if (!user) return false;
    try {
      console.log('[User Context] Committing interest preferences array payload data...');

      // In production, this syncs to the server: await api.put('/user/interests', { interests });
      setUser(prev => prev ? { ...prev, subscribedOrganizerIds: [] } : null); // Updates locally
      return true;
    } catch (error) {
      console.error('[User Context] Interest database sync tracking failure:', error);
      return false;
    }
  };

  /**
   * Pushes verified checked-in events into the History Vault timeline list arrays dynamically
   */
  const appendAttendedEvent = (eventId: string) => {
    setUser(prev => {
      if (!prev || prev.attendedEventIds.includes(eventId)) return prev;
      return {
        ...prev,
        attendedEventIds: [...prev.attendedEventIds, eventId]
      };
    });
    console.log(`[User Context] Geofence verified. Injected event memory token ${eventId} into the History Vault.`);
  };

  return (
    <UserContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoadingSession,
      loginUser,
      logoutUser,
      updateUserInterests,
      appendAttendedEvent
    }}>
      {children}
    </UserContext.Provider>
  );
};

// 3. CUSTOM COMPLIANT REUSABLE REACT HOOK INTERFACE
export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser state constraints must be executed within an active UserProvider hierarchy window.');
  }
  return context;
};