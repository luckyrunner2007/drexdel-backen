import { Stack } from 'expo-router';
import { UserProvider } from '../src/state/UserContext';
import { EventProvider } from '../src/state/EventContext';
import { LiveChatProvider } from '../src/state/LiveChatContext';
import { StripeProvider } from '../src/components/StripeProvider';
import { RootErrorBoundary } from '../src/components/RootErrorBoundary';

export default function RootLayout() {
  return (
    <RootErrorBoundary>
      <StripeProvider>
        <UserProvider>
          <EventProvider>
            <LiveChatProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="event/[id]" options={{ presentation: 'modal' }} />
                <Stack.Screen name="profile/[id]" options={{ presentation: 'modal' }} />
                <Stack.Screen name="UserSearch" options={{ presentation: 'modal' }} />
                <Stack.Screen name="FollowersList" options={{ presentation: 'modal' }} />
                <Stack.Screen name="FollowingList" options={{ presentation: 'modal' }} />
                <Stack.Screen name="presence" options={{ presentation: 'modal' }} />
                <Stack.Screen name="checkout" options={{ presentation: 'modal' }} />
                <Stack.Screen name="receipt" options={{ presentation: 'modal' }} />
                <Stack.Screen name="room/[id]" options={{ presentation: 'modal' }} />
                <Stack.Screen name="group-info/[id]" options={{ presentation: 'modal' }} />
              </Stack>
            </LiveChatProvider>
          </EventProvider>
        </UserProvider>
      </StripeProvider>
    </RootErrorBoundary>
  );
}
