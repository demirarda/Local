import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { submitFeedback, submitBatchFeedback } from '../services/api';
import useAuthStore from '../store/authStore';
import { t } from '../i18n/stringTable';

const FEEDBACK_OPTIONS = {
  green: { label: 'Positive', color: '#4CAF50', emoji: '✅' },
  yellow: { label: 'Neutral', color: '#FF9800', emoji: '⚪' },
  red: { label: 'Negative', color: '#F44336', emoji: '❌' },
};

const RQ_CHIPS = {
  green: ['rq_g_1', 'rq_g_2', 'rq_g_3'],
  yellow: ['rq_y_1', 'rq_y_2', 'rq_y_3'],
  red: ['rq_r_1', 'rq_r_2', 'rq_r_3'],
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function seededShuffle(arr, seedText) {
  const a = [...arr];
  let seed = 0;
  const t = String(seedText || 'seed');
  for (let i = 0; i < t.length; i++) {
    seed = (seed * 31 + t.charCodeAt(i)) >>> 0;
  }
  const next = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function FeedbackModal({ visible, onClose, ritualId, participants = [] }) {
  const user = useAuthStore((s) => s.user);
  const [p2pFeedback, setP2pFeedback] = useState({});
  const [p2rFeeling, setP2rFeeling] = useState(null);
  const [p2rChip, setP2rChip] = useState(null);
  const [chipOptions, setChipOptions] = useState([]);
  const [r1SelfFeeling, setR1SelfFeeling] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleP2PFeedback = (userId, question, value) => {
    setP2pFeedback(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [question]: value,
      },
    }));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const fromUserId = user?.id;
      if (!fromUserId) {
        Alert.alert('Error', 'You must be logged in to submit feedback');
        return;
      }

      const feedbacks = [];

      // P2P feedbacks
      Object.keys(p2pFeedback).forEach(toUserId => {
        const feedback = p2pFeedback[toUserId];
        if (feedback.q1_comfort || feedback.q2_energy) {
          feedbacks.push({
            to_user_id: toUserId,
            feedback_type: 'p2p',
            q1_comfort: feedback.q1_comfort,
            q2_energy: feedback.q2_energy,
          });
        }
      });

      // Q1 P2R — ritual feeling (CF/IQ aggregate)
      if (p2rFeeling) {
        feedbacks.push({
          feedback_type: 'p2r',
          p2r_feeling: p2rFeeling,
          chip_id: p2rChip || undefined,
        });
      }

      // R1 self reflection
      if (r1SelfFeeling) {
        feedbacks.push({
          feedback_type: 'r1_self',
          r1_self: r1SelfFeeling,
        });
      }

      if (feedbacks.length === 0) {
        Alert.alert('No Feedback', 'Please provide at least one feedback');
        return;
      }

      await submitBatchFeedback(ritualId, fromUserId, feedbacks);

      Alert.alert('Success', 'Feedback submitted successfully!', [
        { text: 'OK', onPress: onClose },
      ]);

      // Reset state
      setP2pFeedback({});
      setP2rFeeling(null);
      setP2rChip(null);
      setChipOptions([]);
      setR1SelfFeeling(null);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const renderFeedbackButton = (value, selected, onPress) => {
    const option = FEEDBACK_OPTIONS[value];
    return (
      <TouchableOpacity
        style={[
          styles.feedbackButton,
          selected && { backgroundColor: option.color, borderColor: option.color },
        ]}
        onPress={onPress}
      >
        <Text style={styles.feedbackEmoji}>{option.emoji}</Text>
        <Text
          style={[
            styles.feedbackLabel,
            selected && styles.feedbackLabelSelected,
          ]}
        >
          {option.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Give Feedback</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Q1 P2R */}
            <View style={styles.feedbackSection}>
              <Text style={styles.sectionTitle}>How was this ritual? (P2R)</Text>
              <View style={styles.feedbackRow}>
                {['green', 'yellow', 'red'].map(value => (
                  <View key={value} style={styles.feedbackButtonContainer}>
                    {renderFeedbackButton(
                      value,
                      p2rFeeling === value,
                      () => {
                        setP2rFeeling(value);
                        setP2rChip(null);
                        setChipOptions(seededShuffle(RQ_CHIPS[value] || [], `${user?.id || 'anon'}:RQ_${value}`));
                      }
                    )}
                  </View>
                ))}
              </View>
              {p2rFeeling && chipOptions.length > 0 ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.questionText}>Neden? (opsiyonel, tek secim)</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {chipOptions.map((id) => (
                      <TouchableOpacity
                        key={id}
                        onPress={() => setP2rChip(id)}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: p2rChip === id ? '#111' : '#e0e0e0',
                          backgroundColor: p2rChip === id ? '#111' : '#fff',
                        }}
                      >
                        <Text style={{ fontSize: 11, color: p2rChip === id ? '#fff' : '#666' }}>{t(id)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>

            {/* R1 self */}
            <View style={styles.feedbackSection}>
              <Text style={styles.sectionTitle}>How did you feel about yourself? (R1)</Text>
              <View style={styles.feedbackRow}>
                {['green', 'yellow', 'red'].map(value => (
                  <View key={value} style={styles.feedbackButtonContainer}>
                    {renderFeedbackButton(
                      value,
                      r1SelfFeeling === value,
                      () => setR1SelfFeeling(value)
                    )}
                  </View>
                ))}
              </View>
            </View>

            {/* P2P Feedback */}
            {participants.length > 0 && (
              <View style={styles.feedbackSection}>
                <Text style={styles.sectionTitle}>Rate Participants</Text>
                {participants.map(participant => (
                  <View key={participant.id} style={styles.participantFeedback}>
                    <Text style={styles.participantName}>
                      {participant.name || 'Anonymous'}
                    </Text>

                    <View style={styles.questionRow}>
                      <Text style={styles.questionText}>Comfort / Respectful?</Text>
                      <View style={styles.feedbackRow}>
                        {['green', 'yellow', 'red'].map(value => (
                          <View key={value} style={styles.feedbackButtonContainer}>
                            {renderFeedbackButton(
                              value,
                              p2pFeedback[participant.id]?.q1_comfort === value,
                              () => handleP2PFeedback(participant.id, 'q1_comfort', value)
                            )}
                          </View>
                        ))}
                      </View>
                    </View>

                    <View style={styles.questionRow}>
                      <Text style={styles.questionText}>Energy / Vibe Fit?</Text>
                      <View style={styles.feedbackRow}>
                        {['green', 'yellow', 'red'].map(value => (
                          <View key={value} style={styles.feedbackButtonContainer}>
                            {renderFeedbackButton(
                              value,
                              p2pFeedback[participant.id]?.q2_energy === value,
                              () => handleP2PFeedback(participant.id, 'q2_energy', value)
                            )}
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
  },
  modalBody: {
    padding: 16,
  },
  feedbackSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  participantFeedback: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  participantName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  questionRow: {
    marginBottom: 12,
  },
  questionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  feedbackRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  feedbackButtonContainer: {
    flex: 1,
    marginHorizontal: 4,
  },
  feedbackButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  feedbackEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  feedbackLabel: {
    fontSize: 12,
    color: '#666',
  },
  feedbackLabelSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  submitButton: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
