import { useLocalSearchParams } from 'expo-router';
import { EventDetailsScreen } from '../../src/screens/Discovery/EventDetailsScreen';

export default function EventPage() {
  const { id } = useLocalSearchParams();
  
  // Mock event data - in real app, fetch by id
  const mockEvent = {
    id: id as string,
    title: 'Event Title',
    // ... other fields
  };

  return <EventDetailsScreen />;
}