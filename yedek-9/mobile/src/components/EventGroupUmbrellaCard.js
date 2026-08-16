import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { t } from '../i18n/stringTable';

/**
 * ZONE-EVENT şemsiye kartı — concept layer uses Ritual (not street "masa")
 */
export default function EventGroupUmbrellaCard({ umbrella, onOpenTable, onPress }) {
  const [expanded, setExpanded] = useState(false);
  if (!umbrella) return null;
  const tables = umbrella.tables || [];
  const n = umbrella.table_count || tables.length;

  return (
    <View style={styles.card}>
      <TouchableOpacity
        onPress={() => {
          setExpanded((v) => !v);
          onPress?.(umbrella);
        }}
        activeOpacity={0.8}
      >
        <Text style={styles.eyebrow}>ZONE-EVENT</Text>
        <Text style={styles.label}>{umbrella.label || umbrella.name}</Text>
        <Text style={styles.meta}>
          {t('event_group_ritual_count', 'tr', { n })} · {umbrella.joined || 0}/
          {umbrella.capacity || 0}
          {umbrella.suggest_other_tables ? ' · dolu Ritual var' : ''}
        </Text>
        <Text style={styles.tapHint}>
          {expanded ? 'Rituals gizle' : 'Rituals gör'}
        </Text>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.tableList}>
          {tables.map((row) => {
            const seats =
              row.seats_left != null
                ? Math.max(0, Number(row.seats_left) || 0)
                : Math.max(0, (Number(row.capacity) || 0) - (Number(row.joined) || 0));
            const full = Boolean(row.is_full) || seats <= 0;
            return (
              <View key={row.id} style={styles.tableRow}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => onOpenTable?.(row.id)}
                  disabled={full && !(row.suggest_other_tables || []).length}
                >
                  <Text style={styles.tableTitle}>{row.title}</Text>
                  <Text style={styles.tableMeta}>
                    {full ? 'Dolu' : `${seats} yer`} · {row.joined || 0}/{row.capacity || 0}
                  </Text>
                </TouchableOpacity>
                {full && (row.suggest_other_tables || []).length > 0 ? (
                  <View style={styles.suggestBox}>
                    <Text style={styles.suggestLabel}>{t('other_rituals')}</Text>
                    {(row.suggest_other_tables || []).slice(0, 3).map((o) => (
                      <TouchableOpacity key={o.id} onPress={() => onOpenTable?.(o.id)}>
                        <Text style={styles.suggestLink}>
                          → {o.title} ({o.seats_left} yer)
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <TouchableOpacity style={styles.openBtn} onPress={() => onOpenTable?.(row.id)}>
                    <Text style={styles.openBtnText}>{full ? 'Detay' : 'Ac'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f9a13d55',
  },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: '#f9a13d' },
  label: { fontSize: 16, fontWeight: '700', color: '#fff', marginTop: 4 },
  meta: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  tapHint: { fontSize: 11, color: '#f9a13d', marginTop: 8 },
  tableList: { marginTop: 12, gap: 10 },
  tableRow: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 12,
  },
  tableTitle: { color: '#fff', fontWeight: '600', fontSize: 14 },
  tableMeta: { color: '#9ca3af', fontSize: 12, marginTop: 2 },
  openBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#f9a13d',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  openBtnText: { fontWeight: '700', color: '#111', fontSize: 12 },
  suggestBox: { marginTop: 8 },
  suggestLabel: { fontSize: 11, color: '#fbbf24', fontWeight: '700' },
  suggestLink: { fontSize: 12, color: '#93c5fd', marginTop: 4 },
});
