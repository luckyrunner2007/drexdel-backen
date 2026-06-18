/**
 * PROJECT DREXDEL - GROUP CHAT COORDINATION VOTING POLL CARD
 * FILE: src/components/Chat/VotingPollCard.tsx
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { VotingPoll } from '../../@types/events';

interface VotingPollCardProps {
  pollData: VotingPoll;
  currentUserId: string;
  onVoteOptionSelect: (optionEventId: string) => void;
}

export const VotingPollCard: React.FC<VotingPollCardProps> = ({
  pollData,
  currentUserId,
  onVoteOptionSelect,
}) => {
  // Extract total cumulative choices submitted across all available blocks
  const totalVotesCast = pollData.options.reduce((sum, opt) => sum + opt.votesCount, 0);

  return (
    <View style={styles.pollCardBodyContainer}>
      <Text style={styles.pollQuestionHeaderText}>📊 Group Choice: {pollData.question}</Text>
      
      {pollData.options.map((option) => {
        const hasVotedForThisOption = option.votedUserIds.includes(currentUserId);
        
        // Calculate percentages safely to avoid dividing by zero metrics
        const percentageScale = totalVotesCast > 0 
          ? (option.votesCount / totalVotesCast) * 100 
          : 0;

        return (
          <TouchableOpacity
            key={option.eventId}
            style={[styles.optionRowWrapper, hasVotedForThisOption && styles.optionRowActive]}
            onPress={() => onVoteOptionSelect(option.eventId)}
            activeOpacity={0.8}
          >
            {/* Visual background percentage feedback fill layer indicator rail bar */}
            <View style={[styles.visualPercentageFillBar, { width: `${percentageScale}%` }, hasVotedForThisOption && styles.fillActive]} />

            <View style={styles.contentLabelPillar}>
              <Text style={[styles.optionTitleLabel, hasVotedForThisOption && styles.optionTitleLabelActive]} numberOfLines={1}>
                {option.eventTitle}
              </Text>
              <Text style={styles.voteCountSubtitleLabel}>
                {option.votesCount} {option.votesCount === 1 ? 'vote' : 'votes'} ({Math.round(percentageScale)}%)
              </Text>
            </View>

            {hasVotedForThisOption && <Text style={styles.checkMarkerSymbolIcon}>✓</Text>}
          </TouchableOpacity>
        );
      })}
      
      <View style={styles.pollFooterMetaRow}>
        <Text style={styles.aggregateCounterText}>Total group votes submitted: {totalVotesCast}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  pollCardBodyContainer: {
    backgroundColor: '#FAFAFE',
    borderWidth: 1,
    borderColor: '#D8BBFF',
    borderRadius: 14,
    padding: 14,
    width: '100%',
    marginVertical: 4,
  },
  pollQuestionHeaderText: { fontSize: 14, fontWeight: '800', color: '#121214', marginBottom: 12 },
  optionRowWrapper: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 8,
    marginVertical: 4,
    height: 48,
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  optionRowActive: { borderColor: '#7B2CBF', borderWidth: 1.5 },
  visualPercentageFillBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#F1F3F5', // Soft background filler strip
    zIndex: 1,
  },
  fillActive: { backgroundColor: '#E0AAFF', opacity: 0.4 },
  contentLabelPillar: { zIndex: 2, flex: 1, justifyContent: 'center' },
  optionTitleLabel: { fontSize: 13, fontWeight: '700', color: '#495057' },
  optionTitleLabelActive: { color: '#7B2CBF' },
  voteCountSubtitleLabel: { fontSize: 10, color: '#868E96', fontWeight: '500', marginTop: 1 },
  checkMarkerSymbolIcon: { fontSize: 14, fontWeight: 'bold', color: '#7B2CBF', zIndex: 2, marginLeft: 6 },
  pollFooterMetaRow: { borderTopWidth: 1, borderTopColor: '#E9ECEF', marginTop: 10, paddingTop: 8 },
  aggregateCounterText: { fontSize: 10, color: '#ADB5BD', fontWeight: 'bold', textTransform: 'uppercase' },
});
