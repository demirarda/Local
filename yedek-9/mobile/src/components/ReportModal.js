import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { fetchModCategories } from '../services/api';
import { t } from '../i18n/stringTable';

const FALLBACK_CATEGORIES = [
  { key: 'report_cat_uncomfortable', label: t('report_cat_uncomfortable') },
  { key: 'report_cat_boundary', label: t('report_cat_boundary') },
  { key: 'report_cat_mismatch', label: t('report_cat_mismatch') },
  { key: 'report_cat_other', label: t('report_cat_other') },
  { key: 'report_cat_csam', label: t('report_cat_csam') },
  { key: 'report_cat_sexual_assault', label: t('report_cat_sexual_assault') },
];

/**
 * v2 §5 — kategori katmanı. Modal açmak iz bırakmaz (API çağrısı yok / categories salt okuma).
 */
export default function ReportModal({
  visible,
  onClose,
  onReport,
  reportType = 'user',
  leaveAfter = false,
}) {
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [loadingCats, setLoadingCats] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSelectedKey(null);
    setDescription('');
    setSubmitted(false);
    let cancelled = false;
    (async () => {
      try {
        setLoadingCats(true);
        const rows = await fetchModCategories('tr');
        if (!cancelled && Array.isArray(rows) && rows.length) setCategories(rows);
      } catch (_e) {
        /* fallback */
      } finally {
        if (!cancelled) setLoadingCats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const handleReport = () => {
    if (!selectedKey) {
      Alert.alert('Kategori', 'Lütfen bir kategori seç');
      return;
    }
    onReport({
      report_type: reportType,
      target_type: reportType,
      category_key: selectedKey,
      reason: selectedKey,
      description: description.trim() || null,
      leave_after: Boolean(leaveAfter),
    });
    setSubmitted(true);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {leaveAfter ? 'Bildir ve ayrıl' : 'Bildir'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {submitted ? (
            <View style={styles.confirmWrap}>
              <Text style={styles.confirmTitle}>Rapor iletildi</Text>
              <Text style={styles.confirmBody}>
                Paket moderasyon kuyruğuna alındı. Ham rapor RS’nize dokunmaz.
                {leaveAfter
                  ? ' Cezasız ayrıldın; bu Ritualde feedback veremezsin (alabilirsin).'
                  : ''}
              </Text>
              <TouchableOpacity
                style={styles.reportButton}
                onPress={() => {
                  setSubmitted(false);
                  onClose();
                }}
              >
                <Text style={styles.reportButtonText}>Tamam</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <ScrollView style={styles.content}>
                <Text style={styles.label}>Kategori</Text>
                {loadingCats ? (
                  <ActivityIndicator style={{ marginVertical: 12 }} color="#F44336" />
                ) : null}
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      styles.reasonButton,
                      selectedKey === cat.key && styles.reasonButtonActive,
                    ]}
                    onPress={() => setSelectedKey(cat.key)}
                  >
                    <Text
                      style={[
                        styles.reasonText,
                        selectedKey === cat.key && styles.reasonTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}

                <Text style={styles.label}>Ek not (isteğe bağlı)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Kısa açıklama…"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  maxLength={500}
                  placeholderTextColor="#999"
                />
              </ScrollView>
              <View style={styles.footer}>
                <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelButtonText}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.reportButton, !selectedKey && styles.reportButtonDisabled]}
                  onPress={handleReport}
                  disabled={!selectedKey}
                >
                  <Text style={styles.reportButtonText}>Gönder</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: { fontSize: 20, fontWeight: 'bold' },
  closeButton: { fontSize: 24, color: '#666' },
  content: { padding: 16 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 12, marginTop: 8 },
  reasonButton: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  reasonButtonActive: { backgroundColor: '#fff', borderColor: '#000' },
  reasonText: { fontSize: 16, color: '#333' },
  reasonTextActive: { fontWeight: '600' },
  textInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#333' },
  reportButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#F44336',
    alignItems: 'center',
  },
  reportButtonDisabled: { opacity: 0.5 },
  reportButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  confirmWrap: { padding: 20, gap: 12 },
  confirmTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  confirmBody: { fontSize: 14, color: '#4b5563', lineHeight: 20 },
});
