import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  Platform
} from 'react-native';
import { OrganizerAnalytics } from '../../@types/events';

// Mock data representing a verified promoter account's live analytics matrix
const MOCK_ANALYTICS: OrganizerAnalytics = {
  organizerId: 'org_kcc_55',
  totalRevenueAllTime: 42750,
  currency: 'USD',
  totalTicketsSoldAllTime: 1240,
  profileViews: 18450,
  activeStaffAccessCodes: [
    { code: 'GATE_6521', staffName: 'John (Main Gate)', expiryDate: '2026-06-15T02:00:00Z' },
    { code: 'VIP_9812', staffName: 'Sarah (Backstage)', expiryDate: '2026-06-15T04:00:00Z' }
  ]
};

// Mock data tracking social and analytical metrics across their events
const MOCK_EVENT_POSTS = [
  { id: 'p_1', title: 'Global AI Summit 2026', status: 'Future', views: 8900, likes: 1200, comments: 340 },
  { id: 'p_2', title: 'VVIP Backyard Karaoke', status: 'Future', views: 4200, likes: 620, comments: 195 },
  { id: 'p_3', title: 'Charity Gala Banquet 2025', status: 'Past', views: 12400, likes: 3100, comments: 512 }
];

export const OrganiserHub: React.FC = () => {
  const [analytics, setAnalytics] = useState<OrganizerAnalytics>(MOCK_ANALYTICS);
  const [eventPosts] = useState(MOCK_EVENT_POSTS);

  // Generates a random 4-digit temporary "Gate Keeper Code" for a new bouncer
  const handleGenerateStaffCode = () => {
    const randomCode = `GATE_${Math.floor(1000 + Math.random() * 9000)}`;
    const newStaffMember = {
      code: randomCode,
      staffName: `Staff Node (${analytics.activeStaffAccessCodes.length + 1})`,
      expiryDate: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() // Valid for exactly 8 hours
    };

    setAnalytics(prev => ({
      ...prev,
      activeStaffAccessCodes: [newStaffMember, ...prev.activeStaffAccessCodes]
    }));

    Alert.alert(
      'Gate Keeper Code Created',
      `Give code [ ${randomCode} ] to your gate staff worker. This allows them to securely scan entries while keeping your revenue figures hidden.`,
      [{ text: 'OK' }]
    );
  };

  return (
    <ScrollView style={styles.dashboardContainer} showsVerticalScrollIndicator={false}>
      
      {/* 1. FINANCIAL & HIGH-LEVEL STATS ROW */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Financial Command Center</Text>
      </View>
      
      <View style={styles.statsGrid}>
        <View style={styles.statCardFull}>
          <Text style={styles.statLabel}>Total Gross Revenue</Text>
          <Text style={styles.revenueValue}>${analytics.totalRevenueAllTime.toLocaleString()}</Text>
          <Text style={styles.statSubText}>Payouts processed via secure escrow rails</Text>
        </View>

        <View style={styles.statCardHalf}>
          <Text style={styles.statLabel}>Tickets Sold</Text>
          <Text style={styles.statValue}>{analytics.totalTicketsSoldAllTime}</Text>
          <Text style={styles.statSubText}>Units across all tiers</Text>
        </View>

        <View style={styles.statCardHalf}>
          <Text style={styles.statLabel}>Profile Impressions</Text>
          <Text style={styles.statValue}>{(analytics.profileViews / 1000).toFixed(1)}k</Text>
          <Text style={styles.statSubText}>Organic traffic views</Text>
        </View>
      </View>

      {/* 2. STAFF DELEGATION MANAGER (Bouncer Permissions Control) */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Gate Staff & Bouncer Access</Text>
        <TouchableOpacity style={styles.generateButton} onPress={handleGenerateStaffCode}>
          <Text style={styles.generateButtonText}>+ Issue Token</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.staffContainer}>
        <Text style={styles.panelDescription}>
          Generate short-lived cryptographic tokens below. Workers logging in with these codes can only access the high-frequency QR scanning layout.
        </Text>

        {analytics.activeStaffAccessCodes.length === 0 ? (
          <Text style={styles.emptyStaffText}>No active gate staff codes issued.</Text>
        ) : (
          analytics.activeStaffAccessCodes.map((staff) => (
            <View key={staff.code} style={styles.staffRow}>
              <View>
                <Text style={styles.staffName}>{staff.staffName}</Text>
                <Text style={styles.staffExpiry}>Expires: {new Date(staff.expiryDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
              </View>
              <View style={styles.tokenBadge}>
                <Text style={styles.tokenText}>{staff.code}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* 3. PAST & FUTURE EVENT MEDIA ANALYTICS LIST */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Event Post Insights</Text>
      </View>

      <View style={styles.insightsWrapper}>
        {eventPosts.map((post) => (
          <View key={post.id} style={styles.insightListItem}>
            <View style={styles.insightListHeader}>
              <Text style={styles.eventPostTitle} numberOfLines={1}>{post.title}</Text>
              <View style={[styles.statusTag, post.status === 'Future' ? styles.tagFuture : styles.tagPast]}>
                <Text style={styles.statusTagText}>{post.status.toUpperCase()}</Text>
              </View>
            </View>
            
            {/* Split row matching Views, Likes, and Comments */}
            <View style={styles.metricsRowGrid}>
              <View style={styles.metricBlock}>
                <Text style={styles.metricItemVal}>👁️ {post.views.toLocaleString()}</Text>
                <Text style={styles.metricItemLbl}>Views</Text>
              </View>
              <View style={styles.metricBlock}>
                <Text style={styles.metricItemVal}>❤️ {post.likes.toLocaleString()}</Text>
                <Text style={styles.metricItemLbl}>Likes</Text>
              </View>
              <View style={styles.metricBlock}>
                <Text style={styles.metricItemVal}>💬 {post.comments}</Text>
                <Text style={styles.metricItemLbl}>Comments</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  dashboardContainer: {
    flex: 1,
    backgroundColor: '#FAFAFE',
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#121214',
  },
  generateButton: {
    backgroundColor: '#7B2CBF', // Drexdel Branding Purple
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCardFull: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  statCardHalf: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6C757D',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  revenueValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#7B2CBF',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#212529',
  },
  statSubText: {
    fontSize: 10,
    color: '#ADB5BD',
    marginTop: 6,
  },
  panelDescription: {
    fontSize: 12,
    color: '#6C757D',
    lineHeight: 18,
    marginBottom: 14,
  },
  staffContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 16,
    padding: 16,
  },
  emptyStaffText: {
    fontSize: 13,
    color: '#ADB5BD',
    textAlign: 'center',
    paddingVertical: 10,
    fontStyle: 'italic',
  },
  staffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  staffName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212529',
  },
  staffExpiry: {
    fontSize: 11,
    color: '#2A9D8F', // Accent Green for active state timelines
    fontWeight: '500',
    marginTop: 2,
  },
  tokenBadge: {
    backgroundColor: '#F5ECFF',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D8BBFF',
  },
  tokenText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#7B2CBF',
  },
  insightsWrapper: {
    marginBottom: 40,
  },
  insightListItem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  insightListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
    paddingBottom: 10,
    marginBottom: 12,
  },
  eventPostTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#212529',
    flex: 1,
    marginRight: 10,
  },
  statusTag: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  tagFuture: {
    backgroundColor: '#E3F2FD',
    color: '#0D47A1',
  },
  tagPast: {
    backgroundColor: '#F3E5F5',
    color: '#6A1B9A',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metric: {
    fontSize: 13,
    color: '#495057',
    fontWeight: '700',
  },
  metricsRowGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricBlock: {
    alignItems: 'center',
  },
  metricItemVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#212529',
  },
  metricItemLbl: {
    fontSize: 11,
    color: '#6C757D',
    marginTop: 4,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#121214',
  },
});

