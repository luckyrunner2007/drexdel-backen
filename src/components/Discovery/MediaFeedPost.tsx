/**
 * PROJECT DREXDEL - ORGANIZER HISTORY MEDIA FEED POST
 * FILE: src/components/Discovery/MediaFeedPost.tsx
 */

import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { MediaPost } from '../../@types/events';

const { width } = Dimensions.get('window');

interface MediaFeedPostProps {
  postData: MediaPost;
  onLikePress: () => void;
}

export const MediaFeedPost: React.FC<MediaFeedPostProps> = ({ postData, onLikePress }) => {
  const [localLiked, setLocalLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(postData.likesCount);

  const handleLikeToggle = () => {
    setLocalLiked(!localLiked);
    setLikesCount(prev => localLiked ? prev - 1 : prev + 1);
    onLikePress();
  };

  return (
    <View style={styles.postCard}>
      {/* Organizer Header Profile Row */}
      <View style={styles.postHeader}>
        <View style={styles.organizerAvatarRing}>
          <Text style={styles.avatarIconText}>🎪</Text>
        </View>
        <View>
          <Text style={styles.organizerHandleText}>@host_node_{postData.organizerId.substring(4, 8)}</Text>
          <Text style={styles.timestampText}>Posted a past event memory</Text>
        </View>
      </View>

      {/* Main High-Resolution Event Image/Video Canvas view */}
      <Image source={{ uri: postData.mediaUrl }} style={styles.mainMediaContent} />

      {/* Interactive Social Metric Touch Action Elements Bar */}
      <View style={styles.interactionActionBar}>
        <TouchableOpacity style={styles.actionNode} onPress={handleLikeToggle} activeOpacity={0.8}>
          <Text style={styles.actionIcon}>{localLiked ? '❤️' : '🤍'}</Text>
          <Text style={styles.metricText}>{likesCount.toLocaleString()}</Text>
        </TouchableOpacity>

        <View style={styles.actionNode}>
          <Text style={styles.actionIcon}>👁️</Text>
          <Text style={styles.metricText}>{postData.viewsCount.toLocaleString()} views</Text>
        </View>
        
        <View style={styles.actionNode}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.metricText}>{postData.commentsCount}</Text>
        </View>
      </View>

      {/* Context Captions and Tags descriptions block element */}
      <View style={styles.captionBlock}>
        <Text style={styles.captionTextParagraph}>
          <Text style={styles.boldHandle}>Organizer: </Text>
          {postData.caption}
        </Text>
        {postData.isLinkedToPastEvent && (
          <View style={styles.verifiedPastEventBadge}>
            <Text style={styles.verifiedPastEventText}>✨ Verified Past Event Reel</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  postCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 16,
    marginVertical: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  organizerAvatarRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5ECFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarIconText: { fontSize: 18 },
  organizerHandleText: { fontSize: 14, fontWeight: '700', color: '#212529' },
  timestampText: { fontSize: 11, color: '#ADB5BD', marginTop: 1 },
  mainMediaContent: {
    width: width - 34,
    height: width - 34, // Forces clean aspect ratio dimensions
    backgroundColor: '#E1E4E8',
  },
  interactionActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  actionNode: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  actionIcon: { fontSize: 18, marginRight: 6 },
  metricText: { fontSize: 12, fontWeight: '700', color: '#495057' },
  captionBlock: { padding: 14 },
  captionTextParagraph: { fontSize: 13, color: '#212529', lineHeight: 18 },
  boldHandle: { fontWeight: '700', color: '#121214' },
  verifiedPastEventBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginTop: 8,
  },
  verifiedPastEventText: { color: '#2E7D32', fontSize: 10, fontWeight: 'bold' },
});
