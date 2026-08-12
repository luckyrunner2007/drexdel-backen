/**
 * PROJECT DREXDEL - GROUP INFO SCREEN
 * FILE: src/screens/Chat/GroupInfoScreen.tsx
 *
 * Shows group members, allows admin actions (add/remove members, update group,
 * transfer admin, dissolve group). Works for both DIRECT and GROUP conversations
 * but hides admin actions for DMs.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { conversationApi, ConversationSummary, ConversationMember } from '../../services/api/conversationApi';
import { useUser } from '../../state/UserContext';

export const GroupInfoScreen: React.FC = () => {
  const params = useLocalSearchParams() as unknown as { id: string; title?: string };
  const router = useRouter();
  const conversationId = params.id;
  const { user } = useUser();
  const myId = user?.id || 'me';
  const [thread, setThread] = useState<ConversationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(params.title || '');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');

  const loadThread = useCallback(async () => {
    setLoading(true);
    const res = await conversationApi.listInbox();
    if (res.success && res.data) {
      const found = res.data.conversations.find((c) => c.id === conversationId);
      if (found) {
        setThread(found);
        setTitle(found.title || '');
        setDescription(found.description || '');
        setIsPublic(found.isPublic || false);
      }
    }
    setLoading(false);
  }, [conversationId]);

  useEffect(() => { loadThread(); }, [loadThread]);

  const isAdmin = (thread?.members || []).some((m) => m.role === 'ADMIN' && m.userId === myId);
  const isGroup = thread?.type === 'GROUP';

  const handleUpdate = async () => {
    if (!isAdmin || !isGroup) return;
    setSaving(true);
    const res = await conversationApi.updateGroup(conversationId, {
      title: title.trim() || undefined,
      description: description.trim() || null,
      isPublic,
    });
    setSaving(false);
    if (res.success) {
      Alert.alert('Updated', 'Group info saved');
      loadThread();
    } else {
      Alert.alert('Error', 'Failed to update group');
    }
  };

  const handleAddMembers = async () => {
    if (!memberQuery.trim()) return;
    const ids = memberQuery.split(/[\s,]+/).filter(Boolean);
    if (ids.length === 0) return;
    setSaving(true);
    const res = await conversationApi.addMembers(conversationId, ids);
    setSaving(false);
    if (res.success) {
      setMemberQuery('');
      setShowAddMembers(false);
      Alert.alert('Success', 'Members added');
      loadThread();
    } else {
      Alert.alert('Error', 'Failed to add members');
    }
  };

  const handleRemoveMember = (member: ConversationMember) => {
    Alert.alert('Remove member', `Remove ${member.user.name} from the group?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const res = await conversationApi.removeMember(conversationId, member.userId);
          if (res.success) {
            Alert.alert('Removed', 'Member removed');
            loadThread();
          } else {
            Alert.alert('Error', 'Failed to remove member');
          }
        },
      },
    ]);
  };

  const handleTransferAdmin = (member: ConversationMember) => {
    Alert.alert('Transfer admin', `Make ${member.user.name} a group admin?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Transfer',
        onPress: async () => {
          const res = await conversationApi.transferAdmin(conversationId, member.userId);
          if (res.success) {
            Alert.alert('Success', 'Admin transferred');
            loadThread();
          } else {
            Alert.alert('Error', 'Failed to transfer admin');
          }
        },
      },
    ]);
  };

  const handleLeave = () => {
    Alert.alert('Leave group', 'Are you sure you want to leave this group?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          const res = await conversationApi.leaveGroup(conversationId);
          if (res.success) {
            router.back();
          } else {
            Alert.alert('Error', 'Failed to leave group');
          }
        },
      },
    ]);
  };

  const handleDissolve = () => {
    Alert.alert('Dissolve group', 'This will permanently delete the group for everyone. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Dissolve',
        style: 'destructive',
        onPress: async () => {
          const res = await conversationApi.dissolveGroup(conversationId);
          if (res.success) {
            router.back();
          } else {
            Alert.alert('Error', 'Failed to dissolve group');
          }
        },
      },
    ]);
  };

  const renderMember = ({ item }: { item: ConversationMember }) => {
    const isMe = item.userId === myId;
    return (
      <View style={styles.memberRow}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{item.user.name?.[0]?.toUpperCase() || '?'}</Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{isMe ? 'You' : item.user.name}</Text>
          <Text style={styles.memberRole}>{item.role === 'ADMIN' ? 'Admin' : 'Member'}</Text>
        </View>
        {isAdmin && !isMe && (
          <View style={styles.memberActions}>
            <TouchableOpacity onPress={() => handleTransferAdmin(item)}>
              <Text style={styles.actionText}>Make admin</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleRemoveMember(item)}>
              <Text style={[styles.actionText, styles.removeText]}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7B2CBF" />
      </View>
    );
  }

  if (!thread) {
    return (
      <View style={styles.center}>
        <Text>Conversation not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>&#8590;</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Group Info</Text>
        <View style={{ flex: 1 }} />
      </View>

      <FlatList
        style={styles.list}
        ListHeaderComponent={
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Group Details</Text>
            {isGroup && isAdmin ? (
              <>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Group name"
                  maxLength={120}
                />
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Description"
                  maxLength={2000}
                  multiline
                />
                <View style={styles.row}>
                  <Text style={styles.label}>Public group</Text>
                  <TouchableOpacity
                    style={[styles.toggle, isPublic && styles.toggleOn]}
                    onPress={() => setIsPublic(!isPublic)}
                  >
                    <Text style={styles.toggleText}>{isPublic ? 'Yes' : 'No'}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleUpdate}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save Changes</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.detailText}>{thread.title || 'Unnamed group'}</Text>
                {thread.description ? <Text style={styles.detailSub}>{thread.description}</Text> : null}
                <Text style={styles.detailSub}>Public: {thread.isPublic ? 'Yes' : 'No'}</Text>
              </>
            )}
          </View>
        }
        data={thread.members || []}
        keyExtractor={(item) => item.userId}
        renderItem={renderMember}
        ListFooterComponent={
          isAdmin && isGroup ? (
            <View style={styles.section}>
              {showAddMembers ? (
                <View style={styles.addMemberRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={memberQuery}
                    onChangeText={setMemberQuery}
                    placeholder="Enter user IDs (comma separated)"
                  />
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleAddMembers} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Add</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowAddMembers(false)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowAddMembers(true)}>
                  <Text style={styles.secondaryBtnText}>Add Members</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.secondaryBtn, styles.leaveBtn]} onPress={handleLeave}>
                <Text style={styles.leaveBtnText}>Leave Group</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryBtn, styles.dissolveBtn]} onPress={handleDissolve}>
                <Text style={styles.dissolveBtnText}>Dissolve Group</Text>
              </TouchableOpacity>
            </View>
          ) : !isGroup ? (
            <View style={styles.section}>
              <TouchableOpacity style={[styles.secondaryBtn, styles.leaveBtn]} onPress={handleLeave}>
                <Text style={styles.leaveBtnText}>Leave Conversation</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    paddingTop: 44, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E9ECEF',
    backgroundColor: '#fff',
  },
  backBtn: { padding: 6, marginRight: 6 },
  backText: { fontSize: 22, color: '#212529' },
  title: { fontSize: 16, fontWeight: '700', color: '#212529' },
  list: { flex: 1 },
  section: {
    backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E9ECEF',
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#7B2CBF', textTransform: 'uppercase', marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: '#E9ECEF', borderRadius: 8, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 15, color: '#212529', backgroundColor: '#F8F9FA', marginBottom: 10,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  label: { fontSize: 15, color: '#212529' },
  toggle: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: '#ADB5BD',
  },
  toggleOn: { backgroundColor: '#7B2CBF' },
  toggleText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  primaryBtn: {
    backgroundColor: '#7B2CBF', borderRadius: 8, paddingVertical: 12, alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  detailText: { fontSize: 17, fontWeight: '700', color: '#212529', marginBottom: 4 },
  detailSub: { fontSize: 14, color: '#868E96', marginBottom: 2 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1,
    borderBottomColor: '#F1F3F5',
  },
  avatarCircle: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#7B2CBF',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '600', color: '#212529' },
  memberRole: { fontSize: 12, color: '#7B2CBF', textTransform: 'capitalize' },
  memberActions: { flexDirection: 'row', gap: 8 },
  actionText: { color: '#7B2CBF', fontSize: 13, fontWeight: '600', marginLeft: 8 },
  removeText: { color: '#E03131' },
  addMemberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  secondaryBtn: {
    borderWidth: 1, borderColor: '#7B2CBF', borderRadius: 8, paddingVertical: 12,
    alignItems: 'center', marginTop: 10,
  },
  secondaryBtnText: { color: '#7B2CBF', fontWeight: '700', fontSize: 15 },
  leaveBtn: { borderColor: '#E03131' },
  leaveBtnText: { color: '#E03131', fontWeight: '700', fontSize: 15 },
  dissolveBtn: { borderColor: '#C92A2A', backgroundColor: '#FFF5F5', marginTop: 8 },
  dissolveBtnText: { color: '#C92A2A', fontWeight: '700', fontSize: 15 },
  cancelText: { color: '#868E96', fontSize: 14, marginLeft: 8 },
});
