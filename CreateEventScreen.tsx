import React, { useState } from 'react';
import { 
  Text, 
  TextInput, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  ActivityIndicator 
} from 'react-native';
//  FIX: Jump back two levels out of screens/Dashboard folder to resolve core client modules cleanly
import { drexdelApiClient } from '../../services/api/client'
export default function CreateEventScreen({ navigation }: any) {
  // 1. Setting up state variables to catch field entries
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [price, setPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    // Basic structural validation checks
    if (!title || !description || !location || !price) {
      Alert.alert('Missing Parameters', 'Please fill out all data field matrices before deploying.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 🚀 REST ARCHITECTURE PIPELINE REFACTOR: Utilizing central resilient retry abstraction
      const response = await drexdelApiClient.post<any>('/v1/events', {
        title,
        description,
        date: new Date().toISOString(),
        location,
        ticketPrice: parseFloat(price) || 0.0,
      });

      if (response.success && response.status === 201) {
        Alert.alert('🎉 Success', 'Event saved permanently into your database tables!');
        navigation.goBack(); // Slides screen back to dashboard automatically
      } else {
        Alert.alert('❌ Error', response.message || 'Transaction write failed. Check server status logs.');
      }
    } catch (error) {
      console.error('[Create Event Screen] Form post deployment failure pipeline error details:', error);
      Alert.alert('🔌 Network Failure', 'Could not establish connection to the remote Drexdel host servers.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>HOST NEW EVENT</Text>
      <Text style={styles.subheading}>Publish a custom house party or cosplay gathering straight to the core database routing nodes.</Text>

      <Text style={styles.label}>Event Title</Text>
      <TextInput style={styles.input} placeholder="e.g., Underground Rave" placeholderTextColor="#999" value={title} onChangeText={setTitle} />

      <Text style={styles.label}>Description Details</Text>
      <TextInput style={[styles.input, styles.textArea]} multiline numberOfLines={4} placeholder="What is happening at this event?" placeholderTextColor="#999" value={description} onChangeText={setDescription} />

      <Text style={styles.label}>Location / Venue Address</Text>
      <TextInput style={styles.input} placeholder="e.g., Warehouse 4B or Room Corridor" placeholderTextColor="#999" value={location} onChangeText={setLocation} />

      <Text style={styles.label}>Ticket Entry Price ($)</Text>
      <TextInput style={styles.input} keyboardType="numeric" placeholder="0.00" placeholderTextColor="#999" value={price} onChangeText={setPrice} />

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>DEPLOY EVENT RECORD</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: '#FAFAFE', flexGrow: 1 },
  heading: { fontSize: 24, fontWeight: '900', color: '#7B2CBF', letterSpacing: 1, marginBottom: 6 },
  subheading: { fontSize: 13, color: '#666', marginBottom: 24, lineHeight: 18 },
  label: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 8 },
  input: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 12, fontSize: 16, color: '#000', marginBottom: 16 },
  textArea: { height: 100, textAlignVertical: 'top' },
  button: { backgroundColor: '#7B2CBF', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 12, shadowColor: '#7B2CBF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
});