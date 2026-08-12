import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { presenceApi, LiveEvent, FriendArrival } from '../../services/api/presenceApi';
import { conversationApi, ConversationSummary } from '../../services/api/conversationApi';
import { chatApi, ChatRoom } from '../../services/api/chatApi';

const { width } = Dimensions.get('window');

// Defining structure for each chat room link metadata entry node
interface ChatRoomSnippet {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  avatarIcon: string;
}

export const ChatListScreen: React.FC = () => {
  const router = useRouter();
  const [chatRooms, setChatRooms] = useState<ChatRoomSnippet[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [dmThreads, setDmThreads] = useState<ConversationSummary[]>([]);
  const [arrivals, setArrivals] = useState<FriendArrival[]>([]);

  // "Who's here now" â€” events where your friends are currently present.
  useEffect(() => {
    presenceApi
      .fetchLiveEvents()
      .then((res) => { if (res.success && res.data) setLiveEvents(res.data.events); })
      .catch(() => {});
  }, []);

  // Friend-arrival notifications: "X just arrived at Y".
  useEffect(() => {
    presenceApi
      .fetchFriendArrivals()
      .then((res) => { if (res.success && res.data) setArrivals(res.data.arrivals); })
      .catch(() => {});
  }, []);

  // Load bond rooms the user can access.
  useEffect(() => {
    let cancelled = false;
    setLoadingRooms(true);
    chatApi
      .listRooms()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          const mapped: ChatRoomSnippet[] = res.data.rooms.map((room: ChatRoom) => ({
            id: room.id,
            name: room.name,
            lastMessage: room.description || 'Bond room',
            timestamp: room.eventDate ? new Date(room.eventDate).toLocaleDateString() : '',
            unreadCount: 0,
            avatarIcon: room.avatarUrl || '💬',
          }));
          setChatRooms(mapped);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingRooms(false); });
    return () => { cancelled = true; };
  }, []);

  // DM inbox (1:1 conversations).
  useEffect(() => {
    conversationApi
      .listInbox()
      .then((res) => { if (res.success && res.data) setDmThreads(res.data.conversations); })
      .catch(() => {});
  }, []);

    const openDm = (thread: ConversationSummary) => {
    const peer = (thread.peers?.[0] || { name: thread.title || 'Chat', avatarUrl: null });
    router.push({
      pathname: `/conversation/${thread.id}`,
      params: { peerName: peer.name, peerAvatar: peer.avatarUrl || '', type: thread.type || 'DIRECT' },
    });
  };

  // Routes a user straight into their specific active bonding group chat chamber
  const handleRoomPress = (room: ChatRoomSnippet) => {
    router.push({
      pathname: `/room/${room.id}`,
      params: { roomName: room.name }
    });
  };

  // Dismiss the friend-arrival feed (clears it server-side too).
  const dismissArrivals = () => {
    setArrivals([]);
    presenceApi.clearArrivals().catch(() => {});
  };

  // Filter groups in real-time as user types in the search query field bar
  const filteredRooms = chatRooms.filter(room => 
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderRoomItem = ({ item }: { item: ChatRoomSnippet }) => {
    return (
      <TouchableOpacity 
        style={styles.roomRowContainer} 
        onPress={() => handleRoomPress(item)}
        activeOpacity={0.7}
      >
        {/* Rounded Avatar Badge Icon Display */}
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarIconText}>{item.avatarIcon}</Text>
        </View>

        {/* Content Metadata Middle Pillar Text Nodes */}
        <View style={styles.contentMiddleBlock}>
          <View style={styles.topRowMeta}>
            <Text style={styles.roomNameText} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.timeText}>{item.timestamp}</Text>
          </View>
          
          <View style={styles.bottomRowMeta}>
            <Text style={styles.lastMessageText} numberOfLines={1}>{item.lastMessage}</Text>
            {/* Conditional Unread notification numeric badge indicator circle */}
            {item.unreadCount > 0 && (
              <View style={styles.unreadCounterBox}>
                <Text style={styles.unreadCounterText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.masterChatListContainer}>
      
            {/* Friend-arrival notifications */}
      {arrivals.length > 0 && (
        <View style={styles.arrivalsSection}>
          <View style={styles.arrivalsHeaderRow}>
            <Text style={styles.arrivalsHeader}>🔔 Friends just arrived</Text>
            <TouchableOpacity onPress={dismissArrivals} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.arrivalsClearText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
          {arrivals.slice(0, 3).map((arrival) => (
            <TouchableOpacity
              key={`${arrival.friendId}-${arrival.at}`}
              style={styles.arrivalsRow}
              onPress={() => router.push({ pathname: `/event/${arrival.eventId}` })}
              activeOpacity={0.7}
            >
              <Text style={styles.arrivalsText} numberOfLines={1}>
                <Text style={styles.arrivalsName}>{arrival.friend?.name || 'A friend'}</Text>
                {arrival.eventTitle ? ` just arrived at ${arrival.eventTitle}` : ' is nearby right now'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

            {/* "Who's here now" live section */}
      {liveEvents.length > 0 && (
        <View style={styles.liveSection}>
          <View style={styles.liveHeaderRow}>
            <Text style={styles.liveHeader}>ðŸŸ¢ Live nearby</Text>
            <TouchableOpacity
              onPress={() => router.push('/presence')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.liveRadarLink}>🛰️ Open radar</Text>
            </TouchableOpacity>
          </View>
          {liveEvents.map((ev) => (
            <TouchableOpacity
              key={ev.id}
              style={styles.liveRow}
              onPress={() => router.push({ pathname: `/event/${ev.id}` })}
              activeOpacity={0.7}
            >
              <View style={styles.liveDot} />
              <View style={styles.liveInfo}>
                <Text style={styles.liveTitle} numberOfLines={1}>{ev.title}</Text>
                <Text style={styles.liveMembers} numberOfLines={1}>
                  {ev.members.map((m) => m.name).join(', ')} are here now
                </Text>
              </View>
              <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>{ev.members.length}</Text></View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* DMs (1:1 conversations) section */}
      {dmThreads.length > 0 && (
        <View style={styles.dmSection}>
          {dmThreads.slice(0, 6).map((thread) => (
            <TouchableOpacity key={thread.id} style={styles.dmRow} onPress={() => openDm(thread)}>
              <View style={styles.dmAvatar}>
                <Text style={styles.dmAvatarText}>
                  {(thread.peers?.[0]?.name || 'C').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.dmInfo}>
                <Text style={styles.dmPeerName} numberOfLines={1}>
                  {thread.title || thread.peers?.map((p) => p.name).join(', ') || 'Chat'}
                </Text>
                <Text style={styles.dmLast} numberOfLines={1}>
                  {thread.lastMessagePreview || 'No messages yet'}
                </Text>
              </View>
              {thread.unreadHint > 0 ? (
                <View style={styles.dmUnreadBadge}><Text style={styles.dmUnreadText}>{thread.unreadHint}</Text></View>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Search Header Filtering Input Bar Container node */}
      <View style={styles.searchBarWrapper}>
        <TextInput
          style={styles.searchBarField}
          placeholder="Search bond rooms or squads..."
          placeholderTextColor="#ADB5BD"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
        />
      </View>

      {/* Main scrolling index grid feed node */}
      <FlatList
        data={filteredRooms}
        keyExtractor={item => item.id}
        renderItem={renderRoomItem}
        contentContainerStyle={styles.listContainerStyle}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loadingRooms ? (
            <View style={styles.emptyView}>
              <ActivityIndicator size="large" color="#7B2CBF" />
              <Text style={styles.emptyTextText}>Loading bond rooms...</Text>
            </View>
          ) : (
            <View style={styles.emptyView}>
              <Text style={styles.emptyTextText}>No matching bond groups found.</Text>
              <Text style={styles.emptySubText}>Book a ticket to an event to unlock its Bond Room!</Text>
            </View>
          )
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  masterChatListContainer: {
    flex: 1,
    backgroundColor: '#FAFAFE',
  },
  searchBarWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  searchBarField: {
    backgroundColor: '#F1F3F5',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#212529',
  },
  listContainerStyle: {
    paddingVertical: 6,
  },
  roomRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F5ECFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarIconText: {
    fontSize: 24,
  },
  contentMiddleBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  topRowMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  roomNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#212529',
    maxWidth: width * 0.55,
  },
  timeText: {
    fontSize: 11,
    color: '#ADB5BD',
    fontWeight: '500',
  },
  bottomRowMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessageText: {
    fontSize: 13,
    color: '#6C757D',
    flex: 1,
    marginRight: 10,
  },
  unreadCounterBox: {
    backgroundColor: '#7B2CBF',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  unreadCounterText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyView: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 40,
  },
  emptyTextText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#495057',
    marginBottom: 4,
  },
    emptySubText: {
    fontSize: 12,
    color: '#868E96',
    textAlign: 'center',
    lineHeight: 16,
    }, // "Who's here now" â€” live nearby section
  liveSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
    borderRadius: 12,
    padding: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  liveHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#495057',
    marginBottom: 8,
  },
  liveHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveRadarLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7B2CBF',
  },
  arrivalsSection: {
    backgroundColor: '#7B2CBF',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  arrivalsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  arrivalsHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  arrivalsClearText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E6D9F5',
  },
  arrivalsRow: {
    paddingVertical: 6,
    marginTop: 4,
  },
  arrivalsText: {
    fontSize: 13,
    color: '#FFFFFF',
  },
  arrivalsName: {
    fontWeight: '800',
    color: '#FFFFFF',
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    marginRight: 10,
  },
  liveInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  liveTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212529',
  },
  liveMembers: {
    fontSize: 12,
    color: '#6C757D',
    marginTop: 2,
  },
  liveBadge: {
    backgroundColor: '#7B2CBF',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
    liveBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // DMs (1:1 conversations) section
  dmSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  dmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
  },
  dmAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5ECFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dmAvatarText: { fontSize: 18, fontWeight: '700', color: '#7B2CBF' },
  dmInfo: { flex: 1, justifyContent: 'center' },
  dmPeerName: { fontSize: 14, fontWeight: '700', color: '#212529', marginBottom: 2 },
  dmLast: { fontSize: 12, color: '#6C757D' },
  dmUnreadBadge: {
    backgroundColor: '#7B2CBF',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  dmUnreadText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
});
