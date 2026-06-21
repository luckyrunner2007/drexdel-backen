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
  Dimensions 
} from 'react-native';
import { useRouter } from 'expo-router';

const router = useRouter();
router.push({ pathname: `/event/${item.id}`, params: { eventData: JSON.stringify(item) } });
import { ChatMessage } from '../../@types/events';
import { EventCard } from '../../components/Discovery/EventCard';

const { width } = Dimensions.get('window');

// Mock data representing an active group chat session planning a weekend outing
const INITIAL_MESSAGES_MOCK: ChatMessage[] = [
  {
    id: 'msg_1',
    senderId: 'user_alex',
    senderName: 'Alex',
    text: "Hey everyone! What's the plan for this weekend? I'm completely bored.",
    createdAt: '2026-06-14T10:00:00Z'
  },
  {
    id: 'msg_2',
    senderId: 'user_sarah',
    senderName: 'Sarah',
    text: "Drexdel shows some cool events happening nearby. Check this out!",
    sharedEventId: 'event_ai_01', // Injecting an Event Card into the node
    createdAt: '2026-06-14T10:02:00Z'
  },
  {
    id: 'msg_3',
    senderId: 'user_host',
    senderName: 'David',
    text: "That looks fun, but let's vote on options so we can lock down tickets.",
    attachedPoll: { // Injecting an active voting poll into the node
      id: 'poll_weekend',
      question: 'Which event are we bonding over this Saturday?',
      options: [
        { eventId: 'event_ai_01', eventTitle: 'Global AI Summit 2026', votesCount: 2, votedUserIds: ['user_alex', 'user_sarah'] },
        { eventId: 'event_cos_02', eventTitle: 'Chibi Cosplay Meetup', votesCount: 1, votedUserIds: ['user_host'] },
        { eventId: 'event_pty_03', eventTitle: 'VVIP Backyard Karaoke', votesCount: 0, votedUserIds: [] }
      ],
      expiresAt: '2026-06-14T22:00:00Z'
    },
    createdAt: '2026-06-14T10:05:00Z'
  }
];

export const RoomScreen: React.FC = () => {
  const params = useLocalSearchParams();
  const flatListRef = useRef<FlatList>(null);

  // Safely fallback to defaults if routed directly via tabs instead of navigation stack parameters
  const roomName = router.params?.roomName || 'Weekend Squad';
  
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES_MOCK);
  const [inputText, setInputText] = useState('');
  const currentUserId = 'user_me'; // Temporary simulation ID of the logged-in user

  // Automatically auto-scrolls the group chat to the newest message node upon layout loading
  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
  }, [messages]);

  // Appends a plain text message to the stream
  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const newMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      senderId: currentUserId,
      senderName: 'Me',
      text: inputText.trim(),
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');
  };

  // Logic to process an interactive poll click mutation safely
  const handleVote = (messageId: string, optionEventId: string) => {
    setMessages(prevMessages => 
      prevMessages.map(msg => {
        if (msg.id !== messageId || !msg.attachedPoll) return msg;

        const updatedOptions = msg.attachedPoll.options.map(opt => {
          const isAlreadyVoted = opt.votedUserIds.includes(currentUserId);
          
          if (opt.eventId === optionEventId) {
            // Add vote if not already voted
            return {
              ...opt,
              votesCount: isAlreadyVoted ? opt.votesCount : opt.votesCount + 1,
              votedUserIds: isAlreadyVoted ? opt.votedUserIds : [...opt.votedUserIds, currentUserId]
            };
          } else {
            // Remove user vote from alternative option tracks to enforce single-choice constraints
            return {
              ...opt,
              votesCount: opt.votedUserIds.includes(currentUserId) ? opt.votesCount - 1 : opt.votesCount,
              votedUserIds: opt.votedUserIds.filter(id => id !== currentUserId)
            };
          }
        });

        return { ...msg, attachedPoll: { ...msg.attachedPoll, options: updatedOptions } };
      })
    );
  };

  // Renders individual elements inside the scrolling feed stream
  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderId === currentUserId;

    return (
      <View style={[styles.messageRow, isMe ? styles.rowRight : styles.rowLeft]}>
        <View style={[styles.bubbleContainer, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          {!isMe && <Text style={styles.senderNameText}>{item.senderName}</Text>}
          
          {/* Plain text block container node */}
          {item.text && <Text style={[styles.bodyMessageText, isMe ? styles.textMe : styles.textThem]}>{item.text}</Text>}

          {/* SHARED EVENT CARD INJECTOR: Triggers if a friend recommends a specific event */}
          {item.sharedEventId && (
            <View style={styles.embeddedCardWrapper}>
              <EventCard
                title="Global AI Summit 2026"
                category="AI CONFERENCE"
                imageUri="https://unsplash.com"
                distanceKm={2.4}
                priceTiers={[{ name: 'Regular', price: 25 }, { name: 'VIP', price: 100 }]}
                isOrganizerVerified={true}
                onPress={() => console.log('Navigating to Event details:', item.sharedEventId)}
              />
            </View>
          )}

          {/* INTERACTIVE VOTING POLL CARD INJECTOR */}
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
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.roomContainer} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Top Banner Navigation Header */}
      <View style={styles.chatHeader}>
        <Text style={styles.roomTitleText}>👥 {roomName}</Text>
        <Text style={styles.roomSubtitleText}>Active bonding coordination room</Text>
      </View>

      {/* Main scrolling message board */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessageItem}
        contentContainerStyle={styles.listScrollContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Bottom text messaging composition container bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.messageInputField}
          placeholder="Type a message or share an event..."
          placeholderTextColor="#ADB5BD"
          value={inputText}
          onChangeText={setInputText}
          multiline={true}
        />
        <TouchableOpacity style={styles.sendButtonNode} onPress={handleSendMessage} activeOpacity={0.8}>
          <Text style={styles.sendIconText}>➔</Text>
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
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: width * 0.85,
  },
  bubbleThem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  bubbleMe: {
    backgroundColor: '#7B2CBF', // Drexdel Purple for your own message nodes
  },
  senderNameText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#7B2CBF',
    marginBottom: 4,
  },
  bodyMessageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  textThem: {
    color: '#212529',
  },
  textMe: {
    color: '#FFFFFF',
  },
  embeddedCardWrapper: {
    width: width * 0.78,
    marginLeft: -16, // Centers the injected layout cleanly inside the bubble dimensions
    marginTop: 8,
  },
  pollContainer: {
    backgroundColor: '#FAFAFE',
    borderWidth: 1,
    borderColor: '#D8BBFF',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    width: width * 0.78,
  },
  pollQuestionText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 10,
  },
  pollOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  pollOptionActive: {
    backgroundColor: '#F5ECFF',
    borderColor: '#7B2CBF',
  },
  pollOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#212529',
    flex: 1,
  },
  pollOptionTitleActive: {
    color: '#7B2CBF',
  },
  voteBadge: {
    backgroundColor: '#F1F3F5',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginLeft: 8,
  },
  voteBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#495057',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    backgroundColor: '#FFFFFF',
  },
  messageInputField: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    backgroundColor: '#F8F9FA',
    color: '#212529',
  },
  sendButtonNode: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7B2CBF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIconText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 18,
  },
});

