import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';

export const TicketReceiptScreen: React.FC = () => {
  const route = useRoute<any>();
  const { ticketId, eventTitle, tierName, amount, currency } = route.params || {};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ticket Receipt</Text>
      <Text style={styles.line}>Ticket ID: {ticketId}</Text>
      <Text style={styles.line}>Event: {eventTitle}</Text>
      <Text style={styles.line}>Tier: {tierName}</Text>
      <Text style={styles.line}>Amount: {amount} {currency}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  line: { fontSize: 14, color: '#495057', marginBottom: 6 },
});
