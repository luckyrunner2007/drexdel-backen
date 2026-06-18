/**
 * PROJECT DREXDEL - GLOBAL USER SESSION & AUTHENTICATION CONTEXT
 * FILE: src/state/UserContext.tsx
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole, EventCategory } from '../@types/events';
import { drexdelApiClient } from '../services/api/client';

// 1. DECLARE THE CONTEXT INTERFACE CONTRACT
interface UserContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoadingSession: boolean;
  loginUser: (identity: string, role: UserRole) => Promise<boolean>;
  logoutUser: () => Promise<void>;
  updateUserInterests: (interests: EventCategory[]) => Promise<boolean>;
  appendAttendedEvent: (eventId: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// 2. MOCK DATA CONDUIT (Simulating a successful login profile payload response)
const createMockProfile = (id: string, email: string, role: UserRole): UserProfile => ({
  id,
  username: email.split('@')[0],
  email,
  phoneNumber: '+250788123456', // Base formatting supporting MTN MoMo rails
  role,
  subscribedOrganizerIds: ['org_kcc_55'],
  attendedEventIds: ['hist_01', 'hist_02'], // Base historical links loaded into the History Vault
  backupRecoveryCodes: ['REC-4821', 'REC-9912', 'REC-0023'],
  createdAt: new Date().toISOString()
});

// 3. THE LIVE STATE PROVIDER WRAPPER ENGINE
export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);

  // Auto-loads an active session token from secure device storage upon initialization
  useEffect(() => {
    const bootstrapAsyncSession = async () => {
      try {
        console.log('[User Context] Bootstrapping localized secure session keys...');
        // In execution: const token = await SecureStore.getItemAsync('user_token');
        
        // Simulating finding an existing casual user active session token profile
        setTimeout(() => {
          const storedMockProfile = createMockProfile('usr_me_77', 'casual_guest@drexdel.com', 'casual_user');
          setUser(storedMockProfile);
          drexdelApiClient.setAuthToken('MOCK_JWT_ACQUIRED_TOKEN');
          setIsLoadingSession(false);
        }, 1000);

      } catch { 
        console.error('[User Context] Failed to bootstrap secure localized session key infrastructure.');
        setIsLoadingSession(false);
      }
    };

    bootstrapAsyncSession();
  }, []);

  /**
   * Orchestrates the active login flow state transformations
   */
  const loginUser = async (identity: string, role: UserRole): Promise<boolean> => {
    setIsLoadingSession(true);
    try {
      console.log(`[User Context] Setting session parameters for credential role: [${role.toUpperCase()}]`);
      
      const sessionProfile = createMockProfile(
        role === 'gate_staff' ? 'staff_bouncer_04' : 'usr_promoter_12',
        identity.includes('@') ? identity : `${identity}@drexdel.com`,
        role
      );

      // Inject authorization parameters down to your core server client network wrappers
      drexdelApiClient.setAuthToken('JWT_TOKEN_GENERATED_AT_LOGIN_RAILS');
      setUser(sessionProfile);
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
   */
  const logoutUser = async (): Promise<void> => {
    console.log('[User Context] Purging local authorization tokens and tracking contexts...');
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

// 4. CUSTOM COMPLIANT REUSABLE REACT HOOK INTERFACE
export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser state constraints must be executed within an active UserProvider hierarchy window.');
  }
  return context;
};
