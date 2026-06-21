import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  Dimensions, 
  Alert,
  Platform
} from 'react-native';
import { DrexdelEvent, TicketTier } from '../../@types/events';
import { useLocalSearchParams, useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');

export const EventDetailsScreen: React.FC = () => {
  const params = useLocalSearchParams();
  const router = useRouter();
  
  // Extracting parameters passed down from the HomeScreen item selection tap
  const eventData: DrexdelEvent | null = params?.eventData ? JSON.parse(params.eventData as string) : null;

  // Local state to track which ticket tier option the user has selected
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);

  // Fallback protective validation layer in case route data is corrupted or dropped
  if (!eventData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTextText}>⚠️ Event details failed to load.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Return to Feed</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Formatting Iso timestamps into beautiful human-readable date layouts
  const formatEventDate = (isoString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    };
    return new Date(isoString).toLocaleDateString('en-US', options);
  };

  // Handles moving to the secure payment checkout rails
  const handlePurchaseTrigger = () => {
    if (!selectedTierId) {
      Alert.alert('Selection Required', 'Please choose a ticket tier or pass category to proceed.', [{ text: 'OK' }]);
      return;
    }

    const activeTier = eventData.ticketTiers.find(t => t.id === selectedTierId);
    if (!activeTier) return;

    // Directing metadata parameters straight down to checkout stack paths
    router.push({
      pathname: '/checkout',
      params: {
        eventId: eventData.id,
        eventTitle: eventData.title,
        selectedTierId: selectedTierId,
        selectedTierName: activeTier?.name || 'Ticket',
        selectedTierPrice: String(activeTier?.price || 0),
        currency: activeTier?.currency || 'USD',
        ticketQuantity: '1'
      }
    });
  };

  return (
    <View style={styles.masterDetailLayoutContainer}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPaddingBottom}>
        
        {/* Upper Promotional Image Media Canopy banner */}
        <Image source={{ uri: eventData.imageUrl }} style={styles.bannerCanopyImage} />
        
        {/* Floating Quick Action Back Button */}
        <TouchableOpacity style={styles.floatingCloseNode} onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.closeIconText}>←</Text>
        </TouchableOpacity>

        {/* Core Info Block Wrapper */}
        <View style={styles.contentCoreBody}>
          <View style={styles.categoryBadgeRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{eventData.category.replace('_', ' ').toUpperCase()}</Text>
            </View>
            {eventData.isOrganizerVerified && <Text style={styles.verifiedHostTag}>✓ Verified Organiser</Text>}
          </View>

          {/* Event Main Title Heading */}
          <Text style={styles.mainTitleHeading}>{eventData.title}</Text>

          {/* Time & Date Operational Row */}
          <View style={styles.metaRowItem}>
            <Text style={styles.metaRowIcon}>📅</Text>
            <View style={styles.metaRowTextColumn}>
              <Text style={styles.metaRowMainText}>{formatEventDate(eventData.startTime)}</Text>
              <Text style={styles.metaRowSubText}>Doors close at {new Date(eventData.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
            </View>
          </View>

          {/* GPS Location Physical Tracking Row */}
          <View style={styles.metaRowItem}>
            <Text style={styles.metaRowIcon}>📍</Text>
            <View style={styles.metaRowTextColumn}>
              <Text style={styles.metaRowMainText}>{eventData.location.venueName}</Text>
              <Text style={styles.metaRowSubText}>{eventData.location.address}</Text>
            </View>
          </View>

          {/* Deep Content Text Description Paragraph */}
          <Text style={styles.sectionDividerLabel}>About This Experience</Text>
          <Text style={styles.bodyDescriptionText}>{eventData.description}</Text>

          {/* MULTI-TIER TICKETING ACCESS OPTION CHANNELS */}
          <Text style={styles.sectionDividerLabel}>Select Access Tier</Text>
          
          {eventData.ticketTiers.map((tier: TicketTier) => {
            const isTierSelected = selectedTierId === tier.id;
            const isFree = tier.price === 0;

            return (
              <TouchableOpacity
                key={tier.id}
                style={[styles.tierOptionCard, isTierSelected && styles.tierOptionCardActive]}
                onPress={() => setSelectedTierId(tier.id)}
                activeOpacity={0.85}
              >
                <View style={styles.tierHeaderRow}>
                  <Text style={[styles.tierTitleLabel, isTierSelected && styles.tierTitleLabelActive]}>
                    {tier.name}
                  </Text>
                  <Text style={styles.tierPriceText}>
                    {isFree ? 'FREE' : `$${tier.price}`}
                  </Text>
                </View>
                
                <Text style={styles.tierDescriptionText}>{tier.description}</Text>
                
                <View style={styles.tierFooterCapacityRow}>
                  <Text style={styles.capacityCounterText}>
                    {tier.totalAllocation - tier.ticketsSold} tickets remaining
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Persistent Static Check-Out Checkout Action Footer bar element */}
      <View style={styles.actionFooterStickyBar}>
        <TouchableOpacity style={styles.checkoutActionSubmitButton} onPress={handlePurchaseTrigger} activeOpacity={0.9}>
          <Text style={styles.submitActionLabelText}>
            {selectedTierId ? 'Proceed to Secure Checkout →' : 'Select a Pass to Secure Entry'}
          </Text>
        </TouchableOpacity>
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  masterDetailLayoutContainer: {
    flex: 1,
    backgroundColor: '#FAFAFE',
  },
  scrollPaddingBottom: {
    paddingBottom: 110,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  errorTextText: {
    color: '#6C757D',
    fontSize: 15,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 14,
    backgroundColor: '#7B2CBF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bannerCanopyImage: {
    width: width,
    height: height * 0.32,
    backgroundColor: '#E1E4E8',
  },
  floatingCloseNode: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 24,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeIconText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: -2,
  },
  contentCoreBody: {
    padding: 20,
    marginTop: -16,
    backgroundColor: '#FAFAFE',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  categoryBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: '#F5ECFF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  categoryText: {
    color: '#7B2CBF',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  verifiedHostTag: {
    color: '#2A9D8F',
    fontSize: 12,
    fontWeight: 'bold',
  },
  mainTitleHeading: {
    fontSize: 22,
    fontWeight: '900',
    color: '#121214',
    lineHeight: 28,
    marginBottom: 20,
  },
  metaRowItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    width: '100%',
  },
  metaRowIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  metaRowTextColumn: {
    flex: 1,
  },
  metaRowMainText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#212529',
  },
  metaRowSubText: {
    fontSize: 12,
    color: '#6C757D',
    marginTop: 2,
    lineHeight: 16,
  },
  sectionDividerLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#121214',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 12,
  },
  bodyDescriptionText: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 22,
  },
  tierOptionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.01,
    shadowRadius: 4,
  },
  tierOptionCardActive: {
    borderColor: '#7B2CBF',
    backgroundColor: '#F5ECFF',
    borderWidth: 2,
  },
  tierHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  tierTitleLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#212529',
  },
  tierTitleLabelActive: {
    color: '#7B2CBF',
  },
  tierPriceText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#212529',
  },
  tierDescriptionText: {
    fontSize: 12,
    color: '#6C757D',
  },
  tierFooterCapacityRow: {
    marginTop: 8,
  },
  capacityCounterText: {
    fontSize: 12,
    color: '#6C757D',
  },
  actionFooterStickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  checkoutActionSubmitButton: {
    backgroundColor: '#7B2CBF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitActionLabelText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});