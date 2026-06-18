import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions, 
  FlatList, 
  Platform 
} from 'react-native';

const { width } = Dimensions.get('window');

// Mock data tracking regional event locations near the user's active GPS coordinates
const RADAR_EVENTS_MOCK = [
  { id: 'ev_rad_01', title: 'Global AI Summit 2026', category: '🤖 TECH & AI', venue: 'Kigali Convention Centre', distance: 1.4 },
  { id: 'ev_rad_02', title: 'VVIP Backyard Karaoke Night', category: '🎤 PARTY', venue: 'David\'s Estate Garden', distance: 4.8 },
  { id: 'ev_rad_03', title: 'Chibi Cosplay Masters Arena', category: '🦊 COSPLAY', venue: 'BK Arena', distance: 8.2 },
  { id: 'ev_rad_04', title: 'Airtel FinTech Trade Forum', category: '💼 BUSINESS', venue: 'Marriott Ballroom', distance: 12.5 },
  { id: 'ev_rad_05', title: 'Charity Banquet & Gala', category: '🕊️ CHARITY', venue: 'Serena Hotel Garden', distance: 24.0 },
];

export const MapRadarScreen: React.FC = () => {
  
  // State tracking the active distance radius filter constraint in kilometers
  const [radialRadius, setRadialRadius] = useState<number>(15); 
  const [filteredRadarEvents, setFilteredRadarEvents] = useState(RADAR_EVENTS_MOCK);

  // Re-run spatial calculations whenever the user adjusts their radial boundary choice
  useEffect(() => {
    const matched = RADAR_EVENTS_MOCK.filter(event => event.distance <= radialRadius);
    setFilteredRadarEvents(matched);
  }, [radialRadius]);

  const renderRadarListItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.radarCardNode}
      onPress={() => console.log('Radar target focus item selected:', item.id)}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardCategoryText}>{item.category}</Text>
        <Text style={styles.cardDistanceValue}>📍 {item.distance.toFixed(1)} km</Text>
      </View>
      <Text style={styles.cardTitleText} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.cardVenueText}>At {item.venue}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.masterRadarContainer}>
      
      {/* 1. MAP VISUALIZATION ANCHOR PLACEHOLDER BOX */}
      <View style={styles.mapVisualMockCanvas}>
        <Text style={styles.mapRadarPingIcon}>🛰️</Text>
        <Text style={styles.mapCanvasPlaceholderText}>Live GPS Radar Tracking Canvas</Text>
        <Text style={styles.mapCanvasCoordinates}>Center Anchor: Nonko, Kigali, Rwanda</Text>
        
        {/* Visual Simulated Range Rings matching slider states */}
        <View style={[styles.radarPingRing, { width: radialRadius * 18, height: radialRadius * 18, maxWidth: width * 0.85, maxHeight: width * 0.85 }]} />
      </View>

      {/* 2. DYNAMIC RADIAL DISTANCE CONTROLLER BAR */}
      <View style={styles.radialSliderControlPanel}>
        <View style={styles.sliderLabelRow}>
          <Text style={styles.panelTitleText}>Radar Distance Sweep</Text>
          <Text style={styles.panelDistanceReadout}>{radialRadius} km radius</Text>
        </View>
        
        {/* Discrete Selection Step Nodes mimicking a physical fluid slider track interface */}
        <View style={styles.sliderTrackLineWrapper}>
          {[2, 5, 10, 15, 25, 50].map((kmValue) => {
            const isSelected = radialRadius === kmValue;
            return (
              <TouchableOpacity
                key={kmValue}
                style={[styles.sliderStepNode, isSelected && styles.sliderStepNodeActive]}
                onPress={() => setRadialRadius(kmValue)}
                activeOpacity={0.7}
              >
                <Text style={[styles.sliderStepNodeLabel, isSelected && styles.sliderStepNodeLabelActive]}>
                  {kmValue}k
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 3. SCROLLING MATRIX LIST OF EVENTS WITHIN ACTIVE BOUNDARIES */}
      <View style={styles.feedWrapperPanel}>
        <Text style={styles.resultsHeaderLabel}>
          Found {filteredRadarEvents.length} events matching your sweep area
        </Text>
        
        <FlatList
          data={filteredRadarEvents}
          keyExtractor={item => item.id}
          renderItem={renderRadarListItem}
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalListPaddingContent}
          ListEmptyComponent={
            <View style={styles.emptyRadarCard}>
              <Text style={styles.emptyCardText}>No active events discovered inside this boundary line.</Text>
              <Text style={styles.emptyCardSubText}>Tap a wider kilometer value on your radar control panel grid.</Text>
            </View>
          }
        />
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  masterRadarContainer: {
    flex: 1,
    backgroundColor: '#FAFAFE',
  },
  mapVisualMockCanvas: {
    flex: 1,
    backgroundColor: '#E5E9F0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  mapRadarPingIcon: {
    fontSize: 48,
    marginBottom: 12,
    zIndex: 3,
  },
  mapCanvasPlaceholderText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4C566A',
    zIndex: 3,
  },
  mapCanvasCoordinates: {
    fontSize: 11,
    color: '#7B88A1',
    fontWeight: '600',
    marginTop: 4,
    zIndex: 3,
  },
  radarPingRing: {
    position: 'absolute',
    borderRadius: 1000,
    borderWidth: 2,
    borderColor: '#9D4EDD',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(123, 44, 191, 0.03)',
    zIndex: 1,
  },
  radialSliderControlPanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 3,
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  panelTitleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#121214',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  panelDistanceReadout: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#7B2CBF',
  },
  sliderTrackLineWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  sliderStepNode: {
    width: 44,
    height: 32,
    backgroundColor: '#F1F3F5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  sliderStepNodeActive: {
    backgroundColor: '#7B2CBF',
    borderColor: '#7B2CBF',
  },
  sliderStepNodeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#495057',
  },
  sliderStepNodeLabelActive: {
    color: '#FFFFFF',
  },
  feedWrapperPanel: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
  },
  resultsHeaderLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#868E96',
    paddingHorizontal: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  horizontalListPaddingContent: {
    paddingHorizontal: 12,
  },
  radarCardNode: {
    backgroundColor: '#FAFAFE',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 14,
    width: width * 0.75,
    padding: 14,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.01,
    shadowRadius: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardCategoryText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#7B2CBF',
  },
  cardDistanceValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2A9D8F',
  },
  cardTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 4,
  },
  cardVenueText: {
    fontSize: 12,
    color: '#6C757D',
    fontWeight: '500',
  },
  emptyRadarCard: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    width: width - 32,
  },
  emptyCardText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#495057',
    textAlign: 'center',
  },
  emptyCardSubText: {
    fontSize: 11,
    color: '#868E96',
    marginTop: 4,
    textAlign: 'center',
  }
});
