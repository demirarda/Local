import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getShareTypeMeta } from './ShareObjectBubble';
import { fetchShareableObjects } from '../services/api';

export const SHARE_TYPE_GROUPS = [
  {
    title: 'Mekan & Ritual',
    types: ['ritual_send', 'venue_invite', 'friend_joining'],
  },
  {
    title: 'Ani & Icerik',
    types: ['memory', 'quote', 'photo', 'playlist', 'quote_challenge'],
  },
  {
    title: 'Sosyal',
    types: ['reaction_geliyorum', 'reaction_baktim', 'badge', 'passport'],
  },
  {
    title: 'Forum',
    types: ['forum_thread', 'forum_repost', 'forward'],
  },
];

export const PUBLIC_SHARE_TYPES = new Set([
  'venue_invite',
  'ritual_send',
  'friend_joining',
  'reaction_geliyorum',
  'reaction_baktim',
]);

export default function ShareObjectPicker({
  visible,
  onClose,
  selectedType,
  onSelectType,
  selectedObject,
  onSelectObject,
}) {
  const [shareables, setShareables] = useState([]);
  const [loadingShareables, setLoadingShareables] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const needsPicker = ['memory', 'quote', 'photo', 'badge'].includes(selectedType);
    if (!needsPicker) {
      setShareables([]);
      return;
    }
    let mounted = true;
    (async () => {
      setLoadingShareables(true);
      try {
        const type = selectedType === 'badge' ? 'badge' : 'memory';
        const rows = await fetchShareableObjects(type);
        if (mounted) setShareables(rows || []);
      } catch (_e) {
        if (mounted) setShareables([]);
      } finally {
        if (mounted) setLoadingShareables(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [visible, selectedType]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>Nesne sec</Text>
          <ScrollView style={styles.scroll}>
            {SHARE_TYPE_GROUPS.map((group) => (
              <View key={group.title} style={styles.group}>
                <Text style={styles.groupTitle}>{group.title}</Text>
                {group.types.map((type) => {
                  const meta = getShareTypeMeta(type);
                  const active = type === selectedType;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.row, active && styles.rowActive]}
                      onPress={() => {
                        onSelectType(type);
                        onSelectObject?.(null);
                      }}
                    >
                      <MaterialIcons name={meta.icon} size={20} color={active ? '#f9a13d' : '#a1a1aa'} />
                      <Text style={[styles.label, active && styles.labelActive]}>{meta.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {['memory', 'quote', 'photo', 'badge'].includes(selectedType) ? (
              <View style={styles.group}>
                <Text style={styles.groupTitle}>Paylasilabilir nesneler (PUBLIC)</Text>
                {loadingShareables ? (
                  <ActivityIndicator color="#f9a13d" style={{ marginVertical: 12 }} />
                ) : shareables.length === 0 ? (
                  <Text style={styles.empty}>PUBLIC bir nesne bulunamadi.</Text>
                ) : (
                  shareables.map((obj) => {
                    const active = selectedObject?.id === obj.id;
                    return (
                      <TouchableOpacity
                        key={obj.id}
                        style={[styles.objectRow, active && styles.rowActive]}
                        onPress={() => onSelectObject?.(obj)}
                      >
                        <Text style={[styles.objectLabel, active && styles.labelActive]} numberOfLines={2}>
                          {obj.label || obj.id}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            ) : null}
          </ScrollView>
          <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneText}>Tamam</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '78%',
  },
  scroll: { maxHeight: '85%' },
  title: { color: '#f4f4f5', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  group: { marginBottom: 16 },
  groupTitle: {
    color: '#71717a',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  rowActive: { backgroundColor: 'rgba(249,161,61,0.08)' },
  label: { color: '#a1a1aa', fontSize: 15 },
  labelActive: { color: '#f9a13d', fontWeight: '700' },
  objectRow: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  objectLabel: { color: '#e4e4e7', fontSize: 14 },
  empty: { color: '#71717a', fontSize: 13, paddingVertical: 8 },
  doneBtn: {
    marginTop: 12,
    backgroundColor: '#f9a13d',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneText: { color: '#111', fontWeight: '800', fontSize: 14 },
});
