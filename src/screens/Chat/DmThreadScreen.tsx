/**
 * PROJECT DREXDEL - DIRECT MESSAGE THREAD SCREEN
 * FILE: src/screens/Chat/DmThreadScreen.tsx
 *
 * 1:1 conversation thread: loads history (cursor pagination), sends new
 * messages optimistically, and marks the thread read on focus.
 *
 * Realtime delivery is fanned out server-side via Socket.IO (chatBroker:
 * new_dm, dm_inbox_update, typing_dm). The mobile socket client wiring
 * lives in src/state/LiveChatContext (currently a stub) and is the documented
 * follow-up; this screen is fully usable over the REST surface meanwhile.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, ListRenderItemInfo,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { conversationApi, DmMessage, ConversationPeer } from '../../services/api/conversationApi';
import { useUser } from '../../state/UserContext';

interface DmThreadParams {
  id: string;
  peerName?: string;
  peerAvatar?: string | null;
  type?: string;
}

export const DmThreadScreen: React.FC = () => {
  const params = useLocalSearchParams() as unknown as DmThreadParams;
  const router = useRouter();
  const conversationId: string = params.id;
  const type = params.type === 'GROUP' ? 'GROUP' : 'DIRECT';
  const fallbackName = params.peerName || 'Chat';

  const { user } = useUser();
  const myId = user?.id || 'me';

  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const peersFromParams: ConversationPeer[] = params.peerName
    ? [{ id: '', name: params.peerName, username: null, avatarUrl: params.peerAvatar || null, isVerified: false }]
    : [];

  const peerName = (messages[0]?.sender as any)?.name || peersFromParams[0]?.name || fallbackName;

  const loadHistory = useCallback(async (before?: string) => {
    const res = await conversationApi.fetchMessages(conversationId, before);
    if (!res.success || !res.data) return;
    const data = res.data;
    setMessages((prev) => data.messages.concat(prev));
    setNextCursor(data.nextCursor);
  }, [conversationId]);

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      await loadHistory();
      setLoading(false);
      const res = await conversationApi.markRead(conversationId);
      void res;
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    };
    bootstrap();
  }, [loadHistory]);

  const loadOlder = async () => {
    if (loadingMore || !nextCursor) return;
    setLoadingMore(true);
    await loadHistory(nextCursor);
    setLoadingMore(false);
  };
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text) return;
    setSending(true);
    const tempId = `local_${Date.now()}`;
    const optimistic: DmMessage = {
      id: tempId,
      conversationId,
      senderId: myId,
      content: text,
      messageType: 'TEXT',
      createdAt: new Date().toISOString(),
      sender: { id: myId, name: user?.username || 'Me' },
    } as DmMessage;
    setMessages((prev) => [...prev, optimistic]);
    setInputText('');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    const res = await conversationApi.sendMessage(conversationId, text);
    if (!res.success) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, content: `${text}  (not sent)` } : m)),
      );
    } else {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? res.data!.message : m)));
    }
    setSending(false);
  };

  const renderMessage = ({ item }: ListRenderItemInfo<DmMessage>) => {
    const isMe = item.senderId === myId;
    const senderName = isMe ? undefined : item.sender?.name || '…';
    return (
      <View style={[styles.bubbleRow, isMe ? styles.rowRight : styles.rowLeft]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          {!isMe && senderName ? <Text style={styles.senderName}>{senderName}</Text> : null}
          <Text style={isMe ? styles.textMe : styles.textThem}>{item.content}</Text>
          <Text style={styles.timeText}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>&#8590;</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{peerName}</Text>
        {type === 'GROUP' ? (
          <TouchableOpacity onPress={() => router.push({ pathname: `/group-info/${conversationId}`, params: { id: conversationId, title: peerName } })}>
            <Text style={styles.infoText}>Info</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#7B2CBF" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef as any}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.2}
          ListHeaderComponent={loadingMore ? <ActivityIndicator color="#7B2CBF" style={{ margin: 8 }} /> : null}
          inverted
        />
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.inputField}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Message&#8230;"
          onSubmitEditing={handleSend}
          returnKeyType="send"
          blurOnSubmit={false}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending || !inputText.trim()}>
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>Send</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    paddingTop: 44, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E9ECEF',
    backgroundColor: '#fff',
  },
  backBtn: { padding: 6, marginRight: 6 },
  backText: { fontSize: 22, color: '#212529' },
  title: { fontSize: 16, fontWeight: '700', color: '#212529' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 10, paddingBottom: 8 },
  bubbleRow: { flexDirection: 'row', marginBottom: 12, width: '100%' },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', borderRadius: 16, padding: 10 },
  bubbleThem: { backgroundColor: '#fff', alignSelf: 'flex-start' },
  bubbleMe: { backgroundColor: '#7B2CBF', alignSelf: 'flex-end' },
  senderName: { fontSize: 11, fontWeight: '700', color: '#7B2CBF', marginBottom: 2 },
  textThem: { fontSize: 15, color: '#212529', lineHeight: 20 },
  textMe: { fontSize: 15, color: '#fff', lineHeight: 20 },
  timeText: { fontSize: 10, color: '#868E96', marginTop: 4, alignSelf: 'flex-end' },
  inputBar: {
    flexDirection: 'row', alignItems: 'center', padding: 10,
    borderTopWidth: 1, borderTopColor: '#E9ECEF', backgroundColor: '#fff',
  },
  inputField: {
    flex: 1, minHeight: 40, maxHeight: 120, borderWidth: 1, borderColor: '#E9ECEF',
    borderRadius: 18, paddingHorizontal: 14, fontSize: 15, color: '#212529',
    backgroundColor: '#F1F3F5',
  },
  sendBtn: {
    marginLeft: 10, backgroundColor: '#7B2CBF', minWidth: 44, height: 40,
    borderRadius: 20, alignItems: 'center', justifyContent: 'center',
  },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  infoText: { color: '#7B2CBF', fontWeight: '700', fontSize: 14, paddingHorizontal: 6 },
});
