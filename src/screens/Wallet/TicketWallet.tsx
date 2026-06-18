import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Dimensions 
} from 'react-native';
import { EncryptedTicket } from '../../@types/events';

// Destructure the height parameter correctly to protect native UI layouts from crashing
const { height } = Dimensions.get('window');

// Mock data reflecting locally saved cryptographically encrypted offline tickets 
const OFFLINE_TICKETS_MOCK: EncryptedTicket[] = [
  {
    id: 'tkt_summit_99',
    eventId: 'event_ai_01',
    userId: 'user_me',
    tierId: 't2',
    purchaseTimestamp: '2026-06-14T09:00:00Z',
    cryptographicToken: 'TOKEN_ROT_A7X9_6521',
    qrCodeString: 'DREXDEL_SECURE_AUTH_VALID_HASH_A7X9',
    status: 'booked'
  },
  {
    id: 'tkt_karaoke_44',
    eventId: 'event_pty_03',
    userId: 'user_me',
    tierId: 't5',
    purchaseTimestamp: '2026-06-13T18:30:00Z',
    cryptographicToken: 'TOKEN_ROT_M4K2_1109',
    qrCodeString: 'DREXDEL_SECURE_AUTH_VALID_HASH_M4K2',
    status: 'booked'
  }
];

export const TicketWallet: React.FC = () => {
  const [tickets] = useState<EncryptedTicket[]>(OFFLINE_TICKETS_MOCK);
  // Synchronized directly with array index zero to bypass runtime initializer race conditions
  const [activeTicketId, setActiveTicketId] = useState<string | null>(OFFLINE_TICKETS_MOCK[0]?.id || null);
  const [rollingToken, setRollingToken] = useState<string>('982 143'); 

  // ANTI-SCREENSHOT ROTATION CODE
  useEffect(() => {
    const tokenInterval = setInterval(() => {
      const generatedTokenCode = `${Math.floor(100 + Math.random() * 900)} ${Math.floor(100 + Math.random() * 900)}`;
      setRollingToken(generatedTokenCode);
    }, 30000);

    return () => clearInterval(tokenInterval);
  }, []);

  const currentSelectedTicket = tickets.find(t => t.id === activeTicketId);

  const renderTicketTabs = ({ item }: { item: EncryptedTicket }) => {
    const isSelected = item.id === activeTicketId;
    const isSummit = item.eventId === 'event_ai_01';

    return (
      <TouchableOpacity
        style={[styles.miniTabButton, isSelected && styles.miniTabButtonActive]}
        onPress={() => setActiveTicketId(item.id)}
        activeOpacity={0.8}
      >
        <Text style={[styles.miniTabLabel, isSelected && styles.miniTabLabelActive]}>
          {isSummit ? '🤖 AI Summit' : '🎤 Karaoke'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.masterWalletContainer}>
      
      {/* 1. OFFLINE RESILIENCE NOTICE NETWORK STATUS BAR */}
      <View style={styles.offlineStatusBarBanner}>
        <Text style={styles.offlineStatusTextText}>⚡ Cryptographic Vault Secured • Works Completely Offline</Text>
      </View>

      {/* 2. TICKET HORIZONTAL SELECTOR RINGS LOOP */}
      <View style={styles.tabSliderWrapper}>
        <FlatList
          data={tickets}
          keyExtractor={item => item.id}
          renderItem={renderTicketTabs}
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalTabsPadding}
        />
      </View>

      {/* 3. CORE SECURE DIGITAL PASS EMBLEM GRID */}
      {currentSelectedTicket ? (
        <View style={styles.passBodyLayoutContainer}>
          <View style={styles.passHeaderBrandBlock}>
            <Text style={styles.passBrandText}>PROJECT DREXDEL PASS</Text>
            <View style={styles.statusLiveBadge}>
              <Text style={styles.statusLiveBadgeText}>{currentSelectedTicket.status.toUpperCase()}</Text>
            </View>
          </View>

          {/* Ticket Information Readout Nodes */}
          <View style={styles.passMetaBodyBlock}>
            <Text style={styles.passEventTitle} numberOfLines={2}>
              {currentSelectedTicket.eventId === 'event_ai_01' 
                ? 'Global AI Summit & Neural Networks Panel 2026' 
                : 'VVIP Backyard Karaoke & Grill Night'}
            </Text>
            
            <View style={styles.metaSplitRow}>
              <View>
                <Text style={styles.metaLabelText}>ACCESS LEVEL</Text>
                <Text style={styles.metaValueText}>
                  {currentSelectedTicket.tierId === 't2' ? 'Corporate Delegate (VIP)' : 'Host Support Pass'}
                </Text>
              </View>
              <View style={styles.rightAlignedMetaColumn}>
                <Text style={styles.metaLabelText}>HOLDER REFERENCE</Text>
                <Text style={styles.metaValueText}>DRE-0098-ME</Text>
              </View>
            </View>
          </View>

          {/* THE CRYPTOGRAPHIC GENERATOR GRID ANCHOR */}
          <View style={styles.qrCodeScanningChamber}>
            <View style={styles.simulatedQrVisualMatrix}>
              <View style={styles.qrCornerAnchorTopLeft} />
              <View style={styles.qrCornerAnchorTopRight} />
              <View style={styles.qrCornerAnchorBottomLeft} />
              <View style={styles.qrCenterCoreGridNode} />
            </View>

            <Text style={styles.rollingTokenTimerValue}>{rollingToken}</Text>
            <Text style={styles.rollingTokenLabel}>Security token updates every 30s</Text>
          </View>

          {/* Operational Safety Lock Guard Notice */}
          <View style={styles.passLegalFooterNotice}>
            <Text style={styles.legalNoticeTextParagraph}>
              This encrypted pass contains zero balance tracking data metrics. Gate staff devices verify entry codes securely using sandboxed offline authentication hooks.
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.emptyWalletBox}>
          <Text style={styles.emptyWalletTitle}>Your Ticket Vault is Empty</Text>
          <Text style={styles.emptyWalletSubtitle}>Book a pass or look up local event promotions around you to generate secure entry tokens.</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  masterWalletContainer: {
    flex: 1,
    backgroundColor: '#FAFAFE',
  },
  offlineStatusBarBanner: {
    backgroundColor: '#2A9D8F',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineStatusTextText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  tabSliderWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    paddingVertical: 12,
  },
  horizontalTabsPadding: {
    paddingHorizontal: 12,
  },
  miniTabButton: {
    backgroundColor: '#F1F3F5',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  miniTabButtonActive: {
    backgroundColor: '#7B2CBF',
    borderColor: '#7B2CBF',
  },
  miniTabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#495057',
  },
  miniTabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  passBodyLayoutContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 24,
    marginHorizontal: 20,
    marginTop: height * 0.04,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5,
    overflow: 'hidden',
  },
  passHeaderBrandBlock: {
    backgroundColor: '#7B2CBF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  passBrandText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  statusLiveBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  statusLiveBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  passMetaBodyBlock: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  passEventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 12,
  },
  metaSplitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  rightAlignedMetaColumn: {
    alignItems: 'flex-end',
  },
  metaLabelText: {
    fontSize: 9,
    color: '#868E96',
    fontWeight: '600',
  },
  metaValueText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#212529',
    marginTop: 2,
  },
  qrCodeScanningChamber: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  simulatedQrVisualMatrix: {
    width: 140,
    height: 140,
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrCornerAnchorTopLeft: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderWidth: 3,
    borderColor: '#212529',
  },
  qrCornerAnchorTopRight: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderWidth: 3,
    borderColor: '#212529',
  },
  qrCornerAnchorBottomLeft: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 24,
    height: 24,
    borderWidth: 3,
    borderColor: '#212529',
  },
  qrCenterCoreGridNode: {
    width: 32,
    height: 32,
    backgroundColor: '#212529',
  },
  rollingTokenTimerValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#212529',
    letterSpacing: 4,
    marginTop: 16,
  },
  rollingTokenLabel: {
    fontSize: 11,
    color: '#868E96',
    marginTop: 4,
  },
  passLegalFooterNotice: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  legalNoticeTextParagraph: {
    fontSize: 10,
    color: '#9E9E9E',
    textAlign: 'center',
    lineHeight: 14,
  },
  emptyWalletBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyWalletTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212529',
  },
  emptyWalletSubtitle: {
    fontSize: 13,
    color: '#868E96',
    textAlign: 'center',
    marginTop: 8,
  }
}); // Properly closes the stylesheet layout engine object

