import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

/**
 * §11 — kişi kartı yalnız RitualFeedback (Q1+Q2 renk-only).
 * Eski deep-link / stack adı buraya düşerse inbox’a yönlendirilir.
 */
export default function ParticipantFeedbackScreen({ route, navigation }) {
  const ritualId = route.params?.ritualId;
  const ritual = route.params?.ritual;

  useEffect(() => {
    navigation.replace('RitualFeedback', { ritualId, ritual });
  }, [navigation, ritualId, ritual]);

  return (
    <View style={styles.center}>
      <ActivityIndicator color="#C9A227" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
