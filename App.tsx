/**
 * PROJECT DREXDEL - CORE FULL-STACK NAVIGATION ROUTER ENGINE
 * FILE: drexdelnative/App.tsx
 */
import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CreateEventScreen } from './src/screens/Dashboard/CreateEventScreen';
import { CheckoutScreen } from './src/screens/Discovery/CheckoutScreen';
import { TicketReceiptScreen } from './src/screens/Discovery/TicketReceiptScreen';
// 1. IMPORTING YOUR CORE DATA ARCHITECTURE STRIPS
import { UserRole } from './src/@types/events';
import { RootStackParamList, AuthStackParamList, TabParamList } from './src/@types/navigation';

// 2. CONNECTING YOUR SCHEMATIC USER PAGE CONTAINERS
import { LoginScreen } from './src/screens/Auth/LoginScreen';
import { OnboardingScreen } from './src/screens/Auth/OnboardingScreen';
import { HomeScreen } from './src/screens/Discovery/HomeScreen';
import { MapRadarScreen } from './src/screens/Discovery/MapRadarScreen';
import { EventDetailsScreen } from './src/screens/Discovery/EventDetailsScreen';
import { ChatListScreen } from './src/screens/Chat/ChatListScreen';
import { RoomScreen } from './src/screens/Chat/RoomScreen';
import { TicketWallet } from './src/screens/Wallet/TicketWallet';
import { OrganiserHub } from './src/screens/Dashboard/OrganiserHub';
//  FIX: Unified module namespace allocation name string to prevent compilation blocks
import * as GateScannerViewModule from './src/components/Security/GateScannerView';

// Instantiate your secure type-safe routing handlers
const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// --- STATIC ICON RENDERING MODULES (Optimized to prevent re-render reallocations) ---
const ExploreIcon = () => <Text>🔍</Text>;
const RadarIcon = () => <Text>📍</Text>;
const BondRoomsIcon = () => <Text>💬</Text>;
const WalletIcon = () => <Text>🎟️</Text>;
const DashboardIcon = () => <Text>📊</Text>;

// --- MODULE A: PRE-AUTHENTICATION SECURITY LOOP ---
const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
  </AuthStack.Navigator>
);

// --- MODULE B: PRIMARY FUNCTIONAL PORTAL TABS (500k User Scale Optimized) ---
const MainTabNavigator = ({ userRole }: { userRole: UserRole }) => (
  <Tab.Navigator screenOptions={{ headerShown: false }}>
    <Tab.Screen 
      name="Explore" 
      component={HomeScreen} 
      options={{ title: 'Drexdel Explore', tabBarIcon: ExploreIcon }}
    />
    <Tab.Screen 
      name="Radar" 
      component={MapRadarScreen} 
      options={{ title: 'Live GPS Radar', tabBarIcon: RadarIcon }}
    />
    <Tab.Screen 
      name="BondRooms" 
      component={ChatListScreen} 
      options={{ title: 'Squad Chats', tabBarIcon: BondRoomsIcon }}
    />
    <Tab.Screen 
      name="Wallet" 
      component={TicketWallet} 
      options={{ title: 'My Passes', tabBarIcon: WalletIcon }}
    />
    
    {/* CONDITIONAL STRIP LAYER: Restricts corporate analytics metrics to promoters strictly */}
    {userRole === 'promoter_admin' && (
      <Tab.Screen 
        name="Dashboard" 
        component={OrganiserHub} 
        options={{ title: 'Promoter Hub', tabBarIcon: DashboardIcon }}
      />
    )}
  </Tab.Navigator>
);

// --- MODULE C: ROOT APP EXECUTION ENGINE ---
export default function App() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoggedIn] = useState<boolean>(false);
  const [userRole] = useState<UserRole>('casual_user');

  useEffect(() => {
    // Simulating quick localized session token retrieval check on storage blocks
    const bootTimer = setTimeout(() => {
      setIsLoading(false);
    }, 1200);

    return () => clearTimeout(bootTimer);
  }, []);

  // Graceful boot loader spinner overlay preventing flickering during application starts
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7B2CBF" />
        <Text style={styles.loadingText}>LAUNCHING DREXDEL...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!isLoggedIn ? (
          // USER DISCONNECTED: Route to Authentication Stack entry grids
          <RootStack.Screen name="AuthStack" component={AuthNavigator} />
        ) : userRole === 'gate_staff' ? (
          // STAFF LOGIN OVERRIDE DETECTED: Isolate gate workers securely on scanner screens with non-nested function pointer mapping layouts
          <RootStack.Screen name="GateStaffStack">
            {(props) => {
              const ScannerComponent = (GateScannerViewModule as any).GateScannerView || GateScannerViewModule;
              return <ScannerComponent {...props} />;
            }}
          </RootStack.Screen>
        ) : (
          // USER VERIFIED: Passing a stable wrapper method directly as a non-nested function pointer component
          <RootStack.Screen name="MainTabs">
            {() => <MainTabNavigator userRole={userRole} />}
          </RootStack.Screen>
        )}

        {/* Deep linking sub-stack routes for navigation operations */}
        <RootStack.Screen 
          name="ActiveRoom" 
          component={RoomScreen} 
          options={{ headerShown: true, title: 'Squad Coordination Room', headerTintColor: '#7B2CBF' }} 
        />
        <RootStack.Screen
          name="EventDetails"
          component={EventDetailsScreen}
          options={{ headerShown: true, title: 'Event Details', headerTintColor: '#7B2CBF' }}
        />
        <RootStack.Screen
          name="Checkout"
          component={CheckoutScreen}
          options={{ headerShown: true, title: 'Secure Checkout', headerTintColor: '#7B2CBF' }}
        />
        <RootStack.Screen
          name="TicketReceipt"
          component={TicketReceiptScreen}
          options={{ headerShown: true, title: 'Ticket Receipt', headerTintColor: '#7B2CBF' }}
        />
        <RootStack.Screen 
          name="CreateEvent" 
          component={CreateEventScreen} 
          options={{ 
            headerShown: true, 
            title: 'Host New Event', 
            headerTintColor: '#7B2CBF',
            headerStyle: { backgroundColor: '#FAFAFE' }
          }} 
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

// Fixed performance and inline styles alerts metrics tracking rulesets
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFE'
  },
  loadingText: {
    marginTop: 14,
    color: '#7B2CBF',
    fontWeight: '700',
    letterSpacing: 0.5
  }
});
