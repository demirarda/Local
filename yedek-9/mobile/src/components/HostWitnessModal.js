import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { fetchPendingHostWitness, answerHostWitness } from '../services/api';

const ANSWERS = [
  { key: 'yes_issue', label: 'Evet, sorun yaşandı' },
  { key: 'no_issue', label: 'Hayır, sorun yoktu' },
  { key: 'unsure', label: 'Emin değilim' },
];

/** v2 §5 HOST-WITNESS — sessiz mikro-anket */
export default function HostWitnessModal() {
  const [item, setItem] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const rows = await fetchPendingHostWitness();
      setItem(Array.isArray(rows) && rows.length ? rows[0] : null);
    } catch (_e) {
      setItem(null);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const submit = async (answer) => {
    if (!item?.report_id || busy) return;
    setBusy(true);
    try {
      await answerHostWitness(item.report_id, answer);
      setItem(null);
      load();
    } catch (_e) {
      /* keep modal */
    } finally {
      setBusy(false);
    }
  };

  if (!item) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Ritualinde sorun yaşandı mı?</Text>
          <Text style={styles.sub}>
            Sessiz tanık anketi · kategori {item.category_key || '—'}
          </Text>
          {busy ? <ActivityIndicator color="#b45309" style={{ marginVertical: 12 }} /> : null}
          {ANSWERS.map((a) => (
            <TouchableOpacity
              key={a.key}
              style={styles.btn}
              onPress={() => submit(a.key)}
              disabled={busy}
            >
              <Text style={styles.btnText}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    gap: 10,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111' },
  sub: { fontSize: 13, color: '#666', marginBottom: 8 },
  btn: {
    backgroundColor: '#f5f5f5',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  btnText: { fontSize: 15, fontWeight: '600', color: '#111' },
});
