import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { submitBatchFeedback, reportUser } from '../services/api';
import useAuthStore from '../store/authStore';

const FEEDBACK_OPTIONS = {
  green: { label: 'Comfortable/Positive', color: '#22c55e', emoji: '😊' },
  yellow: { label: 'Neutral', color: '#facc15', emoji: '😐' },
  red: { label: 'Uncomfortable', color: '#f97373', emoji: '😟' },
};

export default function ParticipantFeedbackScreen({ route, navigation }) {
  const { ritualId, participant } = route.params || {};
  const { user } = useAuthStore();
  const currentUserId = user?.id;

  const participantId = participant?.id || participant?.user_id;

  const [q1, setQ1] = useState(null);
  const [q2, setQ2] = useState(null);
  const [q3, setQ3] = useState('no'); // 'no' | 'little' | 'yes'
  const [privateNote, setPrivateNote] = useState('');
  const [meetAgain, setMeetAgain] = useState(null); // 'yes' | 'maybe' | 'no'
  const [submitting, setSubmitting] = useState(false);

  if (!ritualId || !currentUserId || !participantId) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.centerText}>Feedback unavailable.</Text>
      </View>
    );
  }

  const buildFeedbackPayload = () => {
    if (!q1 && !q2) {
      return [];
    }
    return [
      {
        feedback_type: 'p2p',
        to_user_id: participantId,
        q1_comfort: q1,
        q2_energy: q2,
      },
    ];
  };

  const handleSubmit = async () => {
    const feedbacks = buildFeedbackPayload();
    if (feedbacks.length === 0) {
      Alert.alert('Feedback', 'Lütfen en az bir soruyu yanıtla.');
      return;
    }

    try {
      setSubmitting(true);
      await submitBatchFeedback(ritualId, currentUserId, feedbacks);

       // Q3: inappropriate behavior -> safety report if needed
      if (q3 === 'little' || q3 === 'yes') {
        const reason =
          q3 === 'yes'
            ? 'inappropriate_behavior_yes'
            : 'inappropriate_behavior_a_little';
        try {
          await reportUser(currentUserId, participantId, reason, privateNote || null);
        } catch (e) {
          if (__DEV__) console.warn('Optional behavior report failed (non-fatal):', e?.message || e);
        }
      }

      Alert.alert('Teşekkürler', 'Katılımcı geri bildirimin kaydedildi.', [
        {
          text: 'Tamam',
          onPress: () =>
            navigation.replace('RitualComplete', {
              ritualId,
            }),
        },
      ]);
    } catch (error) {
      Alert.alert('Hata', error.message || 'Feedback gönderilemedi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Katilimci Geri Bildirimi</Text>
        <Text style={styles.subtitle}>
          Cevaplarin guven olusumuna yardim eder; baskalari goremez.
        </Text>

        {/* Participant summary + RS badge (if provided in route) */}
        <View style={styles.participantCard}>
          <View style={styles.participantAvatar}>
            <Text style={styles.participantInitial}>
              {(participant?.name || 'Anonymous').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.participantInfo}>
            <Text style={styles.participantName}>
              {participant?.name || 'Anonymous'}
            </Text>
            {participant?.fromRitualTitle && (
              <Text style={styles.participantContext}>
                Friend from {participant.fromRitualTitle}
              </Text>
            )}
          </View>
          {typeof participant?.rs_score === 'number' && (
            <View style={styles.rsPill}>
              <Text style={styles.rsPillText}>
                {Math.round(participant.rs_score)}
              </Text>
            </View>
          )}
        </View>

        {/* Q1 */}
        <View style={styles.section}>
          <Text style={styles.question}>
            Q1: How did you feel interacting with this person?
          </Text>
          <View style={styles.emojiRow}>
            {['green', 'yellow', 'red'].map((value) => {
              const option = FEEDBACK_OPTIONS[value];
              const selected = q1 === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.emojiButton,
                    selected && {
                      borderColor: option.color,
                      backgroundColor: option.color + '22',
                    },
                  ]}
                  onPress={() => setQ1(value)}
                >
                  <Text style={styles.emoji}>{option.emoji}</Text>
                  <Text
                    style={[
                      styles.emojiLabel,
                      selected && { color: option.color },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Q2 */}
        <View style={styles.section}>
          <Text style={styles.question}>
            Q2: Did this person fit the group energy?
          </Text>
          <View style={styles.choiceRow}>
            {[
              { key: 'green', label: 'Yes' },
              { key: 'yellow', label: 'Somewhat/Neutral' },
              { key: 'red', label: 'Not really' },
            ].map(({ key, label }) => {
              const option = FEEDBACK_OPTIONS[key];
              const selected = q2 === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.choiceButton,
                    selected && {
                      borderColor: option.color,
                      backgroundColor: option.color + '22',
                    },
                  ]}
                  onPress={() => setQ2(key)}
                >
                  <Text
                    style={[
                      styles.choiceLabel,
                      selected && { color: option.color },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Q3 inappropriate behavior */}
        <View style={styles.section}>
          <Text style={styles.question}>
            Q3: Was there inappropriate behavior?
          </Text>
          <View style={styles.choiceRow}>
            {[
              { key: 'no', label: 'No' },
              { key: 'little', label: 'A little' },
              { key: 'yes', label: 'Yes' },
            ].map(({ key, label }) => {
              const selected = q3 === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.choiceButton,
                    selected && { borderColor: COLORS.accent, backgroundColor: '#fef3c7' },
                  ]}
                  onPress={() => setQ3(key)}
                >
                  <Text
                    style={[
                      styles.choiceLabel,
                      selected && { color: COLORS.accent },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Private note */}
        <View style={styles.section}>
          <Text style={styles.noteLabel}>
            Optional private note (only you and moderators will see this)
          </Text>
          <TextInput
            style={styles.noteInput}
            placeholder="Share any context that helps us keep rituals safe..."
            value={privateNote}
            onChangeText={setPrivateNote}
            multiline
            maxLength={400}
            placeholderTextColor={COLORS.textSecondary}
          />
        </View>

        {/* Meet again signal */}
        <View style={styles.section}>
          <Text style={styles.question}>
            Would you like to meet this person again? (optional)
          </Text>
          <Text style={styles.helperText}>
            This helps us suggest future rituals. It doesn’t affect RS.
          </Text>
          <View style={styles.choiceRow}>
            {[
              { key: 'yes', label: 'Yes', color: '#22c55e' },
              { key: 'maybe', label: 'Maybe', color: '#eab308' },
              { key: 'no', label: 'No', color: '#ef4444' },
            ].map(({ key, label, color }) => {
              const selected = meetAgain === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.choiceButton,
                    selected && {
                      borderColor: color,
                      backgroundColor: color + '22',
                    },
                  ]}
                  onPress={() => setMeetAgain(key)}
                >
                  <Text
                    style={[
                      styles.choiceLabel,
                      selected && { color },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        <Text style={styles.submitLabel}>
          {submitting ? 'Submitting…' : 'Submit Feedback'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const COLORS = {
  background: '#050608',
  card: '#15151A',
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1AA',
  accent: '#F4B000',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  centerText: {
    color: COLORS.textSecondary,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  backLink: { marginBottom: 8 },
  backLinkText: { color: COLORS.textSecondary, fontWeight: '600' },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    marginBottom: 16,
  },
  participantAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#27272f',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  participantInitial: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  participantContext: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  rsPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
  },
  rsPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
  },
  question: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  section: {
    marginTop: 20,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  emojiButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#27272f',
    alignItems: 'center',
    backgroundColor: '#111111',
  },
  emoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  emojiLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  choiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  choiceButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#27272f',
    alignItems: 'center',
    backgroundColor: '#111111',
  },
  choiceLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  noteLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  noteInput: {
    backgroundColor: '#111111',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 80,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: '#27272f',
    fontSize: 13,
  },
  helperText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  submitButton: {
    margin: 16,
    borderRadius: 999,
    paddingVertical: 14,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
});

