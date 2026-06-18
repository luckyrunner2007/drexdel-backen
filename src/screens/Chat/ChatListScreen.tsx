import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { GlobalNavigationProp } from '../../@types/navigation';

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

const MOCK_CHAT_ROOMS: ChatRoomSnippet[] = [
  {
    id: 'room_squad_01',
    name: 'Weekend Squad 🥂',
    lastMessage: 'David: That looks fun, but let\'s vote on options...',
    timestamp: '10:05 AM',
    unreadCount: 3,
    avatarIcon: '🔥',
  },
  {
    id: 'room_cosplay_02',
    name: 'Cosplay Comrades 🦊',
    lastMessage: 'Alex: Who has spare foam for the mask assembly?',
    timestamp: 'Yesterday',
    unreadCount: 0,
    avatarIcon: '🎮',
  },
  {
    id: 'room_tech_03',
    name: 'AI Developers Forum 🤖',
    lastMessage: 'System: New prompt optimization panel added to calendar.',
    timestamp: 'Jun 12',
    unreadCount: 0,
    avatarIcon: '🚀',
  },
  {
    id: 'room_karaoke_04',
    name: 'Backyard Karaoke Clan 🎤',
    lastMessage: 'Sarah: I am practicing my high notes right now.',
    timestamp: 'Jun 10',
    unreadCount: 1,
    avatarIcon: '🎵',
  },
];

export const ChatListScreen: React.FC = () => {
  const navigation = useNavigation<GlobalNavigationProp>();
  const [chatRooms] = useState<ChatRoomSnippet[]>(MOCK_CHAT_ROOMS);
  const [searchQuery, setSearchQuery] = useState('');

  // Routes a user straight into their specific active bonding group chat chamber
  const handleRoomPress = (room: ChatRoomSnippet) => {
    navigation.navigate('ActiveRoom', {
      roomId: room.id,
      roomName: room.name,
    });
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
          <View style={styles.emptyView}>
            <Text style={styles.emptyTextText}>No matching bond groups found.</Text>
            <Text style={styles.emptySubText}>Create a new room to start gathering friends!</Text>
          </View>
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
    backgroundColor: '#F5ECFF', // Soft Drexdel Purple background ring tint
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
    backgroundColor: '#7B2CBF', // Drexdel Identity Purple
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
  },
});
