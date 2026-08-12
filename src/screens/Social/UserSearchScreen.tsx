/**
 * PROJECT DREXDEL - USER SEARCH SCREEN
 * FILE: src/screens/Social/UserSearchScreen.tsx
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator,
  Alert, Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { userApi, UserSearchResult } from '../../services/api/userApi';
import { useUser } from '../../state/UserContext';

export const UserSearchScreen: React.FC = () => {
  const router = useRouter();
  const { user } = useUser();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    const res = await userApi.searchUsers(q.trim());
    if (res.success && res.data) {
      setResults(res.data.users);
    }
    setSearching(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  const handlePressUser = (u: UserSearchResult) => {
    Keyboard.dismiss();
    router.push(`/profile/${u.id}`);
  };

  const renderItem = ({ item }: { item: UserSearchResult }) => {
    const handleLabel = item.username ? `@${item.username}` : '';
    const isBlocked = item.relationship?.isBlocked;

    return (
      <TouchableOpacity
        style={[styles.row, isBlocked && styles.rowBlocked]}
        onPress={() => handlePressUser(item)}
        disabled={isBlocked}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.name}>{item.name}</Text>
          {handleLabel ? <Text style={styles.handle}>{handleLabel}</Text> : null}
          {isBlocked ? <Text style={styles.blockedLabel}>Blocked</Text> : null}
        </View>
        {item.isVerified ? <Text style={styles.verified}>✓</Text> : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Find People</Text>
      </View>

      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Search by name or @username..."
          placeholderTextColor="#868E96"
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
          onSubmitEditing={() => doSearch(query)}
        />
        {searching ? <ActivityIndicator color="#7B2CBF" /> : null}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#7B2CBF" /></View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            query.length > 0 && !searching ? (
              <Text style={styles.empty}>No users found.</Text>
            ) : null
          }
          contentContainerStyle={results.length === 0 ? styles.emptyContainer : undefined}
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
  searchBar: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  input: {
    flex: 1, backgroundColor: '#F8F9FA', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: '#212529', borderWidth: 1, borderColor: '#E9ECEF',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12,
    borderBottomWidth: 1, borderBottomColor: '#F1F3F5',
  },
  rowBlocked: { opacity: 0.5 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5ECFF',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#7B2CBF' },
  meta: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#212529' },
  handle: { fontSize: 13, color: '#868E96', marginTop: 2 },
  blockedLabel: { fontSize: 12, color: '#E03131', marginTop: 2 },
  verified: { fontSize: 16, color: '#7B2CBF', fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: 40, color: '#868E96', fontSize: 15 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
});
