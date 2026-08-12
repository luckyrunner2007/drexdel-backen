import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { drexdelApiClient } from '../../services/api/client';
import { EncryptedTicket } from '../../@types/events';

const { height } = Dimensions.get('window');

export const TicketWallet: React.FC = () => {
  const [tickets, setTickets] = useState<EncryptedTicket[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [rollingToken, setRollingToken] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshingQr, setRefreshingQr] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentSelectedTicket = tickets.find(t => t.id === activeTicketId);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await drexdelApiClient.getMyTickets();
      if (res.success && res.data?.data) {
        const mapped = res.data.data.map((t: any) => ({
          ...t,
          purchaseTimestamp: t.createdAt,
        }));
        setTickets(mapped);
        if (mapped.length > 0 && !activeTicketId) {
          setActiveTicketId(mapped[0].id);
        }
      } else {
        setError(res.message || 'Failed to load tickets');
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [activeTicketId]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const rotateQr = useCallback(async () => {
    if (!activeTicketId) return;
    setRefreshingQr(true);
    try {
      const res = await drexdelApiClient.getTicketQr(activeTicketId);
      if (res.success && res.data?.data?.qrCodeString) {
        setRollingToken(res.data.data.qrCodeString);
      }
    } catch {
      // silent refresh failure; stale QR remains visible
    } finally {
      setRefreshingQr(false);
    }
  }, [activeTicketId]);

  useEffect(() => {
    if (!activeTicketId) return;
    rotateQr();
    const timer = setInterval(rotateQr, 30000);
    return () => clearInterval(timer);
  }, [activeTicketId, rotateQr]);

  const handleTabPress = useCallback((ticketId: string) => {
    setActiveTicketId(ticketId);
  }, []);

  const renderTicketTabs = ({ item }: { item: EncryptedTicket }) => {
    const isSelected = item.id === activeTicketId;
    const label = item.event?.title
      ? item.event.title.length > 18
        ? item.event.title.slice(0, 16) + '�'
        : item.event.title
      : 'Ticket';

    return (
      <TouchableOpacity
        style={[styles.miniTabButton, isSelected && styles.miniTabButtonActive]}
        onPress={() => handleTabPress(item.id)}
        activeOpacity={0.8}
      >
        <Text style={[styles.miniTabLabel, isSelected && styles.miniTabLabelActive]} numberOfLines={1}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '�';
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  if (loading) {
    return (
      <View style={styles.masterWalletContainer}>
        <View style={styles.offlineStatusBarBanner}>
          <Text style={styles.offlineStatusTextText}>Loading your secure passes...</Text>
        </View>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#7B2CBF" />
          <Text style={styles.loadingText}>Fetching tickets from vault</Text>
        </View>
      </View>
    );
  }

  if (error && tickets.length === 0) {
    return (
      <View style={styles.masterWalletContainer}>
        <View style={styles.offlineStatusBarBanner}>
          <Text style={styles.offlineStatusTextText}>? Cryptographic Vault Secured</Text>
        </View>
        <View style={styles.emptyWalletBox}>
          <Text style={styles.emptyWalletTitle}>Unable to load tickets</Text>
          <Text style={styles.emptyWalletSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadTickets}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.masterWalletContainer}>
      <View style={styles.offlineStatusBarBanner}>
        <Text style={styles.offlineStatusTextText}>? Cryptographic Vault Secured � QR auto-rotates every 30s</Text>
      </View>

      {tickets.length > 0 ? (
        <>
          <View style={styles.tabSliderWrapper}>
            <FlatList
              data={tickets}
              keyExtractor={item => item.id}
              renderItem={renderTicketTabs}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalTabsPadding}
            />
          </View>

          {currentSelectedTicket ? (
            <View style={styles.passBodyLayoutContainer}>
              <View style={styles.passHeaderBrandBlock}>
                <Text style={styles.passBrandText}>PROJECT DREXDEL PASS</Text>
                <View style={styles.statusLiveBadge}>
                  <Text style={styles.statusLiveBadgeText}>
                    {(currentSelectedTicket.status || 'booked').toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.passMetaBodyBlock}>
                <Text style={styles.passEventTitle} numberOfLines={2}>
                  {currentSelectedTicket.event?.title || 'Event Ticket'}
                </Text>

                <View style={styles.metaSplitRow}>
                  <View>
                    <Text style={styles.metaLabelText}>TIER</Text>
                    <Text style={styles.metaValueText}>{currentSelectedTicket.tier?.name || '�'}</Text>
                  </View>
                  <View style={styles.rightAlignedMetaColumn}>
                    <Text style={styles.metaLabelText}>DATE / TIME</Text>
                    <Text style={styles.metaValueText}>{formatDate(currentSelectedTicket.event?.date)}</Text>
                  </View>
                </View>

                <View style={[styles.metaSplitRow, { marginTop: 10 }]}>
                  <View>
                    <Text style={styles.metaLabelText}>LOCATION</Text>
                    <Text style={styles.metaValueText}>{currentSelectedTicket.event?.location || '�'}</Text>
                  </View>
                  <View style={styles.rightAlignedMetaColumn}>
                    <Text style={styles.metaLabelText}>PRICE</Text>
                    <Text style={styles.metaValueText}>
                      {currentSelectedTicket.tier
                        ? `${currentSelectedTicket.tier.price} ${currentSelectedTicket.tier.currency}`
                        : '�'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.qrCodeScanningChamber}>
                <View style={styles.simulatedQrVisualMatrix}>
                  <View style={styles.qrCornerAnchorTopLeft} />
                  <View style={styles.qrCornerAnchorTopRight} />
                  <View style={styles.qrCornerAnchorBottomLeft} />
                  <View style={styles.qrCenterCoreGridNode} />
                </View>

                <Text style={styles.rollingTokenTimerValue}>
                  {refreshingQr ? 'Refreshing�' : rollingToken || '���� ����'}
                </Text>
                <Text style={styles.rollingTokenLabel}>Security token updates every 30s</Text>
              </View>

              <View style={styles.passLegalFooterNotice}>
                <Text style={styles.legalNoticeTextParagraph}>
                  This encrypted pass contains zero balance tracking data. Gate staff verify entry codes using
                  sandboxed offline authentication hooks. Screenshots are useless after 30 seconds.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyWalletBox}>
              <Text style={styles.emptyWalletTitle}>Select a ticket</Text>
              <Text style={styles.emptyWalletSubtitle}>Choose a pass from the list above to view its secure QR.</Text>
            </View>
          )}
        </>
      ) : (
        <View style={styles.emptyWalletBox}>
          <Text style={styles.emptyWalletTitle}>Your Ticket Vault is Empty</Text>
          <Text style={styles.emptyWalletSubtitle}>
            Book a pass or explore local events around you to generate secure entry tokens.
          </Text>
        </View>
      )}
    </View>
  );

}
const styles = StyleSheet.create({
  masterWalletContainer: { flex: 1, backgroundColor: '#FAFAFE' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#495057', fontSize: 14, fontWeight: '600' },
  retryButton: { marginTop: 16, backgroundColor: '#7B2CBF', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  retryButtonText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  offlineStatusBarBanner: { backgroundColor: '#2A9D8F', paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  offlineStatusTextText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.3 },
  tabSliderWrapper: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E9ECEF', paddingVertical: 12 },
  horizontalTabsPadding: { paddingHorizontal: 12 },
  miniTabButton: { backgroundColor: '#F1F3F5', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14, marginHorizontal: 4, borderWidth: 1, borderColor: '#E9ECEF', maxWidth: 180 },
  miniTabButtonActive: { backgroundColor: '#7B2CBF', borderColor: '#7B2CBF' },
  miniTabLabel: { fontSize: 12, fontWeight: '600', color: '#495057' },
  miniTabLabelActive: { color: '#FFFFFF', fontWeight: '700' },
  passBodyLayoutContainer: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9ECEF', borderRadius: 24, marginHorizontal: 20, marginTop: height * 0.04, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 5, overflow: 'hidden' },
  passHeaderBrandBlock: { backgroundColor: '#7B2CBF', paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  passBrandText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold', letterSpacing: 1.5 },
  statusLiveBadge: { backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 4 },
  statusLiveBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' },
  passMetaBodyBlock: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#E9ECEF' },
  passEventTitle: { fontSize: 16, fontWeight: '700', color: '#212529', marginBottom: 12 },
  metaSplitRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  rightAlignedMetaColumn: { alignItems: 'flex-end' },
  metaLabelText: { fontSize: 9, color: '#868E96', fontWeight: '600' },
  metaValueText: { fontSize: 12, fontWeight: '700', color: '#212529', marginTop: 2 },
  qrCodeScanningChamber: { padding: 24, alignItems: 'center', backgroundColor: '#F8F9FA' },
  simulatedQrVisualMatrix: { width: 140, height: 140, backgroundColor: '#FFFFFF', padding: 8, borderWidth: 1, borderColor: '#DEE2E6', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  qrCornerAnchorTopLeft: { position: 'absolute', top: 8, left: 8, width: 24, height: 24, borderWidth: 3, borderColor: '#212529' },
  qrCornerAnchorTopRight: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderWidth: 3, borderColor: '#212529' },
  qrCornerAnchorBottomLeft: { position: 'absolute', bottom: 8, left: 8, width: 24, height: 24, borderWidth: 3, borderColor: '#212529' },
  qrCenterCoreGridNode: { width: 32, height: 32, backgroundColor: '#212529' },
  rollingTokenTimerValue: { fontSize: 28, fontWeight: '800', color: '#212529', letterSpacing: 4, marginTop: 16 },
  rollingTokenLabel: { fontSize: 11, color: '#868E96', marginTop: 4 },
  passLegalFooterNotice: { padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E9ECEF' },
  legalNoticeTextParagraph: { fontSize: 10, color: '#9E9E9E', textAlign: 'center', lineHeight: 14 },
  emptyWalletBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyWalletTitle: { fontSize: 16, fontWeight: '700', color: '#212529' },
  emptyWalletSubtitle: { fontSize: 13, color: '#868E96', textAlign: 'center', marginTop: 8 },
});