import { useState, useRef } from 'react';
import { View, Text, TextInput, Button, Image, Alert, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { postsApi } from '../../src/services/api/postsApi';
import { MediaType, CreatePostPayload } from '../../src/@types/posts';

export default function CreatePostScreen() {
  const router = useRouter();
  const [media, setMedia] = useState<{ uri: string; type: MediaType; mime: string } | null>(null);
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [eventId, setEventId] = useState('');
  const [isPastEventMemory, setIsPastEventMemory] = useState(false);
  const [isUpcomingEventReel, setIsUpcomingEventReel] = useState(false);

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
      videoMaxDuration: 120,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const type: MediaType = asset.type === 'video' ? 'VIDEO' : 'IMAGE';
      setMedia({ uri: asset.uri, type, mime: asset.mimeType || (type === 'IMAGE' ? 'image/jpeg' : 'video/mp4') });
    }
  };

  const handleSubmit = async () => {
    if (!media) { Alert.alert('Error', 'Please select a photo or video'); return; }
    setSubmitting(true);
    try {
      setUploading(true); setProgress(0);
      const session = await postsApi.createUploadSession(media.type, 'media', media.mime);
      if (!session.success || !session.data) throw new Error(session.message || 'Failed to create upload session');
      const response = await fetch(media.uri);
      const blob = await response.blob();
      await postsApi.uploadToPresignedUrl(session.data.uploadUrl, blob);
      setProgress(100);
      const payload: CreatePostPayload = {
        mediaUrl: session.data.fileKey,
        mediaType: media.type,
        caption: caption.trim(),
        eventId: eventId.trim() || undefined,
        isPastEventMemory,
        isUpcomingEventReel,
      };
      const create = await postsApi.createPost(payload);
      if (!create.success) throw new Error(create.message || 'Failed to create post');
      router.back();
    } catch (err: any) {
      Alert.alert('Upload failed', err.message || 'Unknown error');
    } finally {
      setSubmitting(false); setUploading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Create Post</Text>
      {media ? (
        <Image source={{ uri: media.uri }} style={{ width: '100%', height: 300, borderRadius: 12, marginBottom: 12 }} resizeMode='cover' />
      ) : (
        <TouchableOpacity onPress={pickMedia} style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 12, padding: 40, alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ color: '#666' }}>Tap to select photo or video</Text>
        </TouchableOpacity>
      )}
      <TextInput
        placeholder='Write a caption...'
        value={caption}
        onChangeText={setCaption}
        multiline
        style={{ minHeight: 80, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 12, textAlignVertical: 'top' }}
      />
      <TextInput
        placeholder='Event ID (optional)'
        value={eventId}
        onChangeText={setEventId}
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 12 }}
      />
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
        <TouchableOpacity onPress={() => setIsPastEventMemory(!isPastEventMemory)} style={{ padding: 8, borderWidth: 1, borderColor: isPastEventMemory ? '#2563eb' : '#ccc', borderRadius: 8 }}>
          <Text style={{ color: isPastEventMemory ? '#2563eb' : '#333' }}>Past Memory</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setIsUpcomingEventReel(!isUpcomingEventReel)} style={{ padding: 8, borderWidth: 1, borderColor: isUpcomingEventReel ? '#2563eb' : '#ccc', borderRadius: 8 }}>
          <Text style={{ color: isUpcomingEventReel ? '#2563eb' : '#333' }}>Upcoming Reel</Text>
        </TouchableOpacity>
      </View>
      {uploading && <ActivityIndicator size='large' color='#2563eb' style={{ marginBottom: 12 }} />}
      <Button title={submitting ? 'Posting...' : 'Post'} onPress={handleSubmit} disabled={submitting || !media} />
    </ScrollView>
  );
}