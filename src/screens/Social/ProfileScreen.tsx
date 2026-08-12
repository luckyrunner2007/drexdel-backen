/**
 * PROJECT DREXDEL - EVENT-BACKED PROFILE SCREEN
 * FILE: src/screens/Social/ProfileScreen.tsx
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { userApi, PublicProfile, RelationshipSummary } from '../../services/api/userApi';
import { conversationApi } from '../../services/api/conversationApi';
import { useUser } from '../../state/UserContext';

export const ProfileScreen: React.FC = () => {
  const params = useLocalSearchParams();
  const router = useRouter();
  const identifier = (typeof params.id === 'string' ? params.id : '') || 'me';
    const { user, logoutUser } = useUser();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [relationship, setRelationship] = useState<RelationshipSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [messaging, setMessaging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const isMe = identifier === 'me' || identifier === user?.id;
    const target = isMe && user?.username ? `@${user.username}` : identifier;
    const profileRes = await userApi.fetchProfile(target);
    if (!profileRes.success || !profileRes.data) {
      setError(profileRes.message || 'Could not load profile.');
      setLoading(false);
      return;
    }
    setProfile(profileRes.data.profile);

    if (!isMe) {
      const relRes = await userApi.fetchRelationship(profileRes.data.profile.id);
      if (relRes.success && relRes.data) setRelationship(relRes.data.relationship);
    } else {
      setRelationship({
        status: null,
        isFollowing: false,
        isFollowedBy: false,
        mutualEvents: profileRes.data.profile.mutualEvents,
        mutualFriends: 0,
        sharedEventNames: [],
      });
    }
    setLoading(false);
  }, [identifier, user?.id, user?.username]);

  useEffect(() => { load(); }, [load]);

    const toggleFollow = async () => {
    if (!profile || profile.relationship.isSelf) return;
    setBusy(true);
    const wasFollowing = profile.relationship.isFollowing;
    const res = wasFollowing
      ? await userApi.unfollowUser(profile.id)
      : await userApi.followUser(profile.id);
    if (res.success) {
      setProfile({
        ...profile,
        followerCount: profile.followerCount + (wasFollowing ? -1 : 1),
        relationship: { ...profile.relationship, isFollowing: !wasFollowing },
      });
    }
    setBusy(false);
  };

  // Start (or resume) a DM thread with this user, then route to the conversation.
  const handleMessage = async () => {
    if (!profile || profile.relationship.isSelf) return;
    setMessaging(true);
    const res = await conversationApi.startOrGetDm(profile.id);
    if (res.success && res.data) {
      router.push({ pathname: `/conversation/${res.data.conversation.id}` });
    }
    setMessaging(false);
  };

  const handleBlock = async () => {
    if (!profile || profile.relationship.isSelf) return;
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${profile.name}? They will no longer be able to message you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const res = await userApi.blockUser(profile.id);
            if (res.success) {
              Alert.alert('Blocked', `${profile.name} has been blocked.`);
              setProfile({ ...profile, relationship: { ...profile.relationship, isFollowing: false, isBlocked: true } });
            } else {
              Alert.alert('Error', res.message || 'Could not block user.');
            }
            setBusy(false);
          },
        },
      ]
    );
  };

  const handleUnblock = async () => {
    if (!profile) return;
    setBusy(true);
    const res = await userApi.unblockUser(profile.id);
    if (res.success) {
      Alert.alert('Unblocked', `${profile.name} has been unblocked.`);
      setProfile({ ...profile, relationship: { ...profile.relationship, isBlocked: false } });
    } else {
      Alert.alert('Error', res.message || 'Could not unblock user.');
    }
    setBusy(false);
  };

  const handleReport = () => {
    if (!profile || profile.relationship.isSelf) return;
    Alert.alert(
      'Report User',
      'Why are you reporting this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Spam', onPress: () => submitReport('SPAM') },
        { text: 'Harassment', onPress: () => submitReport('HARMFUL') },
        { text: 'Impersonation', onPress: () => submitReport('IMPERSONATION') },
        { text: 'Other', onPress: () => submitReport('OTHER') },
      ]
    );
  };

  const submitReport = async (reason: string) => {
    if (!profile) return;
    setBusy(true);
    const res = await userApi.reportUser(profile.id, reason);
    if (res.success) {
      Alert.alert('Reported', 'Thank you. Our team will review this report.');
    } else {
      Alert.alert('Error', res.message || 'Could not submit report.');
    }
    setBusy(false);
  };

  const showBlockOptions = () => {
    if (!profile || profile.relationship.isSelf) return;
    if (profile.relationship.isBlocked) {
      Alert.alert('Blocked', 'This user is blocked.', [
        { text: 'OK' },
        { text: 'Unblock', onPress: handleUnblock, style: 'default' },
      ]);
    } else {
      handleBlock();
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#7B2CBF" /></View>;
  }

  if (error || !profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'Profile unavailable'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarText}>{profile.name.charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={styles.name}>{profile.name}{profile.isVerified ? ' ✔' : ''}</Text>
      <Text style={styles.handle}>@{profile.username || 'pending'}</Text>
      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statBlock} onPress={() => router.push({ pathname: '/FollowersList', params: { userId: profile.id, userName: profile.name } })}>
          <Text style={styles.statValue}>{profile.followerCount}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity style={styles.statBlock} onPress={() => router.push({ pathname: '/FollowingList', params: { userId: profile.id, userName: profile.name } })}>
          <Text style={styles.statValue}>{profile.followingCount}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={styles.statValue}>{profile.mutualEvents}</Text>
          <Text style={styles.statLabel}>Mutual events</Text>
        </View>
      </View>

            {!profile.relationship.isSelf && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.followButton, profile.relationship.isFollowing && styles.followingButton, { flex: 1, marginRight: 8 }]}
            onPress={toggleFollow}
            disabled={busy || profile.relationship.isBlocked}
            activeOpacity={0.8}
          >
            <Text style={profile.relationship.isFollowing ? styles.followingText : styles.followText}>
              {busy ? '...' : profile.relationship.isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.messageButton}
            onPress={handleMessage}
            disabled={messaging}
            activeOpacity={0.8}
          >
            <Text style={styles.messageButtonText}>{messaging ? '...' : 'Message'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.messageButton, styles.moreButton]}
            onPress={showBlockOptions}
            activeOpacity={0.8}
          >
            <Text style={styles.moreButtonText}>⋯</Text>
          </TouchableOpacity>
        </View>
      )}

      {!profile.relationship.isSelf && (
        <TouchableOpacity style={styles.reportLink} onPress={handleReport}>
          <Text style={styles.reportText}>Report user</Text>
        </TouchableOpacity>
      )}

            {relationship && relationship.sharedEventNames.length > 0 && (
        <View style={styles.evidenceCard}>
          <Text style={styles.evidenceTitle}>👥 You've been to {relationship.mutualEvents} {relationship.mutualEvents === 1 ? 'event' : 'events'} together</Text>
          {relationship.sharedEventNames.map((name) => (
            <Text key={name} style={styles.evidenceItem}>• {name}</Text>
          ))}
          {relationship.mutualFriends > 0 && (
            <Text style={styles.evidenceItem}>🟣 {relationship.mutualFriends} mutual friends</Text>
          )}
        </View>
      )}

      {/* Self-profile settings: Verify Email/Phone + Change Password + Logout */}
      {profile.relationship.isSelf && (
        <View style={styles.settingsSection}>
          <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/(auth)/verify-email')}>
            <Text style={styles.settingsButtonText}>✉️ Verify Email</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/(auth)/verify-phone')}>
            <Text style={styles.settingsButtonText}>📱 Verify Phone</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/(auth)/change-password')}>
            <Text style={styles.settingsButtonText}>🔑 Change Password</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.settingsButton, styles.logoutButton]} onPress={async () => { await logoutUser(); router.replace('/(auth)/login'); }}>
            <Text style={styles.settingsButtonText}>🚪 Log Out</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <View style={styles.statBlock}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { alignItems: 'center', padding: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  avatarCircle: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: '#F5ECFF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 38, fontWeight: '800', color: '#7B2CBF' },
  name: { fontSize: 20, fontWeight: '800', color: '#212529' },
  handle: { fontSize: 14, color: '#6C757D', marginTop: 2 },
  bio: { fontSize: 14, color: '#495057', textAlign: 'center', marginTop: 10, lineHeight: 20 },
  statsRow: { flexDirection: 'row', marginTop: 22, width: '100%', justifyContent: 'space-around' },
  statBlock: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#212529' },
  statLabel: { fontSize: 12, color: '#868E96', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#E9ECEF', height: 30 },
    followButton: {
    marginTop: 24, backgroundColor: '#7B2CBF', paddingVertical: 12, paddingHorizontal: 40,
    borderRadius: 24, width: '100%', alignItems: 'center',
  },
  followingButton: { backgroundColor: '#F1F3F5', borderWidth: 1, borderColor: '#CED4DA' },
  followText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  followingText: { color: '#495057', fontWeight: '700', fontSize: 15 },
  actionRow: { flexDirection: 'row', marginTop: 24, width: '100%' },
  messageButton: {
    flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CED4DA',
    paddingVertical: 12, borderRadius: 24, alignItems: 'center', marginLeft: 8,
  },
  messageButtonText: { color: '#212529', fontWeight: '700', fontSize: 15 },
  moreButton: { width: 48, marginLeft: 8 },
  moreButtonText: { color: '#495057', fontWeight: '700', fontSize: 20, lineHeight: 22 },
  reportLink: { marginTop: 16, alignItems: 'center' },
  reportText: { fontSize: 13, color: '#868E96', textDecorationLine: 'underline' },
  evidenceCard: {
    marginTop: 28, width: '100%', backgroundColor: '#FAFAFE', borderWidth: 1,
    borderColor: '#D8BBFF', borderRadius: 14, padding: 16,
  },
  evidenceTitle: { fontSize: 14, fontWeight: '800', color: '#212529', marginBottom: 8 },
    evidenceItem: { fontSize: 13, color: '#495057', marginTop: 4 },
  errorText: { fontSize: 15, color: '#6C757D' },
  settingsSection: { marginTop: 28, width: '100%' },
  settingsButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  logoutButton: { backgroundColor: '#FFE2E2', borderColor: '#FEC89A' },
  settingsButtonText: { fontSize: 15, fontWeight: '700', color: '#212529' },
});
