import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { postsApi } from '../../src/services/api/postsApi';
import { Post } from '../../src/@types/posts';
import { MediaFeedPost } from '../../src/components/Discovery/MediaFeedPost';
import { useRouter } from 'expo-router';
import { useUser } from '../../src/state/UserContext';

export default function MediaScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const load = async (p: number, refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const res = await postsApi.fetchFeed({ page: p, limit: 20 });
      if (res.success && res.data) {
        const mapped = res.data.data.map((x: any) => ({ ...x, likesCount: x.likesCount ?? 0, commentsCount: x.commentsCount ?? 0, isLiked: x.isLiked ?? false }));
        setPosts(prev => refresh ? mapped : [...prev, ...mapped]);
        setHasMore(res.data.pagination.hasMore);
        setPage(p);
      }
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };

  useEffect(() => { load(1, true); }, []);

  const onRefresh = useCallback(() => load(1, true), []);
  const onEndReached = useCallback(() => { if (hasMore && !loading) load(page + 1); }, [page, hasMore, loading]);

  const openPost = (post: Post) => router.push({ pathname: '/post/[id]', params: { id: post.id } });

  if (loading) {
    return (<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size='large' color='#7B2CBF' /></View>);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 20, fontWeight: '700' }}>Media Feed</Text>
        <TouchableOpacity onPress={() => router.push('/upload/create')} style={{ backgroundColor: '#7B2CBF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>+ New Post</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MediaFeedPost post={item} onPress={() => openPost(item)} currentUserId={user?.id} />}
        contentContainerStyle={{ padding: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor='#7B2CBF' />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 40, color: '#6B7280' }}>No posts yet. Be the first to share!</Text>}
      />
    </View>
  );
}