import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Dimensions 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DrexdelEvent, EventCategory } from '../../@types/events';
import { EventCard } from '../../components/Discovery/EventCard';

const { } = Dimensions.get('window');

// 1. RAW EVENT DATA REPOSITORY (Mock database state reflecting various categories)
const COMPREHENSIVE_EVENTS_MOCK: DrexdelEvent[] = [
  {
    id: 'event_ai_01',
    organizerId: 'org_kcc_55',
    title: 'Global AI Summit & Neural Networks Panel 2026',
    description: 'The premier gathering of deep learning researchers and founders in East Africa.',
    category: 'ai_conference',
    location: { venueName: 'Kigali Convention Centre', address: 'KG 2 Roundabout', latitude: -1.9546, longitude: 30.0935 },
    isPrivate: false,
    imageUrl: 'https://unsplash.com',
    startTime: '2026-06-25T09:00:00Z',
    endTime: '2026-06-27T17:00:00Z',
    ticketTiers: [
      { id: 't1', name: 'Student Pass', price: 10, currency: 'USD', totalAllocation: 200, ticketsSold: 145, description: 'Valid ID required', isActive: true },
      { id: 't2', name: 'Corporate Delegate', price: 150, currency: 'USD', totalAllocation: 500, ticketsSold: 310, description: 'Full access + gala dinner', isActive: true }
    ],
    isOrganizerVerified: true,
    tags: ['ai', 'tech', 'networking', 'business']
  },
  {
    id: 'event_cos_02',
    organizerId: 'org_bka_12',
    title: 'Chibi Cosplay Masters & Pop Culture Convention',
    description: 'Anime showcases, gaming zones, and the ultimate local cosplay prize pool arena.',
    category: 'cosplay',
    location: { venueName: 'BK Arena', address: 'KG 17 Ave', latitude: -1.9515, longitude: 30.1132 },
    isPrivate: false,
    imageUrl: 'https://unsplash.com',
    startTime: '2026-07-04T12:00:00Z',
    endTime: '2026-07-04T22:00:00Z',
    ticketTiers: [
      { id: 't3', name: 'General Admission', price: 5000, currency: 'RWF', totalAllocation: 2000, ticketsSold: 890, description: 'Entry to all halls', isActive: true },
      { id: 't4', name: 'VIP Cosplayer Seat', price: 25000, currency: 'RWF', totalAllocation: 100, ticketsSold: 95, description: 'Front row + photo package', isActive: true }
    ],
    isOrganizerVerified: true,
    tags: ['anime', 'gaming', 'cosplay', 'fun']
  },
  {
    id: 'event_pty_03',
    organizerId: 'user_david_99',
    title: 'VVIP Backyard Karaoke & Grill Night',
    description: 'An intimate neighborhood social gathering with acoustic sessions and open mic layouts.',
    category: 'party',
    location: { venueName: 'David\'s Estate Garden', address: 'Nyarutarama Close 4', latitude: -1.9392, longitude: 30.0981 },
    isPrivate: true, // User-generated micro event
    imageUrl: 'https://unsplash.com',
    startTime: '2026-06-20T19:00:00Z',
    endTime: '2026-06-21T02:00:00Z',
    ticketTiers: [
      { id: 't5', name: 'Host Support Pass', price: 5, currency: 'USD', totalAllocation: 40, ticketsSold: 22, description: 'Covers drinks and barbecue wings', isActive: true }
    ],
    isOrganizerVerified: false,
    tags: ['party', 'music', 'karaoke', 'social']
  },
  { id: 'event_ch_04', organizerId: 'org_red_cross', title: 'Annual Charity Banquet Gala', description: 'Fundraising dinner.', category: 'charity', location: { venueName: 'Marriott Ballroom', address: 'KN 3 Rd', latitude: -1.9467, longitude: 30.0594 }, isPrivate: false, imageUrl: 'https://unsplash.com', startTime: '2026-06-30T18:00:00Z', endTime: '2026-06-30T23:00:00Z', ticketTiers: [{ id: 't6', name: 'Open Guest Pass', price: 0, currency: 'USD', totalAllocation: 300, ticketsSold: 120, description: 'Free entry', isActive: true }], isOrganizerVerified: true, tags: ['charity', 'gala', 'community'] }
];

// Defining structures for category buttons
interface QuickFilterTab {
  id: EventCategory | 'all';
  label: string;
  icon: string;
}

