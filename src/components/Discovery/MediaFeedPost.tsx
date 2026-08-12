/**
 * PROJECT DREXDEL - MEDIA FEED POST (new upload feature)
 * FILE: src/components/Discovery/MediaFeedPost.tsx
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Post } from '../../@types/posts';
import { postsApi } from '../../services/api/postsApi';

interface MediaFeedPostProps {
  post: Post;
  onPress?: () => void;
  currentUserId?: string;
}

export const MediaFeedPost: React.FC<MediaFeedPostProps> = ({ post, onPress, currentUserId }) => {
  const [liked, setLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [saved, setSaved] = useState(post.isSaved ?? false);
  const [localCaption, setLocalCaption] = useState(post.caption);
  const [isEdited, setIsEdited] = useState(post.isEdited ?? false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setLocalCaption(post.caption);
    setIsEdited(post.isEdited ?? false);
  }, [post.caption, post.isEdited]);

  const isOwner = !!currentUserId && post.userId === currentUserId;

  const toggleLike = useCallback(async () => {
    try {
      const res = await postsApi.toggleLike(post.id);
      if (!res.success) {
        Alert.alert('Error', res.message || 'Could not update like. Please try again.');
        return;
      }
      const next = !liked;
      setLiked(next);
      setLikesCount(c => next ? c + 1 : c - 1);
    } catch {
      Alert.alert('Error', 'Could not update like. Please check your connection.');
    }
  }, [post.id, liked]);

  const toggleSave = useCallback(async () => {
    try {
      const res = await postsApi.savePost(post.id);
      if (!res.success) {
        Alert.alert('Error', res.message || 'Could not save post. Please try again.');
        return;
      }
      setSaved(!saved);
    } catch {
      Alert.alert('Error', 'Could not save post. Please check your connection.');
    }
  }, [post.id, saved]);

  const handleEdit = useCallback(async () => {
    if (editing || !isOwner) return;
    try {
      const newCaption = await new Promise<string | null>((resolve) => {
        (Alert.prompt as any)(
          'Edit Caption',
          'Update your post caption',
          (text: string | undefined) => resolve(text ?? null),
          'plain-text',
          localCaption
        );
      });

      if (newCaption === null || newCaption.trim() === '') return;

      setEditing(true);
      const res = await postsApi.editPost(post.id, { caption: newCaption.trim() });
      if (res.success) {
        setLocalCaption(newCaption.trim());
        setIsEdited(true);
        Alert.alert('Updated', 'Your caption has been updated.');
      } else {
        Alert.alert('Update failed', res.message || 'Could not update caption.');
      }
    } catch {
      Alert.alert('Update failed', 'Could not update caption. Please try again.');
    } finally {
      setEditing(false);
    }
  }, [post.id, localCaption, isOwner, editing]);

  const reportPost = useCallback(async () => {
    try {
      const res = await postsApi.reportPost(post.id, { reason: 'SPAM' });
      if (res.success && res.data?.data?.reported) {
        Alert.alert('Thanks for reporting', 'This post has been reported.');
      } else if (!res.success) {
        Alert.alert('Report failed', res.message || 'Could not report post.');
      }
    } catch {
      Alert.alert('Report failed', 'Could not report post.');
    }
  }, [post.id]);

  const renderVideoBadge = () => {
    if (post.mediaType !== 'VIDEO') return null;
    return <View style={styles.videoBadge}><Text style={styles.videoBadgeText}>▶ VIDEO</Text></View>;
  };

  return (
    <TouchableOpacity activeOpacity={onPress ? 0.9 : 1} onPress={onPress}>
      <View style={styles.postCard}>
        {/* Author header */}
        <View style={styles.postHeader}>
          <View style={styles.organizerAvatarRing}>
            <Text style={styles.avatarIconText}>👤</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.organizerHandleText}>{post.user.name} @{post.user.username}</Text>
            <Text style={styles.timestampText}>
              {post.isPastEventMemory ? 'Past event memory' : post.isUpcomingEventReel ? 'Upcoming reel' : 'New post'}
            </Text>
          </View>
          {post.user.isVerified && <Text style={styles.verifiedBadge}>✓</Text>}
        </View>

        {/* Media */}
        <View>
          <Image source={{ uri: post.mediaUrl }} style={styles.mainMediaContent} resizeMode='cover' />
          {renderVideoBadge()}
          {post.durationSeconds ? <View style={styles.durationBadge}><Text style={styles.durationText}>{Math.floor(post.durationSeconds / 60)}:{String(post.durationSeconds % 60).padStart(2, '0')}</Text></View> : null}
        </View>

        {/* Interaction bar */}
        <View style={styles.interactionActionBar}>
          <TouchableOpacity testID="like-post" style={styles.actionNode} onPress={toggleLike} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>{liked ? '❤️' : '🤍'}</Text>
            <Text style={styles.metricText}>{likesCount.toLocaleString()}</Text>
          </TouchableOpacity>

          <View style={styles.actionNode}>
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={styles.metricText}>{post.commentsCount}</Text>
          </View>

          {post.event ? (
            <View style={styles.actionNode}>
              <Text style={styles.actionIcon}>📅</Text>
              <Text style={styles.metricText} numberOfLines={1}>{post.event.title}</Text>
            </View>
          ) : null}

          {isOwner && (
            <TouchableOpacity testID="edit-post" style={styles.actionNode} onPress={handleEdit} activeOpacity={0.8}>
              <Text style={styles.actionIcon}>{editing ? '⏳' : '✏️'}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity testID="save-post" style={styles.actionNode} onPress={toggleSave} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>{saved ? '🔖' : '📎'}</Text>
            <Text style={styles.metricText}>{post.savesCount ?? 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity testID="report-post" style={styles.actionNode} onPress={reportPost} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>⚠️</Text>
          </TouchableOpacity>
        </View>

        {/* Caption */}
        <View style={styles.captionBlock}>
          <Text style={styles.captionTextParagraph}>
            <Text style={styles.boldHandle}>{post.user.name}: </Text>
            {localCaption}
            {isEdited && <Text style={styles.editedBadge}> (edited)</Text>}
          </Text>
          {post.isPastEventMemory && (
            <View style={styles.verifiedPastEventBadge}>
              <Text style={styles.verifiedPastEventText}>✨ Verified Past Event Memory</Text>
            </View>
          )}
          {post.isUpcomingEventReel && (
            <View style={styles.verifiedPastEventBadge}>
              <Text style={styles.verifiedPastEventText}>🎉 Upcoming Event Reel</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  postCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEEEEE', borderRadius: 16, marginBottom: 16, overflow: 'hidden' },
  postHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  organizerAvatarRing: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  avatarIconText: { fontSize: 18 },
  organizerHandleText: { fontWeight: '700', fontSize: 14, color: '#111' },
  timestampText: { fontSize: 12, color: '#6B7280' },
  verifiedBadge: { color: '#2563EB', fontWeight: '700', fontSize: 16 },
  mainMediaContent: { width: '100%', height: 360 },
  videoBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  videoBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  durationBadge: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  durationText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  interactionActionBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 20 },
  actionNode: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionIcon: { fontSize: 20 },
  metricText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  captionBlock: { paddingHorizontal: 12, paddingBottom: 12 },
  captionTextParagraph: { fontSize: 14, color: '#374151', lineHeight: 20 },
  boldHandle: { fontWeight: '700', color: '#111' },
  editedBadge: { fontSize: 12, color: '#6B7280', fontStyle: 'italic' },
  verifiedPastEventBadge: { marginTop: 8, backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  verifiedPastEventText: { fontSize: 12, color: '#92400E', fontWeight: '600' },
});