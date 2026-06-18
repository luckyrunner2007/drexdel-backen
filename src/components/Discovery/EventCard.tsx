/**
 * PROJECT DREXDEL - REUSABLE ALGOUITHMIC EVENT CARD COMPONENT
 * FILE: src/components/Discovery/EventCard.tsx
 */

import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';

// Defining exactly what data the Event Card contract needs to receive
interface EventCardProps {
  title: string;
  category: string;
  imageUri: string;
  distanceKm: number; // Dynamic calculation derived via locationService.ts
  priceTiers: { name: string; price: number | string }[];
  isOrganizerVerified: boolean;
  onPress: () => void;
}

export const EventCard: React.FC<EventCardProps> = ({
  title,
  category,
  imageUri,
  distanceKm,
  priceTiers,
  isOrganizerVerified,
  onPress,
}) => {
  
  // Logic to parse pricing arrays and find the lowest price to display as "Starting From"
  const numericPrices = priceTiers
    .map(tier => typeof tier.price === 'number' ? tier.price : parseFloat(tier.price as string))
    .filter(price => !isNaN(price) && price > 0);
  
  // Automatically detects free passes (like Charity Banquets or Open House Parties)
  const startingPrice = numericPrices.length > 0 
    ? `From $${Math.min(...numericPrices)}` 
    : 'Free Entry';

  return (
    <TouchableOpacity style={styles.cardContainer} onPress={onPress} activeOpacity={0.95}>
      {/* Event Cover Image Canopy */}
      <Image source={{ uri: imageUri }} style={styles.eventImage} />

      {/* Floating Category Tag Badge */}
      <View style={styles.categoryBadge}>
        <Text style={styles.categoryText}>{category.toUpperCase()}</Text>
      </View>

      {/* Primary Context Container */}
      <View style={styles.infoContainer}>
        <View style={styles.metaRow}>
          {/* Real-time GPS Geolocation distance display readout */}
          <Text style={styles.distanceText}>📍 {distanceKm.toFixed(1)} km away</Text>
          {isOrganizerVerified && <Text style={styles.verifiedBadge}>✓ Verified Host</Text>}
        </View>

        {/* Main Event Title Heading */}
        <Text style={styles.eventTitle} numberOfLines={2}>{title}</Text>

        {/* Pricing Tiers & Navigation Access Bar Footer */}
        <View style={styles.footerRow}>
          <Text style={styles.priceText}>{startingPrice}</Text>
          <Text style={styles.viewDetailsText}>View Tiers →</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginVertical: 10,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  eventImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#E1E4E8',
  },
  categoryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#7B2CBF', // Drexdel Identity Purple Tint
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  infoContainer: {
    padding: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  distanceText: {
    color: '#6C757D',
    fontSize: 12,
    fontWeight: '600',
  },
  verifiedBadge: {
    color: '#2A9D8F', // Balanced status green tint
    fontSize: 11,
    fontWeight: 'bold',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 12,
    lineHeight: 22,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F8F9FA',
    paddingTop: 10,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#212529',
  },
  viewDetailsText: {
    fontSize: 12,
    color: '#7B2CBF',
    fontWeight: '700',
  },
});