const FILTER_TABS: QuickFilterTab[] = [
  { id: 'all', label: 'All Events', icon: '🌎' },
  { id: 'ai_conference', label: 'Tech & AI', icon: '🤖' },
  { id: 'cosplay', label: 'Cosplay', icon: '🦊' },
  { id: 'party', label: 'Parties', icon: '🎤' },
  { id: 'charity', label: 'Charity', icon: '🕊️' }
];

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<EventCategory | 'all'>('all');
  const [orderedEvents, setOrderedEvents] = useState<DrexdelEvent[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // MOCK USER ONBOARDING PREFERENCES (Simulating that this user chose Tech and Parties when signing up)
  const USER_INTEREST_PREFERENCES: EventCategory[] = ['ai_conference', 'party'];

  useEffect(() => {
    runRecommendationSortingEngine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, searchQuery]);

  // --- THE DREXDEL RECOMMENDATION ALGORITHM ---
  const runRecommendationSortingEngine = () => {
    // Phase 1: Filter out events based on search inputs and tab selections
    let result = COMPREHENSIVE_EVENTS_MOCK.filter(event => {
      const matchesTab = activeTab === 'all' || event.category === activeTab;
      const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            event.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesTab && matchesSearch;
    });

    // Phase 2: Sort based on user preference weights
    result.sort((a, b) => {
      const aIsPreferred = USER_INTEREST_PREFERENCES.includes(a.category);
      const bIsPreferred = USER_INTEREST_PREFERENCES.includes(b.category);

      if (aIsPreferred && !bIsPreferred) return -1; // Push preferred compound a up the layout stack
      if (!aIsPreferred && bIsPreferred) return 1;  // Push preferred compound b up the layout stack
      return 0; // Maintain original chronological timestamp sorting order if weights match
    });

    setOrderedEvents(result);
  };

  const handleRefreshFeed = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  return (
    <View style={styles.masterFeedContainer}>
      
      {/* Search Header Container node */}
      <View style={styles.headerStickyTop}>
        <TextInput
          style={styles.searchField}
          placeholder="Search AI summits, parties, cosplay..."
          placeholderTextColor="#ADB5BD"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
        />
      </View>

      {/* Main layout loop orchestrator */}
      <FlatList
        data={orderedEvents}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <EventCard
            title={item.title}
            category={item.category.replace('_', ' ')}
            imageUri={item.imageUrl}
            distanceKm={2.3} // In the future, parsed background via locationService.ts math
            priceTiers={item.ticketTiers}
            isOrganizerVerified={item.isOrganizerVerified}
            onPress={() => navigation.navigate('EventDetails', { eventId: item.id, eventData: item })}
          />
        )}
        refreshing={isRefreshing}
        onRefresh={handleRefreshFeed}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainerContent}
        
        // Horizontal Categories layout slider injected cleanly as a Header node to save layout weight
        ListHeaderComponent={
          <View style={styles.horizontalSliderWrapper}>
            <Text style={styles.sliderHeading}>Explore Categories</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sliderScroll}>
              {FILTER_TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[styles.tabButton, isActive && styles.tabButtonActive]}
                    onPress={() => setActiveTab(tab.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.tabIcon}>{tab.icon}</Text>
                    <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text style={styles.recommenderAlertLabel}>✨ Curated based on your interests</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyFeedBox}>
            <Text style={styles.emptyTitle}>No events matching around you.</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your filter category choices or widening your search query parameters.</Text>
          </View>
        }
        ListFooterComponent={
          <TouchableOpacity
            style={styles.hostEventButton}
            onPress={() => navigation.navigate('CreateEvent')}
            activeOpacity={0.85}
          >
            <Text style={styles.hostEventButtonText}>➕ HOST NEW EVENT</Text>
          </TouchableOpacity>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  masterFeedContainer: {
    flex: 1,
    backgroundColor: '#FAFAFE',
  },
  headerStickyTop: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  searchField: {
    backgroundColor: '#F1F3F5',
    borderRadius: 12,
    height: 46,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#212529',
  },
  listContainerContent: {
    paddingBottom: 40,
  },
  horizontalSliderWrapper: {
    paddingVertical: 16,
    backgroundColor: '#FAFAFE',
  },
  sliderHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#121214',
    paddingHorizontal: 16,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  sliderScroll: {
    paddingHorizontal: 16,
  },
  tabButton: {
    marginRight: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#7B2CBF',
    borderColor: '#7B2CBF',
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 13,
    color: '#495057',
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },
  recommenderAlertLabel: {
    marginTop: 10,
    color: '#495057',
    marginLeft: 16,
  },
  hostEventButton: {
    backgroundColor: '#7B2CBF',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 32,
    alignItems: 'center',
    shadowColor: '#7B2CBF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  hostEventButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  feedWrapperPanel: {
    paddingHorizontal: 16,
  },
  emptyFeedBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#121214',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6C757D',
    textAlign: 'center',
  },
});
