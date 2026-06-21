import { Stack } from 'expo-router';
import { UserProvider } from '../src/state/UserContext';
import { EventProvider } from '../src/state/EventContext';
import { LiveChatProvider } from '../src/state/LiveChatContext';

export default function RootLayout() {
  return (
    <UserProvider>
      <EventProvider>
        <LiveChatProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="event/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="checkout" options={{ presentation: 'modal' }} />
            <Stack.Screen name="receipt" options={{ presentation: 'modal' }} />
            <Stack.Screen name="room/[id]" options={{ presentation: 'modal' }} />
          </Stack>
        </LiveChatProvider>
      </EventProvider>
    </UserProvider>
  );
}