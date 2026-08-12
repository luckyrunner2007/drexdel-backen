import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ChatMessage } from '../../@types/events';
import { EventCard } from '../../components/Discovery/EventCard';
import { chatApi } from '../../services/api/chatApi';

const { width } = Dimensions.get('window');

const INITIAL_MESSAGES_MOCK: ChatMessage[] = [];

export const RoomScreen: React.FC = () => {
  const params = useLocalSearchParams();
  const flatListRef = useRef<FlatList>(null);

  const roomId = typeof params.roomId === 'string' ? params.roomId : typeof params.id === 'string' ? params.id : '';
  const roomName = typeof params.roomName === 'string' ? params.roomName : 'Bond Room';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const currentUserId = 'user_me';

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    setLoading(true);
    chatApi.fetchRoomMessages(roomId)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) setMessages(res.data.messages);
      })
      .catch((err) => console.error('Failed to load messages', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [roomId]);

  useEffect(() => {
    if (!loading && messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, loading]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !roomId) return;
    setSending(true);
    try {
      const res = await chatApi.submitMessage(roomId, { content: inputText.trim(), messageType: 'TEXT' });
      if (res.success && res.data) {
        setMessages(prev => [...prev, res.data!.message]);
        setInputText('');
      }
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setSending(false);
    }
  };

  const handleVote = async (messageId: string, optionEventId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg?.attachedPoll) return;
    const poll = msg.attachedPoll;

    setMessages(prev => prev.map(m => {
      if (m.id !== messageId || !m.attachedPoll) return m;
      const updatedOptions = m.attachedPoll.options.map(opt => {
        const hasVoted = opt.votedUserIds.includes(currentUserId);
        if (opt.eventId === optionEventId) {
          return {
            ...opt,
            votesCount: hasVoted ? opt.votesCount : opt.votesCount + 1,
            votedUserIds: hasVoted ? opt.votedUserIds : [...opt.votedUserIds, currentUserId]
          };
        } else {
          return {
            ...opt,
            votesCount: opt.votedUserIds.includes(currentUserId) ? opt.votesCount - 1 : opt.votesCount,
            votedUserIds: opt.votedUserIds.filter(id => id !== currentUserId)
          };
        }
      });
      return { ...m, attachedPoll: { ...m.attachedPoll, options: updatedOptions } };
    }));

    try {
      await chatApi.castPollVote(roomId, messageId, poll.id, optionEventId);
    } catch (err) {
      console.error('Failed to cast vote', err);
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId || !m.attachedPoll) return m;
        const updatedOptions = m.attachedPoll.options.map(opt => {
          const hasVoted = opt.votedUserIds.includes(currentUserId);
          if (opt.eventId === optionEventId) {
            return {
              ...opt,
              votesCount: hasVoted ? opt.votesCount : opt.votesCount + 1,
              votedUserIds: hasVoted ? opt.votedUserIds : [...opt.votedUserIds, currentUserId]
            };
          } else {
            return {
              ...opt,
              votesCount: opt.votedUserIds.includes(currentUserId) ? opt.votesCount - 1 : opt.votesCount,
              votedUserIds: opt.votedUserIds.filter(id => id !== currentUserId)
            };
          }
        });
        return { ...m, attachedPoll: { ...m.attachedPoll, options: updatedOptions } };
      }));
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;
    const reactions = msg.reactions || {};
    const current = reactions[emoji] || [];
    const isAdded = current.includes(currentUserId);

    const optimistic = { ...reactions };
    if (isAdded) {
      optimistic[emoji] = current.filter(id => id !== currentUserId);
      if (optimistic[emoji].length === 0) delete optimistic[emoji];
    } else {
      optimistic[emoji] = [...current, currentUserId];
    }

    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: optimistic } : m));
    try {
      await chatApi.toggleReaction(roomId, messageId, emoji, isAdded ? 'remove' : 'add');
    } catch (err) {
      console.error('Failed to toggle reaction', err);
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: reactions } : m));
    }
  };

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderId === currentUserId;

    return (
      <View style={[styles.messageRow, isMe ? styles.rowRight : styles.rowLeft]}>
        <View style={[styles.bubbleContainer, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          {!isMe && <Text style={styles.senderNameText}>{item.senderName || item.senderUsername || 'User'}</Text>}

          {item.text && <Text style={[styles.bodyMessageText, isMe ? styles.textMe : styles.textThem]}>{item.text}</Text>}

          {item.messageType === 'IMAGE' && item.attachments && item.attachments.map((att, idx) => (
            <View key={idx} style={styles.imageAttachment}>
              <Text style={styles.attachmentPlaceholder}>🖼️ {att.type} attachment</Text>
            </View>
          ))}

          {item.sharedEventId && (
            <View style={styles.embeddedCardWrapper}>
              <EventCard
                title="Event"
                category="EVENT"
                imageUri="https://unsplash.com"
                distanceKm={2.4}
                priceTiers={[{ name: 'Regular', price: 25 }, { name: 'VIP', price: 100 }]}
                isOrganizerVerified={true}
                onPress={() => console.log('Navigating to Event details:', item.sharedEventId)}
              />
            </View>
          )}

          {item.attachedPoll && (
            <View style={styles.pollContainer}>
              <Text style={styles.pollQuestionText}>📊 {item.attachedPoll.question}</Text>
              {item.attachedPoll.options.map((option) => {
                const hasUserVoted = option.votedUserIds.includes(currentUserId);
                return (
                  <TouchableOpacity
                    key={option.eventId}
                    style={[styles.pollOptionRow, hasUserVoted && styles.pollOptionActive]}
                    onPress={() => handleVote(item.id, option.eventId)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.pollOptionTitle, hasUserVoted && styles.pollOptionTitleActive]}>
                      {option.eventTitle}
                    </Text>
                    <View style={styles.voteBadge}>
                      <Text style={styles.voteBadgeText}>{option.votesCount} votes</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {item.reactions && Object.keys(item.reactions).length > 0 && (
            <View style={styles.reactionsRow}>
              {Object.entries(item.reactions).map(([emoji, userIds]) => (
                <TouchableOpacity
                  key={emoji}
                  style={[styles.reactionBadge, userIds.includes(currentUserId) && styles.reactionActive]}
                  onPress={() => handleReaction(item.id, emoji)}
                >
                  <Text style={styles.reactionText}>{emoji} {userIds.length}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  if (!roomId) {
    return (
      <View style={styles.roomContainer}>
        <Text style={styles.roomTitleText}>Room not found</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.roomContainer} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.chatHeader}>
        <Text style={styles.roomTitleText}>👥 {roomName}</Text>
        <Text style={styles.roomSubtitleText}>Bond Room</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7B2CBF" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.listScrollContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubText}>Be the first to say hello!</Text>
            </View>
          }
        />
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.messageInputField}
          placeholder="Type a message..."
          placeholderTextColor="#ADB5BD"
          value={inputText}
          onChangeText={setInputText}
          multiline={true}
          editable={!sending}
        />
        <TouchableOpacity 
          style={[styles.sendButtonNode, sending && styles.sendButtonDisabled]} 
          onPress={handleSendMessage} 
          activeOpacity={0.8}
          disabled={sending}
        >
          <Text style={styles.sendIconText}>{sending ? '...' : '➔'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  roomContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  chatHeader: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    alignItems: 'center',
  },
  roomTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#212529',
  },
  roomSubtitleText: {
    fontSize: 11,
    color: '#6C757D',
    marginTop: 2,
  },
  listScrollContent: {
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    width: '100%',
  },
  rowLeft: {
    justifyContent: 'flex-start',
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  bubbleContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
  },
  bubbleMe: {
    backgroundColor: '#7B2CBF',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },
  senderNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7B2CBF',
    marginBottom: 4,
  },
  bodyMessageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  textMe: {
    color: '#FFFFFF',
  },
  textThem: {
    color: '#212529',
  },
  embeddedCardWrapper: {
    marginTop: 8,
  },
  pollContainer: {
    marginTop: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 10,
  },
  pollQuestionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 8,
  },
  pollOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  pollOptionActive: {
    borderColor: '#7B2CBF',
    backgroundColor: '#F5ECFF',
  },
  pollOptionTitle: {
    fontSize: 13,
    color: '#495057',
    flex: 1,
  },
  pollOptionTitleActive: {
    color: '#7B2CBF',
    fontWeight: '600',
  },
  voteBadge: {
    backgroundColor: '#7B2CBF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  voteBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 6,
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F3F5',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  reactionActive: {
    backgroundColor: '#F5ECFF',
    borderColor: '#7B2CBF',
  },
  reactionText: {
    fontSize: 12,
    color: '#495057',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  messageInputField: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#212529',
    backgroundColor: '#F8F9FA',
    maxHeight: 100,
  },
  sendButtonNode: {
    marginLeft: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7B2CBF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ADB5BD',
  },
  sendIconText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6C757D',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#495057',
    marginBottom: 4,
  },
  emptySubText: {
    fontSize: 13,
    color: '#868E96',
  },
  imageAttachment: {
    marginTop: 8,
    backgroundColor: '#F1F3F5',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  attachmentPlaceholder: {
    fontSize: 24,
  },
});