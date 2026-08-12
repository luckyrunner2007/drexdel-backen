import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export const TicketReceiptScreen: React.FC = () => {
  const params = useLocalSearchParams();
  const value = (name: string) => typeof params[name] === 'string' ? params[name] : '—';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ticket Receipt</Text>
      <Text style={styles.line}>Ticket ID: {value('ticketId')}</Text>
      <Text style={styles.line}>Event: {value('eventTitle')}</Text>
      <Text style={styles.line}>Tier: {value('tierName')}</Text>
      <Text style={styles.line}>Amount: {value('amount')} {value('currency')}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  line: { fontSize: 14, color: '#495057', marginBottom: 6 },
});
