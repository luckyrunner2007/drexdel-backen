/**
 * PROJECT DREXDEL - ROLLING OFFLINE QR COMPONENT
 * FILE: src/components/Security/SecureTicketQR.tsx
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { encryptionService } from '../../services/native/encryption';

interface QrProps {
  secretSeed: string;
}

export const SecureTicketQR: React.FC<QrProps> = ({ secretSeed }) => {
  const [visualPin, setVisualPin] = useState('');

  useEffect(() => {
    // Generate initial dynamic token pass
    setVisualPin(encryptionService.generateRollingOfflineToken(secretSeed));

    // Force cryptographic evaluation update sync every 30 seconds exactly
    const timer = setInterval(() => {
      setVisualPin(encryptionService.generateRollingOfflineToken(secretSeed));
    }, 30000);

    return () => clearInterval(timer);
  }, [secretSeed]);

  return (
    <View style={styles.qrBox}>
      {/* Structural placement placeholder drawing the matrix anchors */}
      <View style={styles.mockQrMatrix}>
        <View style={[styles.anchorNode, styles.anchorTopLeft]} />
        <View style={[styles.anchorNode, styles.anchorTopRight]} />
        <View style={[styles.anchorNode, styles.anchorBottomLeft]} />
        <View style={styles.centerPattern} />
      </View>
      <Text style={styles.pinText}>{visualPin}</Text>
      <Text style={styles.alertSubText}>Security code shifts automatically every 30s</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  qrBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  mockQrMatrix: {
    width: 170,
    height: 170,
    borderWidth: 1,
    borderColor: '#CED4DA',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  anchorNode: {
    width: 36,
    height: 36,
    borderWidth: 4,
    borderColor: '#121214',
    position: 'absolute',
    borderRadius: 6,
  },
  anchorTopLeft: {
    top: 12,
    left: 12,
  },
  anchorTopRight: {
    top: 12,
    right: 12,
  },
  anchorBottomLeft: {
    bottom: 12,
    left: 12,
  },
  centerPattern: {
    width: 44,
    height: 44,
    backgroundColor: '#212529',
    borderRadius: 4,
  },
  pinText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#7B2CBF',
    letterSpacing: 2,
    marginTop: 20,
    fontFamily: 'monospace',
  },
  alertSubText: {
    fontSize: 11,
    color: '#868E96',
    fontWeight: '600',
    marginTop: 4,
  },
});
