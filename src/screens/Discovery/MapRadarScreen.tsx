import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, FlatList, ActivityIndicator } from 'react-native';
import { locationService, GpsCoordinates } from '../../services/native/locationService';
import { calculateDistanceKm } from '../../utils/locationMath';
import { presenceApi, LiveEvent, PresenceVisibility } from '../../services/api/presenceApi';

const { width } = Dimensions.get('window');

const RADIUS_STEPS = [2, 5, 10, 15, 25, 50];
const PRIVACY_OPTIONS: { key: PresenceVisibility; label: string }[] = [
  { key: 'PUBLIC', label: 'Public' },
  { key: 'FRIENDS_ONLY', label: 'Friends' },
  { key: 'HIDDEN', label: 'Hidden' },
];

export interface RadarEvent extends LiveEvent {
  distanceKm: number | null;
}

/**
 * Compute the real haversine distance (km) from the device GPS anchor to an
 * event. Prefers the venue's own coordinates, falling back to the first
 * friend who is sharing live GPS at that event. Returns null when neither is
 * available so the card can be hidden rather than mislabelled.
 */
function computeEventDistance(ev: LiveEvent, anchor: GpsCoordinates | null): number | null {
  if (!anchor) return null;
  const lat = ev.latitude ?? ev.members[0]?.lat ?? null;
  const lng = ev.longitude ?? ev.members[0]?.lng ?? null;
  if (lat == null || lng == null) return null;
  return calculateDistanceKm(anchor.latitude, anchor.longitude, lat, lng);
}

