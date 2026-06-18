/**
 * PROJECT DREXDEL - STANDARD CHAT BUBBLE ELEMENT
 * FILE: src/components/Chat/ChatBubble.tsx
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

interface ChatBubbleProps {
  senderName: string;
  text: string;
  timestamp: string;
  isMe: boolean;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  senderName,
  text,
  timestamp,
  isMe,
}) => {
  // Format the raw timestamp string cleanly into local minutes readouts
  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return timestamp; // Fallback to raw string if formatting errors occur
    }
  };

  return (
    <View style={[styles.bubbleWrapper, isMe ? styles.alignRight : styles.alignLeft]}>
      <View style={[styles.bubbleContainer, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        {/* Render friend sender handles over chat blocks (Hidden on your own text) */}
        {!isMe && <Text style={styles.senderHandleText}>{senderName}</Text>}
        
        {/* Main core message body script block */}
        <Text style={[styles.bodyText, isMe ? styles.textMe : styles.textThem]}>
          {text}
        </Text>
        
        {/* Small operational timestamp text footprint */}
        <Text style={[styles.timestampText, isMe ? styles.timeMe : styles.timeThem]}>
          {formatTime(timestamp)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bubbleWrapper: {
    flexDirection: 'row',
    width: '100%',
    marginVertical: 4,
  },
  alignLeft: {
    justifyContent: 'flex-start',
  },
  alignRight: {
    justifyContent: 'flex-end',
  },
  bubbleContainer: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: width * 0.75,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.01,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleThem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderBottomLeftRadius: 4, // Clean asymmetric conversation bubble anchor tail
  },
  bubbleMe: {
    backgroundColor: '#7B2CBF', // Drexdel Branding Purple
    borderBottomRightRadius: 4,
  },
  senderHandleText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#7B2CBF',
    marginBottom: 4,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 19,
  },
  textThem: {
    color: '#212529',
  },
  textMe: {
    color: '#FFFFFF',
  },
  timestampText: {
    fontSize: 9,
    textAlign: 'right',
    marginTop: 4,
    fontWeight: '500',
  },
  timeThem: {
    color: '#ADB5BD',
  },
  timeMe: {
    color: '#E0AAFF',
  },
});
