import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { EventCategory } from '../../@types/events';

const { height } = Dimensions.get('window');

interface CategoryItem {
  id: EventCategory;
  label: string;
  icon: string;
  description: string;
}

const CATEGORY_DATA: CategoryItem[] = [
  { id: 'ai_conference', label: 'AI & Tech', icon: '🤖', description: 'Summits, coding hubs, and tech panels' },
  { id: 'cosplay', label: 'Cosplay & Gaming', icon: '🦊', description: 'Anime conventions, pop culture, and e-sports' },
  { id: 'party', label: 'Parties & Karaoke', icon: '🎤', description: 'House meetups, raves, and social nights' },
  { id: 'sports', label: 'Sports & Wellness', icon: '⚽', description: 'Tournaments, local matches, and gym classes' },
  { id: 'business_forum', label: 'Business Forums', icon: '💼', description: 'Networking events and market trade panels' },
  { id: 'workshop', label: 'Workshops', icon: '🛠️', description: 'Professional craft tutorials and art masterclasses' },
  { id: 'hotel_promotion', label: 'Hotel Promos', icon: '🏨', description: 'Exclusive dining offers and staycation events' },
  { id: 'charity', label: 'Charity Banquets', icon: '🕊️', description: 'Fundraisers, galas, and community volunteer drives' },
];

export const OnboardingScreen: React.FC = () => {
  const router = useRouter();
  const [selectedCategories, setSelectedCategories] = useState<EventCategory[]>([]);

  const handleCategoryPress = (categoryId: EventCategory) => {
    if (selectedCategories.includes(categoryId)) {
      setSelectedCategories(prev => prev.filter(id => id !== categoryId));
    } else {
      setSelectedCategories(prev => [...prev, categoryId]);
    }
  };

  const handleOnboardingComplete = () => {
    if (selectedCategories.length === 0) return;
    console.log('User Interests Saved:', selectedCategories);
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.masterContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.headerSection}>
          <Text style={styles.appName}>DREXDEL</Text>
          <Text style={styles.mainTitle}>What are you in the mood for?</Text>
          <Text style={styles.subtitle}>
            Select at least one interest to help our recommendation engine curate your personalized daily feed.
          </Text>
        </View>

        <View style={styles.gridContainer}>
          {CATEGORY_DATA.map((categoryItem) => { // ✅ 'categoryItem' is the parameter name
            const isSelected = selectedCategories.includes(categoryItem.id);
            return (
              <TouchableOpacity
                key={categoryItem.id}
                style={[styles.tileItem, isSelected && styles.tileItemActive]}
                onPress={() => handleCategoryPress(categoryItem.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.tileIcon}>{categoryItem.icon}</Text>
                <Text style={[styles.tileLabel, isSelected && styles.tileLabelActive]}>
                  {categoryItem.label}
                </Text>
                <Text style={styles.tileDescription} numberOfLines={2}>
                  {categoryItem.description}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footerBar}>
        <TouchableOpacity
          style={[styles.submitButton, selectedCategories.length === 0 && styles.submitButtonDisabled]}
          disabled={selectedCategories.length === 0}
          onPress={handleOnboardingComplete}
          activeOpacity={0.9}
        >
          <Text style={styles.submitButtonText}>
            {selectedCategories.length > 0 
              ? `Continue with ${selectedCategories.length} Interests →` 
              : 'Select Interests to Unlock Feed'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  masterContainer: {
    flex: 1,
    backgroundColor: '#FAFAFE',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  headerSection: {
    paddingTop: height * 0.08,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  appName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#7B2CBF',
    letterSpacing: 2,
    marginBottom: 8,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#121214',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6C757D',
    lineHeight: 20,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  tileItem: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  tileItemActive: {
    borderColor: '#7B2CBF',
    backgroundColor: '#F5ECFF',
    borderWidth: 2,
  },
  tileIcon: {
    fontSize: 28,
    marginBottom: 10,
  },
  tileLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 4,
  },
  tileLabelActive: {
    color: '#7B2CBF',
  },
  tileDescription: {
    fontSize: 11,
    color: '#6C757D',
    lineHeight: 14,
  },
  footerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: height * 0.04,
  },
  submitButton: {
    backgroundColor: '#7B2CBF',
    borderRadius: 12,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7B2CBF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#CED4DA',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});