export const MapRadarScreen: React.FC = () => {
  const [radialRadius, setRadialRadius] = useState<number>(15);
  const [anchor, setAnchor] = useState<GpsCoordinates | null>(null);
  const [liveEvents, setLiveEvents] = useState<RadarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibility, setVisibility] = useState<PresenceVisibility>('FRIENDS_ONLY');
  const [checkInStates, setCheckInStates] = useState<Record<string, boolean>>({});

  // Load the real GPS anchor + live events where friends are present.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let coords: GpsCoordinates | null = null;
      try {
        coords = await locationService.getCurrentLocation();
        if (!cancelled) setAnchor(coords);
      } catch {
        coords = null;
      }
      try {
        const res = await presenceApi.fetchLiveEvents();
        if (!cancelled && res.success && res.data) {
          setLiveEvents(res.data.events.map((ev) => ({ ...ev, distanceKm: computeEventDistance(ev, coords) })));
        }
      } catch {
        // network failure -> keep empty radar
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Load the caller's presence privacy setting.
  useEffect(() => {
    presenceApi
      .getVisibility()
      .then((res) => { if (res.success && res.data) setVisibility(res.data.visibility); })
      .catch(() => {});
  }, []);

  const filteredEvents = liveEvents.filter((ev) => ev.distanceKm != null && ev.distanceKm <= radialRadius);

  const handleVisibilityChange = useCallback(async (v: PresenceVisibility) => {
    setVisibility(v); // optimistic update
    const res = await presenceApi.updateVisibility(v);
    if (res.success && res.data) setVisibility(res.data.visibility);
  }, []);

  const handleCheckIn = useCallback(
    async (eventId: string) => {
      if (!anchor) return;
      const res = await presenceApi.heartbeat(eventId, anchor.latitude, anchor.longitude);
      setCheckInStates((prev) => ({ ...prev, [eventId]: !!res.success }));
    },
    [anchor],
  );
const renderRadarListItem = ({ item }: { item: RadarEvent }) => {
    const friendNames = item.members.map((m) => m.name).join(', ');
    return (
      <TouchableOpacity style={styles.radarCardNode} activeOpacity={0.8}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardCategoryText}>📍 {item.location}</Text>
          <Text style={styles.cardDistanceValue}>
            {item.distanceKm != null ? `${item.distanceKm.toFixed(1)} km` : 'GPS pending'}
          </Text>
        </View>
        <Text style={styles.cardTitleText} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardVenueText} numberOfLines={1}>
          {friendNames ? `${friendNames} ${item.members.length === 1 ? 'is' : 'are'} here now` : 'At ' + item.location}
        </Text>
        {item.members.length > 0 && (
          <View style={styles.friendChipsRow}>
            {item.members.map((m) => (
              <View key={m.id} style={styles.friendChip}>
                <Text style={styles.friendChipText}>{m.name}</Text>
              </View>
            ))}
          </View>
        )}
        <TouchableOpacity
          style={[styles.checkInButton, checkInStates[item.id] && styles.checkInButtonDone]}
          onPress={() => handleCheckIn(item.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.checkInButtonText}>
            {checkInStates[item.id] ? '✓ Checked in' : 'Check in here'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.masterRadarContainer}>
      {/* GPS anchor status */}
      <View style={styles.anchorRow}>
        <Text style={styles.anchorLabel}>My GPS anchor</Text>
        <Text style={styles.anchorValue} numberOfLines={1}>
          {anchor ? `${anchor.latitude.toFixed(4)}, ${anchor.longitude.toFixed(4)}` : 'Locating...'}
        </Text>
      </View>

      {/* Radar distance sweep controller */}
      <View style={styles.radialSliderControlPanel}>
        <View style={styles.sliderLabelRow}>
          <Text style={styles.panelTitleText}>Radar Distance Sweep</Text>
          <Text style={styles.panelDistanceReadout}>{radialRadius} km radius</Text>
        </View>
        <View style={styles.sliderTrackLineWrapper}>
          {RADIUS_STEPS.map((kmValue) => {
            const isSelected = radialRadius === kmValue;
            return (
              <TouchableOpacity
                key={kmValue}
                style={[styles.sliderStepNode, isSelected && styles.sliderStepNodeActive]}
                onPress={() => setRadialRadius(kmValue)}
                activeOpacity={0.8}
              >
                <Text style={[styles.sliderStepNodeLabel, isSelected && styles.sliderStepNodeLabelActive]}>
                  {kmValue}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      {/* Presence privacy control */}
      <View style={styles.privacyPanel}>
        <Text style={styles.panelTitleText}>Who can see where I am</Text>
        <View style={styles.privacyOptionsRow}>
          {PRIVACY_OPTIONS.map((opt) => {
            const isActive = visibility === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                testID={`privacy-${opt.key}`}
                style={[styles.privacyOption, isActive && styles.privacyOptionActive]}
                onPress={() => handleVisibilityChange(opt.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.privacyOptionText, isActive && styles.privacyOptionTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Live friend radar feed */}
      <Text style={styles.resultsHeaderLabel}>
        Friends nearby ({filteredEvents.length})
      </Text>
      <FlatList
        data={filteredEvents}
        keyExtractor={(item) => item.id}
        renderItem={renderRadarListItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalListPaddingContent}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyRadarCard}>
              <ActivityIndicator size="large" color="#7B2CBF" />
              <Text style={styles.emptyCardText}>Scanning the area...</Text>
            </View>
          ) : (
            <View style={styles.emptyRadarCard}>
              <Text style={styles.emptyCardText}>No friends nearby right now.</Text>
              <Text style={styles.emptyCardSubText}>
                When a friend checks in inside your radius they will appear here.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
};
const styles = StyleSheet.create({
  masterRadarContainer: {
    flex: 1,
    backgroundColor: '#FAFAFE',
    paddingTop: 12,
  },
  anchorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  anchorLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#868E96',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  anchorValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7B2CBF',
    flexShrink: 1,
    marginLeft: 8,
  },
  radialSliderControlPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 2,
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
  privacyPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  privacyOptionsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  privacyOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F3F5',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    alignItems: 'center',
  },
  privacyOptionActive: {
    backgroundColor: '#7B2CBF',
    borderColor: '#7B2CBF',
  },
  privacyOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#495057',
  },
  privacyOptionTextActive: {
    color: '#FFFFFF',
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
    paddingBottom: 16,
  },
  radarCardNode: {
    backgroundColor: '#FFFFFF',
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
    flexShrink: 1,
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
    marginBottom: 8,
  },
  friendChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  friendChip: {
    backgroundColor: '#F1E7FA',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  friendChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7B2CBF',
  },
  checkInButton: {
    backgroundColor: '#7B2CBF',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  checkInButtonDone: {
    backgroundColor: '#2A9D8F',
  },
  checkInButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
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
  },
});
