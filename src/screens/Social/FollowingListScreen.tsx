/**
 * PROJECT DREXDEL - FOLLOWING LIST SCREEN
 * FILE: src/screens/Social/FollowingListScreen.tsx
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { userApi, UserSearchResult } from '../../services/api/userApi';

export const FollowingListScreen: React.FC = () => {
  const params = useLocalSearchParams();
  const router = useRouter();
  const userId = typeof params.userId === 'string' ? params.userId : '';
  const userName = typeof params.userName === 'string' ? params.userName : 'User';

  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | undefined>();

  const load = useCallback(async (cursor?: string) => {
    setLoading(true);
    const res = await userApi.getFollowing(userId, cursor);
    if (res.success && res.data) {
      setUsers((prev) => cursor ? [...prev, ...res.data!.users] : res.data!.users);
      setNextCursor(res.data.nextCursor);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const loadMore = () => {
    if (!loading && nextCursor) {
      load(nextCursor);
    }
  };

  const renderItem = ({ item }: { item: UserSearchResult }) => (
    <TouchableOpacity style={styles.row} onPress={() => router.push(`/profile/${item.id}`)}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.meta}>
        <Text style={styles.name}>{item.name}</Text>
        {item.username ? <Text style={styles.handle}>@{item.username}</Text> : null}
      </View>
      {item.isVerified ? <Text style={styles.verified}>✓</Text> : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Following</Text>
      </View>
      <Text style={styles.subtitle}>People {userName} follows</Text>

      {loading && users.length === 0 ? (
        <View style={styles.center}><ActivityIndicator color="#7B2CBF" /></View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<Text style={styles.empty}>Not following anyone yet.</Text>}
          contentContainerStyle={users.length === 0 ? styles.emptyContainer : undefined}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E9ECEF' },
  backBtn: { marginRight: 12 },
  backText: { fontSize: 16, color: '#7B2CBF', fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '800', color: '#212529' },
  subtitle: { fontSize: 14, color: '#6C757D', paddingHorizontal: 16, paddingTop: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: '#F1F3F5' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5ECFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#7B2CBF' },
  meta: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#212529' },
  handle: { fontSize: 13, color: '#868E96', marginTop: 2 },
  verified: { fontSize: 16, color: '#7B2CBF', fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: 40, color: '#868E96', fontSize: 15 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
});
