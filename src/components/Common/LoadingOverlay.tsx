/**
 * PROJECT DREXDEL - CORE NETWORK VISUAL ISOLATION OVERLAY
 * FILE: src/components/Common/LoadingOverlay.tsx
 */

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  visible, 
  message = "Processing secure transaction..." 
}) => {
  // If the data loading state pipeline finishes, remove the layout footprint instantly
  if (!visible) return null;

  return (
    <View style={styles.absoluteContainer}>
      <View style={styles.glassMorphicPanel}>
        <ActivityIndicator size="large" color="#7B2CBF" style={styles.spinnerSpacing} />
        <Text style={styles.messageText}>{message}</Text>
        <Text style={styles.encryptionAlert}>🛡️ Encrypted End-to-End Escrow Link</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  absoluteContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(18, 18, 20, 0.4)', // Dim dark mask layer layout
    zIndex: 9999, // Enforces priority stack display over navigation tabs
    justifyContent: 'center',
    alignItems: 'center',
    width: width,
    height: height,
  },
  glassMorphicPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: width * 0.8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  spinnerSpacing: {
    marginBottom: 16,
  },
  messageText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#212529',
    textAlign: 'center',
    lineHeight: 20,
  },
  encryptionAlert: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2A9D8F', // Balanced secure teal state color 
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 14,
  },
});
