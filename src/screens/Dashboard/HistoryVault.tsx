import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

// Structuring the data keys for an attended history event node
interface AttendedEventNode {
  id: string;
  title: string;
  category: string;
  dateAttended: string;
  venueName: string;
  ticketTierName: string; // e.g., "VIP", "Regular", "Free Pass"
  isGpsVerified: boolean; // True if they physically crossed the venue geofence
  iconBadge: string;
}

const MOCK_HISTORY_DATA: AttendedEventNode[] = [
  {
    id: 'hist_01',
    title: 'Kigali Tech Expo 2026',
    category: 'BUSINESS FORUM',
    dateAttended: 'May 24, 2026',
    venueName: 'Kigali Convention Centre',
    ticketTierName: 'Regular Pass',
    isGpsVerified: true,
    iconBadge: '💼',
  },
  {
    id: 'hist_02',
    title: 'Rave & Rhythm House Party',
    category: 'PARTY',
    dateAttended: 'April 12, 2026',
    venueName: 'David\'s Backyard Backyard',
    ticketTierName: 'Free Entry',
    isGpsVerified: true,
    iconBadge: '🎤',
  },
  {
    id: 'hist_03',
    title: 'Chibi Cosplay Masters',
    category: 'COSPLAY',
    dateAttended: 'February 08, 2026',
    venueName: 'BK Arena',
    ticketTierName: 'VIP Access',
    isGpsVerified: false, // Bought ticket but did not pass gate GPS scanner
    iconBadge: '🦊',
  },
];

export const HistoryVault: React.FC = () => {
  const [attendedHistory] = useState<AttendedEventNode[]>(MOCK_HISTORY_DATA);

  const renderHistoryItem = ({ item, index }: { item: AttendedEventNode; index: number }) => {
    return (
      <View style={styles.timelineRow}>
        {/* Left Side: Dynamic Timeline Pillar Line and Dot nodes */}
        <View style={styles.timelineLeftPillar}>
          <View style={[styles.timelineDot, item.isGpsVerified ? styles.dotActive : styles.dotInactive]} />
          {index !== attendedHistory.length - 1 && <View style={styles.timelineVerticalLine} />}
        </View>

        {/* Right Side: Card Content block node */}
        <TouchableOpacity style={styles.vaultCard} activeOpacity={0.8}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{item.category}</Text>
            </View>
            <Text style={styles.nodeDateText}>{item.dateAttended}</Text>
          </View>

          <Text style={styles.eventTitleText} numberOfLines={1}>{item.title}</Text>
          
          <Text style={styles.venueLocationText}>📍 {item.venueName}</Text>

          {/* Bottom row displaying Tier verification states */}
          <View style={styles.cardFooterRow}>
            <Text style={styles.tierNameLabel}>Access: <Text style={styles.tierNameValue}>{item.ticketTierName}</Text></Text>
            
            {/* Dynamic Geofenced Verification Tag */}
            {item.isGpsVerified ? (
              <View style={styles.verifiedBadgeBox}>
                <Text style={styles.verifiedBadgeText}>✓ Attended</Text>
              </View>
            ) : (
              <View style={styles.unverifiedBadgeBox}>
                <Text style={styles.unverifiedBadgeText}>🎟️ Unclaimed</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.masterVaultContainer}>
      {/* Vault Summary Banner layout block */}
      <View style={styles.summaryBanner}>
        <Text style={styles.bannerCounterTitle}>{attendedHistory.length}</Text>
        <Text style={styles.bannerCounterLabel}>Memories Captured in the Vault</Text>
        <Text style={styles.bannerSubtitle}>Your secure historical timeline of bonding experiences and summits [2].</Text>
      </View>

      {/* Vertical Timeline scrolling engine list node */}
      <FlatList
        data={attendedHistory}
        keyExtractor={item => item.id}
        renderItem={renderHistoryItem}
        contentContainerStyle={styles.listContainerPadding}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  masterVaultContainer: {
    flex: 1,
    backgroundColor: '#FAFAFE',
  },
  summaryBanner: {
    backgroundColor: '#7B2CBF', // Drexdel Signature Purple
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  bannerCounterTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  bannerCounterLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E0AAFF',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#F5ECFF',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
    maxWidth: width * 0.8,
  },
  listContainerPadding: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  timelineRow: {
    flexDirection: 'row',
    width: '100%',
  },
  timelineLeftPillar: {
    width: 30,
    alignItems: 'center',
    position: 'relative',
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#CED4DA',
    zIndex: 2,
    marginTop: 18,
    borderWidth: 2,
    borderColor: '#FAFAFE',
  },
  dotActive: {
    backgroundColor: '#2A9D8F', // Rich green for successful GPS verification
    shadowColor: '#2A9D8F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  dotInactive: {
    backgroundColor: '#E63946', // Red state for skipped gate scanners
  },
  timelineVerticalLine: {
    position: 'absolute',
    top: 32,
    bottom: -16,
    width: 2,
    backgroundColor: '#E9ECEF',
    zIndex: 1,
  },
  vaultCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: '#F5ECFF',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#7B2CBF',
  },
  nodeDateText: {
    fontSize: 11,
    color: '#ADB5BD',
    fontWeight: '600',
  },
  eventTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 4,
  },
  venueLocationText: {
    fontSize: 12,
    color: '#6C757D',
    fontWeight: '500',
    marginBottom: 12,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F8F9FA',
    paddingTop: 10,
  },
  tierNameLabel: {
    fontSize: 12,
    color: '#868E96',
  },
  tierNameValue: {
    fontWeight: '700',
    color: '#495057',
  },
  verifiedBadgeBox: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    color: '#2E7D32',
    fontSize: 11,
    fontWeight: 'bold',
  },
  unverifiedBadgeBox: {
    backgroundColor: '#FFF3E0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  unverifiedBadgeText: {
    color: '#E65100',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
