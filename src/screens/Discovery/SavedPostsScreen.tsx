/**
 * PROJECT DREXDEL - SAVED POSTS COLLECTION SCREEN
 * Renders the posts the current viewer has saved (GET /v1/posts/saved).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MediaFeedPost } from '../../components/Discovery/MediaFeedPost';
import { postsApi } from '../../services/api/postsApi';
import { Post } from '../../@types/posts';
import { useUser } from '../../state/UserContext';

export function SavedPostsScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (p: number) => {
    if (p === 1) setLoading(true);
    try {
      const res = await postsApi.listSavedPosts({ page: p, limit: 20 });
      if (res.success && res.data) {
        const mapped = (res.data.data || []).map((x: any) => ({
          ...x,
          likesCount: x.likesCount ?? 0,
          commentsCount: x.commentsCount ?? 0,
          isLiked: x.isLiked ?? false,
          isSaved: true,
          savesCount: x.savesCount ?? 0,
        }));
        setPosts(prev => (p === 1 ? mapped : [...prev, ...mapped]));
        setHasMore(res.data.pagination?.hasMore ?? false);
        setPage(p);
      }
    } finally {
      setLoading(false);
      if (p === 1) setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const openPost = useCallback((post: Post) => {
    router.push({ pathname: '/post/[id]', params: { id: post.id } });
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(1);
  }, [load]);

  if (loading && posts.length === 0) {
    return <View style={styles.center}><ActivityIndicator size='large' color='#7B2CBF' /></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Saved Posts</Text>
      <FlatList
        testID="saved-posts-list"
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MediaFeedPost post={item} onPress={() => openPost(item)} currentUserId={user?.id} />}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={<Text style={styles.empty}>No saved posts yet.</Text>}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReached={() => { if (hasMore) load(page + 1); }}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
}

export default SavedPostsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  title: { fontSize: 20, fontWeight: '700', marginHorizontal: 16, marginVertical: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', marginTop: 40, color: '#6B7280' },
});
