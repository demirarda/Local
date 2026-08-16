import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  fetchReports,
  updateReportStatus,
  fetchAnalyticsSummary,
  suspendUser,
  unsuspendUser,
  suspendRitual,
  unsuspendRitual,
  fetchModQueue,
  applyModLevelAction,
  fetchModAppeals,
  resolveModAppeal,
  sanctionFalseReporterApi,
  fetchCheckinFunnel,
  patchTotemOps,
  createCheckinFieldNote,
} from '../services/api';
import useAuthStore from '../store/authStore';

const PRIMARY_COLOR = '#f9a13d';
const DARK_BACKGROUND = '#0a0a0a';
const DARK_CARD = '#1a1a1a';
const DARK_TEXT_PRIMARY = '#f4f4f5';
const DARK_TEXT_SECONDARY = '#a1a1aa';

const STATUS_COLORS = {
  pending: '#FF9800',
  queued: '#FF9800',
  reviewed: '#2196F3',
  resolved: '#4CAF50',
  actioned: '#4CAF50',
  dismissed: '#9E9E9E',
};

const REPORT_TYPE_LABELS = {
  user: 'User',
  ritual: 'Ritual',
  message: 'Message',
  memory: 'Memory',
  quote: 'Quote',
  forum: 'Forum',
  venue: 'Venue',
  zone: 'Zone',
  spark: 'Spark',
  prelobby_message: 'Prelobby',
  share2person: 'Share-2-Person',
  share: 'Share',
  venue_badge: 'Venue badge',
  friend: 'Friend',
};

const SLA_HINT = 'SLA: güvenlik 2h · içerik 12h · genel 48h';

export default function ModerationScreen() {
  const navigation = useNavigation();
  const [reports, setReports] = useState([]);
  const [modQueue, setModQueue] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [queueMode, setQueueMode] = useState('mod'); // mod | legacy | appeals | funnel
  const [funnel, setFunnel] = useState(null);
  const [fieldNoteKey, setFieldNoteKey] = useState('');
  const [fieldNoteText, setFieldNoteText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null); // null = all
  const [selectedReportType, setSelectedReportType] = useState(null); // null = all
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const [secondModeratorId, setSecondModeratorId] = useState('');
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: true,
  });
  const [summary, setSummary] = useState(null);

  const { user } = useAuthStore();
  const currentUserId = user?.id;

  useEffect(() => {
    loadReports();
  }, [selectedStatus, selectedReportType, queueMode]);

  useEffect(() => {
    let cancelled = false;
    fetchAnalyticsSummary()
      .then((data) => { if (!cancelled) setSummary(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const loadReports = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPagination({ ...pagination, offset: 0 });
      }

      if (queueMode === 'funnel') {
        const data = await fetchCheckinFunnel({ days: 7, includeOps: true });
        setFunnel(data);
        setModQueue([]);
        setReports([]);
        setAppeals([]);
        if (!fieldNoteKey && Array.isArray(data?.pivot_checklist) && data.pivot_checklist[0]) {
          setFieldNoteKey(data.pivot_checklist[0]);
        }
      } else if (queueMode === 'mod') {
        const rows = await fetchModQueue({
          status: selectedStatus === 'pending' ? 'queued' : selectedStatus || 'queued',
          limit: pagination.limit,
          offset: reset ? 0 : pagination.offset,
        });
        setModQueue(reset ? rows : [...modQueue, ...rows]);
        setReports([]);
        setPagination({
          ...pagination,
          total: rows.length,
          offset: reset ? rows.length : pagination.offset + rows.length,
          hasMore: rows.length === pagination.limit,
        });
      } else if (queueMode === 'appeals') {
        const rows = await fetchModAppeals('pending');
        setAppeals(rows);
        setModQueue([]);
        setReports([]);
      } else {
        const params = {
          limit: pagination.limit,
          offset: reset ? 0 : pagination.offset,
        };
        if (selectedStatus) params.status = selectedStatus;
        if (selectedReportType) params.report_type = selectedReportType;
        const response = await fetchReports(params);
        const newReports = response.data || [];
        const total = response.total || 0;
        setReports(reset ? newReports : [...reports, ...newReports]);
        setModQueue([]);
        setPagination({
          ...pagination,
          total,
          offset: reset ? newReports.length : pagination.offset + newReports.length,
          hasMore: newReports.length === pagination.limit,
        });
      }
    } catch (error) {
      console.error('Error loading reports:', error);
      Alert.alert('Error', 'Failed to load reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyLevel = async (level) => {
    const report = selectedReport;
    if (!report?.id && !report?.target_id) {
      Alert.alert('Hedef yok', 'Rapor veya target_user_id gerekli');
      return;
    }
    const targetUserId = report.target_id || report.reported_user_id;
    const needsFourEyes = ['L2a', 'L2b', 'L3', 'L4'].includes(level);
    const needsFounder = ['L3', 'L4'].includes(level);
    const secondId = String(secondModeratorId || '').trim() || null;

    if (needsFounder && (!secondId || secondId === String(currentUserId))) {
      Alert.alert(
        'İkinci moderatör',
        'L3/L4 için senden farklı ikinci moderatör UUID gir (aşağıdaki alan).'
      );
      return;
    }
    if (['L2a', 'L2b'].includes(level) && secondId && secondId === String(currentUserId)) {
      Alert.alert('Four-eyes', 'İkinci moderatör kendin olamaz');
      return;
    }

    const run = async (founderApproved, { forceBelowThreshold = false, contentAction = null } = {}) => {
      try {
        setUpdating(true);
        const payload = {
          report_id: report.id,
          level,
          target_user_id: targetUserId,
          second_moderator_id: secondId,
          founder_approved: Boolean(founderApproved),
          note: `admin ${level}`,
          force_below_threshold: Boolean(forceBelowThreshold),
        };
        if (contentAction) payload.content_action = contentAction;
        await applyModLevelAction(payload);
        Alert.alert('Uygulandı', `${level} aksiyonu kaydedildi`);
        setShowDetailModal(false);
        setSelectedReport(null);
        setSecondModeratorId('');
        loadReports(true);
      } catch (e) {
        const msg = e.message || 'Aksiyon başarısız';
        if (level === 'L1' && /threshold/i.test(msg)) {
          Alert.alert('L1 eşik', msg, [
            { text: 'İptal', style: 'cancel' },
            {
              text: 'Eşiği aş (force)',
              style: 'destructive',
              onPress: () => run(false, { forceBelowThreshold: true }),
            },
          ]);
        } else {
          Alert.alert('Hata', msg);
        }
      } finally {
        setUpdating(false);
      }
    };

    if (level === 'L0') {
      const memoryId =
        report.target_type === 'memory' || report.target_type === 'quote'
          ? report.target_id
          : report.reported_memory_id || null;
      const isUserish = ['user', 'friend'].includes(report.target_type) || Boolean(targetUserId);
      Alert.alert('L0 içerik aksiyonu', 'Ne uygulansın? (kişiye ceza yok)', [
        { text: 'İptal', style: 'cancel' },
        ...(memoryId
          ? [
              {
                text: 'Memory kaldır',
                onPress: () => run(false, { contentAction: { memory_id: memoryId } }),
              },
            ]
          : []),
        ...(isUserish
          ? [
              {
                text: 'Profil düzelt (bio temizle)',
                onPress: () =>
                  run(false, {
                    contentAction: {
                      fix_profile: true,
                      profile_user_id: targetUserId,
                    },
                  }),
              },
            ]
          : []),
        {
          text: 'Sadece sicil notu',
          onPress: () => run(false),
        },
      ]);
      return;
    }

    if (!needsFourEyes) {
      await run(false);
      return;
    }

    if (needsFounder) {
      Alert.alert(
        `${level} onayı`,
        'L3/L4: iki bağımsız moderatör + founder onayı gerekir.',
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Founder ile uygula', onPress: () => run(true) },
        ]
      );
      return;
    }

    Alert.alert(
      `${level} onayı`,
      secondId
        ? 'L2 four-eyes: ikinci moderatör ile uygula.'
        : 'L2 four-eyes: ikinci moderatör yoksa founder onayı gerekir.',
      [
        { text: 'İptal', style: 'cancel' },
        ...(secondId
          ? [{ text: 'İki mod ile uygula', onPress: () => run(false) }]
          : []),
        { text: 'Founder ile uygula', onPress: () => run(true) },
      ]
    );
  };

  const handleFalseReporter = () => {
    const reporterId = selectedReport?.reporter_id;
    if (!reporterId) {
      Alert.alert('Yok', 'Raporcu ID bulunamadı');
      return;
    }
    Alert.alert(
      'Asılsız raporcu',
      'Kasıtlı asılsız rapor için L1 (veya tekrarında L2) uygula?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'L1',
          onPress: async () => {
            try {
              setUpdating(true);
              await sanctionFalseReporterApi({ reporterId, escalate: false });
              Alert.alert('Uygulandı', 'Asılsız raporcu L1');
              loadReports(true);
            } catch (e) {
              Alert.alert('Hata', e.message || 'Başarısız');
            } finally {
              setUpdating(false);
            }
          },
        },
        {
          text: 'Escalate L2',
          style: 'destructive',
          onPress: async () => {
            const secondId = String(secondModeratorId || '').trim();
            if (!secondId || secondId === String(currentUserId)) {
              Alert.alert('İkinci moderatör', 'Escalate için ikinci moderatör UUID gir');
              return;
            }
            try {
              setUpdating(true);
              await sanctionFalseReporterApi({
                reporterId,
                escalate: true,
                secondModeratorId: secondId,
              });
              Alert.alert('Uygulandı', 'Asılsız raporcu escalate');
              loadReports(true);
            } catch (e) {
              Alert.alert('Hata', e.message || 'Başarısız');
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadReports(true);
  };

  const handleStatusUpdate = async (reportId, newStatus) => {
    try {
      setUpdating(true);
      await updateReportStatus(reportId, newStatus, currentUserId);
      Alert.alert('Success', `Report marked as ${newStatus}`);
      setShowDetailModal(false);
      setSelectedReport(null);
      loadReports(true);
    } catch (error) {
      console.error('Error updating report status:', error);
      Alert.alert('Error', 'Failed to update report status');
    } finally {
      setUpdating(false);
    }
  };

  const handleSuspendUser = () => {
    const userId = selectedReport?.reported_user_id;
    if (!userId) return;
    Alert.alert(
      'Suspend user',
      'This will block the user from logging in. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suspend',
          style: 'destructive',
          onPress: async () => {
            try {
              setSuspending(true);
              await suspendUser(userId);
              Alert.alert('Success', 'User suspended');
              setShowDetailModal(false);
              setSelectedReport(null);
              loadReports(true);
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to suspend user');
            } finally {
              setSuspending(false);
            }
          },
        },
      ]
    );
  };

  const handleUnsuspendUser = () => {
    const userId = selectedReport?.reported_user_id;
    if (!userId) return;
    Alert.alert('Unsuspend user', 'Restore this user\'s access?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unsuspend',
        onPress: async () => {
          try {
            setSuspending(true);
            await unsuspendUser(userId);
            Alert.alert('Success', 'User unsuspended');
            setShowDetailModal(false);
            setSelectedReport(null);
            loadReports(true);
          } catch (e) {
            Alert.alert('Error', e.message || 'Failed to unsuspend user');
          } finally {
            setSuspending(false);
            }
        },
      },
    ]);
  };

  const handleSuspendRitual = () => {
    const ritualId = selectedReport?.reported_ritual_id;
    if (!ritualId) return;
    Alert.alert(
      'Suspend ritual',
      'This will hide the ritual from Pulse and City Rhythm. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suspend',
          style: 'destructive',
          onPress: async () => {
            try {
              setSuspending(true);
              await suspendRitual(ritualId);
              Alert.alert('Success', 'Ritual suspended');
              setShowDetailModal(false);
              setSelectedReport(null);
              loadReports(true);
            } catch (e) {
              Alert.alert('Error', e.message || 'Failed to suspend ritual');
            } finally {
              setSuspending(false);
            }
          },
        },
      ]
    );
  };

  const handleUnsuspendRitual = () => {
    const ritualId = selectedReport?.reported_ritual_id;
    if (!ritualId) return;
    Alert.alert('Unsuspend ritual', 'Show this ritual again in listings?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unsuspend',
        onPress: async () => {
          try {
            setSuspending(true);
            await unsuspendRitual(ritualId);
            Alert.alert('Success', 'Ritual unsuspended');
            setShowDetailModal(false);
            setSelectedReport(null);
            loadReports(true);
          } catch (e) {
            Alert.alert('Error', e.message || 'Failed to unsuspend ritual');
          } finally {
            setSuspending(false);
          }
        },
      },
    ]);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderReportItem = ({ item }) => {
    const statusColor = STATUS_COLORS[item.status] || '#9E9E9E';
    const typeKey = item.target_type || item.report_type;
    const reason = item.category_key || item.reason;
    const corr = item.correlation_score != null ? Number(item.correlation_score).toFixed(2) : null;
    const ai = typeof item.ai_suggestion === 'string'
      ? (() => { try { return JSON.parse(item.ai_suggestion); } catch { return null; } })()
      : item.ai_suggestion;
    const slaLeft = item.sla_hours_remaining != null ? Number(item.sla_hours_remaining).toFixed(1) : null;

    return (
      <TouchableOpacity
        style={styles.reportCard}
        onPress={() => {
          setSelectedReport(item);
          setShowDetailModal(true);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.reportHeader}>
          <View style={styles.reportTypeBadge}>
            <Text style={styles.reportTypeText}>
              {REPORT_TYPE_LABELS[typeKey] || typeKey}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {String(item.status || '').toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.reasonText}>{reason}</Text>
        {corr != null ? (
          <Text style={styles.metaText}>Korelasyon {corr} · AI {ai?.level || '—'} ({ai?.confidence != null ? Math.round(ai.confidence * 100) : '—'}%)</Text>
        ) : null}
        {slaLeft != null ? (
          <Text style={styles.metaText}>SLA kalan ~{slaLeft}h · lane {item.queue_lane || 'general'}</Text>
        ) : null}

        <View style={styles.reportMeta}>
          <Text style={styles.metaText}>
            Reporter: {item.reporter_name || 'Unknown'}
          </Text>
          {item.reported_user_name != null && (
            <Text style={styles.metaText}>
              Reported User: {item.reported_user_name}
            </Text>
          )}
          {item.target_id != null && (
            <Text style={styles.metaText}>Target: {String(item.target_id).slice(0, 8)}…</Text>
          )}
          <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDetailModal = () => {
    if (!selectedReport) return null;

    const statusColor = STATUS_COLORS[selectedReport.status] || '#9E9E9E';
    const canUpdate = selectedReport.status === 'pending' || selectedReport.status === 'queued';
    const isMod = Boolean(selectedReport.target_type || selectedReport.package_json || selectedReport.correlation_score != null);
    const ai = typeof selectedReport.ai_suggestion === 'string'
      ? (() => { try { return JSON.parse(selectedReport.ai_suggestion); } catch { return null; } })()
      : selectedReport.ai_suggestion;
    const pkg = typeof selectedReport.package_json === 'string'
      ? (() => { try { return JSON.parse(selectedReport.package_json); } catch { return {}; } })()
      : (selectedReport.package_json || {});

    return (
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowDetailModal(false);
          setSelectedReport(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Details</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowDetailModal(false);
                  setSelectedReport(null);
                }}
              >
                <MaterialIcons name="close" size={24} color={DARK_TEXT_PRIMARY} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Type</Text>
                <Text style={styles.detailValue}>
                  {REPORT_TYPE_LABELS[selectedReport.report_type] || selectedReport.report_type}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Status</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {selectedReport.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Reason</Text>
                <Text style={styles.detailValue}>{selectedReport.reason}</Text>
              </View>

              {selectedReport.description && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Description</Text>
                  <Text style={styles.detailValue}>{selectedReport.description}</Text>
                </View>
              )}

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Reporter</Text>
                <Text style={styles.detailValue}>
                  {selectedReport.reporter_name || 'Unknown'} (ID: {selectedReport.reporter_id?.substring(0, 8)}...)
                </Text>
              </View>

              {selectedReport.reported_user_id && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Reported User</Text>
                  <Text style={styles.detailValue}>
                    {selectedReport.reported_user_name || '—'} (ID: {selectedReport.reported_user_id?.substring(0, 8)}...)
                  </Text>
                </View>
              )}

              {selectedReport.reported_ritual_id && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Reported Ritual</Text>
                  <Text style={styles.detailValue}>
                    {selectedReport.reported_ritual_title || '—'} (ID: {selectedReport.reported_ritual_id?.substring(0, 8)}...)
                  </Text>
                </View>
              )}

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Created At</Text>
                <Text style={styles.detailValue}>{formatDate(selectedReport.created_at)}</Text>
              </View>

              {selectedReport.reviewed_at && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Reviewed At</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedReport.reviewed_at)}</Text>
                </View>
              )}
            </ScrollView>

            {isMod && canUpdate ? (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>L merdiveni · {SLA_HINT}</Text>
                <Text style={styles.detailValue}>
                  AI: {ai?.level || '—'} · {ai?.rationale || ''}
                </Text>
                <Text style={styles.metaText}>
                  Korelasyon {selectedReport.correlation_score} · factors{' '}
                  {JSON.stringify(pkg.factors || {}).slice(0, 120)}
                </Text>
                <Text style={[styles.detailLabel, { marginTop: 10 }]}>İkinci moderatör UUID</Text>
                <TextInput
                  value={secondModeratorId}
                  onChangeText={setSecondModeratorId}
                  placeholder="L2+/L3-L4 four-eyes"
                  placeholderTextColor={DARK_TEXT_SECONDARY}
                  autoCapitalize="none"
                  style={{
                    marginTop: 6,
                    borderWidth: 1,
                    borderColor: '#3f3f46',
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    color: DARK_TEXT_PRIMARY,
                    backgroundColor: '#111',
                  }}
                />
                <View style={styles.modalActionsRow}>
                  {['L0', 'L1', 'L2a', 'L2b', 'L3', 'L4'].map((lvl) => (
                    <TouchableOpacity
                      key={lvl}
                      style={[styles.actionButtonSmall, styles.resolveButton, { marginBottom: 6 }]}
                      onPress={() => applyLevel(lvl)}
                      disabled={updating}
                    >
                      <Text style={styles.actionButtonText}>{lvl}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {selectedReport.reporter_id ? (
                  <TouchableOpacity
                    style={[styles.actionButtonSmall, styles.suspendButton, { marginTop: 8 }]}
                    onPress={handleFalseReporter}
                    disabled={updating}
                  >
                    <Text style={styles.actionButtonText}>Asılsız raporcu</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
            {selectedReport.reported_user_id && (
              <View style={styles.detailSection}>
                <View style={styles.modalActionsRow}>
                  <TouchableOpacity
                    style={[styles.actionButtonSmall, styles.suspendButton]}
                    onPress={handleSuspendUser}
                    disabled={suspending}
                  >
                    <Text style={styles.actionButtonText}>Suspend user</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButtonSmall, styles.unsuspendButton]}
                    onPress={handleUnsuspendUser}
                    disabled={suspending}
                  >
                    <Text style={styles.actionButtonText}>Unsuspend user</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {selectedReport.reported_ritual_id && (
              <View style={styles.detailSection}>
                <View style={styles.modalActionsRow}>
                  <TouchableOpacity
                    style={[styles.actionButtonSmall, styles.suspendButton]}
                    onPress={handleSuspendRitual}
                    disabled={suspending}
                  >
                    <Text style={styles.actionButtonText}>Suspend ritual</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButtonSmall, styles.unsuspendButton]}
                    onPress={handleUnsuspendRitual}
                    disabled={suspending}
                  >
                    <Text style={styles.actionButtonText}>Unsuspend ritual</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {canUpdate && !isMod && (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.resolveButton]}
                  onPress={() => handleStatusUpdate(selectedReport.id, 'resolved')}
                  disabled={updating}
                >
                  <Text style={styles.actionButtonText}>Resolve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.dismissButton]}
                  onPress={() => handleStatusUpdate(selectedReport.id, 'dismissed')}
                  disabled={updating}
                >
                  <Text style={styles.actionButtonText}>Dismiss</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.reviewButton]}
                  onPress={() => handleStatusUpdate(selectedReport.id, 'reviewed')}
                  disabled={updating}
                >
                  <Text style={styles.actionButtonText}>Mark Reviewed</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={DARK_TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Moderation Dashboard</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Summary stats */}
      {summary && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{summary.total_users ?? '—'}</Text>
            <Text style={styles.summaryLabel}>Users</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{summary.total_rituals ?? '—'}</Text>
            <Text style={styles.summaryLabel}>Rituals</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{pagination.total}</Text>
            <Text style={styles.summaryLabel}>Reports</Text>
          </View>
        </View>
      )}

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { id: 'mod', label: 'Mod kuyruk' },
            { id: 'funnel', label: 'Check-in funnel' },
            { id: 'appeals', label: 'Itiraz' },
            { id: 'legacy', label: 'Legacy' },
          ].map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.filterChip, queueMode === m.id && styles.filterChipActive]}
              onPress={() => setQueueMode(m.id)}
            >
              <Text style={[styles.filterChipText, queueMode === m.id && styles.filterChipTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={[styles.metaText, { paddingHorizontal: 4, marginVertical: 6 }]}>{SLA_HINT}</Text>
        {queueMode !== 'funnel' ? (
        <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedStatus === null && styles.filterChipActive,
            ]}
            onPress={() => setSelectedStatus(null)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedStatus === null && styles.filterChipTextActive,
              ]}
            >
              All Status
            </Text>
          </TouchableOpacity>
          {['pending', 'reviewed', 'resolved', 'dismissed'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                selectedStatus === status && styles.filterChipActive,
              ]}
              onPress={() => setSelectedStatus(status)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedStatus === status && styles.filterChipTextActive,
                ]}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.typeFilters}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedReportType === null && styles.filterChipActive,
            ]}
            onPress={() => setSelectedReportType(null)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedReportType === null && styles.filterChipTextActive,
              ]}
            >
              All Types
            </Text>
          </TouchableOpacity>
          {['user', 'ritual', 'message', 'memory'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterChip,
                selectedReportType === type && styles.filterChipActive,
              ]}
              onPress={() => setSelectedReportType(type)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedReportType === type && styles.filterChipTextActive,
                ]}
              >
                {REPORT_TYPE_LABELS[type]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        </>
        ) : null}
      </View>

      {/* Reports List */}
      {loading && reports.length === 0 && modQueue.length === 0 && queueMode !== 'funnel' ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      ) : queueMode === 'funnel' ? (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={PRIMARY_COLOR} />
          }
        >
          {loading && !funnel ? (
            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          ) : (
            <>
              <Text style={styles.funnelTitle}>C1–C5 check-in funnel (7g)</Text>
              <Text style={styles.funnelRatio}>
                görüntüleme→join {funnel?.ratios?.view_to_join ?? '—'} · join→mühür{' '}
                {funnel?.ratios?.join_to_seal ?? '—'} · kapı terk {funnel?.ratios?.gate_abandon ?? '—'}
              </Text>
              <Text style={styles.funnelRatio}>
                pending/mühür {funnel?.ratios?.pending_to_seal ?? '—'}
                {funnel?.pending_alarm ? ' · ALARM >%15' : funnel?.pending_watch ? ' · izle >%10' : ''}
              </Text>
              {funnel?.pivot_saha ? (
                <>
                  <Text style={styles.funnelRatio}>
                    kapı→mühür ort {funnel.pivot_saha.door_seal?.avg_s ?? '—'}sn
                    {' · <'}
                    {funnel.pivot_saha.door_seal?.target_s ?? 20}sn {funnel.pivot_saha.door_seal?.on_target_n ?? 0}
                    {funnel.pivot_saha.door_seal?.c1_alarm ? ' · C1 ALARM >45sn' : ''}
                  </Text>
                  <Text style={styles.funnelRatio}>
                    pending çözülme {funnel.pivot_saha.pending_resolve?.avg_s ?? '—'}sn · walk-in{' '}
                    {funnel.pivot_saha.walkin_birth?.avg_min ?? '—'}dk · şerit takip{' '}
                    {funnel.pivot_saha.strip_follow?.follow_n ?? 0}/{funnel.pivot_saha.strip_follow?.opens ?? 0}
                  </Text>
                  <Text style={styles.metaText}>
                    söyle {funnel.pivot_saha.culture_paths?.say ?? 0} · göster {funnel.pivot_saha.culture_paths?.show ?? 0}
                    {' · TAG '}
                    {funnel.pivot_saha.culture_paths?.local_tag ?? 0} · telefon-ölü {funnel.pivot_saha.phone_dead?.n ?? 0}
                  </Text>
                </>
              ) : null}
              {funnel?.t1_t2 ? (
                <Text style={styles.metaText}>
                  T1 {funnel.t1_t2.t1} · T2 {funnel.t1_t2.t2} · T3 {funnel.t1_t2.t3} · pending {funnel.t1_t2.pending}
                </Text>
              ) : null}

              <Text style={styles.funnelSection}>C3 mühürsüz oturma</Text>
              {(funnel?.unsealed_sitting || []).length === 0 ? (
                <Text style={styles.metaText}>Açık oturma yok</Text>
              ) : (
                (funnel.unsealed_sitting || []).map((row) => (
                  <View key={row.ritual_id} style={styles.reportCard}>
                    <Text style={styles.reasonText}>{row.title || row.ritual_id}</Text>
                    <Text style={styles.metaText}>
                      {row.place} · mühürsüz {row.unsealed_sitting} · join {row.joined} · mühür {row.sealed}
                    </Text>
                  </View>
                ))
              )}

              <Text style={styles.funnelSection}>C5 white-glove totem kuyruğu</Text>
              {(funnel?.totem_ops_queue || []).length === 0 ? (
                <Text style={styles.metaText}>Kuyruk boş</Text>
              ) : (
                (funnel.totem_ops_queue || []).map((row) => (
                  <View key={row.id} style={styles.reportCard}>
                    <Text style={styles.reasonText}>{row.venue_name || row.venue_id}</Text>
                    <Text style={styles.metaText}>{row.status} · {row.note || 'not yok'}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <TouchableOpacity
                        style={styles.filterChip}
                        onPress={() =>
                          patchTotemOps(row.id, 'dispatched').then(() => loadReports(true)).catch((e) => Alert.alert('Totem', e.message))
                        }
                      >
                        <Text style={styles.filterChipText}>Yola çıktı</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.filterChip}
                        onPress={() =>
                          patchTotemOps(row.id, 'done').then(() => loadReports(true)).catch((e) => Alert.alert('Totem', e.message))
                        }
                      >
                        <Text style={styles.filterChipText}>Tamam</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}

              <Text style={styles.funnelSection}>C3 prova saha notu</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {(funnel?.pivot_checklist || []).map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[styles.filterChip, fieldNoteKey === item && styles.filterChipActive]}
                    onPress={() => setFieldNoteKey(item)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        fieldNoteKey === item && styles.filterChipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {item.slice(0, 42)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TextInput
                style={styles.funnelInput}
                placeholder="Saha notu"
                placeholderTextColor={DARK_TEXT_SECONDARY}
                value={fieldNoteText}
                onChangeText={setFieldNoteText}
                multiline
              />
              <TouchableOpacity
                style={[styles.filterChip, styles.filterChipActive, { alignSelf: 'flex-start', marginBottom: 12 }]}
                onPress={async () => {
                  try {
                    await createCheckinFieldNote({
                      checklistKey: fieldNoteKey,
                      note: fieldNoteText,
                    });
                    setFieldNoteText('');
                    loadReports(true);
                  } catch (e) {
                    Alert.alert('Saha notu', e.message);
                  }
                }}
              >
                <Text style={styles.filterChipTextActive}>Kaydet</Text>
              </TouchableOpacity>
              {(funnel?.field_notes || []).map((n) => (
                <View key={n.id} style={styles.reportCard}>
                  <Text style={styles.reasonText}>{n.checklist_key}</Text>
                  <Text style={styles.metaText}>{n.note}</Text>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      ) : queueMode === 'appeals' ? (
        <FlatList
          data={appeals}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.reportCard}
              onPress={() => {
                Alert.alert('Itiraz', item.reason || 'Itiraz', [
                  { text: 'Iptal', style: 'cancel' },
                  {
                    text: 'Onayla (uphold)',
                    onPress: () =>
                      resolveModAppeal(item.id, { decision: 'uphold' }).then(() => loadReports(true)),
                  },
                  {
                    text: 'Boz (overturn)',
                    style: 'destructive',
                    onPress: () =>
                      resolveModAppeal(item.id, { decision: 'overturn' }).then(() => loadReports(true)),
                  },
                ]);
              }}
            >
              <Text style={styles.reasonText}>{item.reason || 'Itiraz'}</Text>
              <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={PRIMARY_COLOR} />}
        />
      ) : (
        <FlatList
          data={queueMode === 'mod' ? modQueue : reports}
          renderItem={renderReportItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={PRIMARY_COLOR}
            />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No reports found</Text>
            </View>
          }
        />
      )}

      {renderDetailModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BACKGROUND,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: DARK_CARD,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: DARK_TEXT_PRIMARY,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: DARK_CARD,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#27272a',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: DARK_TEXT_PRIMARY,
  },
  summaryLabel: {
    fontSize: 11,
    color: DARK_TEXT_SECONDARY,
    marginTop: 4,
  },
  filtersContainer: {
    backgroundColor: DARK_CARD,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#27272a',
    marginHorizontal: 6,
  },
  filterChipActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  filterChipText: {
    fontSize: 14,
    color: DARK_TEXT_SECONDARY,
  },
  filterChipTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  typeFilters: {
    marginTop: 8,
  },
  listContent: {
    padding: 16,
  },
  reportCard: {
    backgroundColor: DARK_CARD,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportTypeBadge: {
    backgroundColor: '#27272a',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reportTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: DARK_TEXT_PRIMARY,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  reasonText: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK_TEXT_PRIMARY,
    marginBottom: 8,
  },
  reportMeta: {
    marginTop: 8,
  },
  metaText: {
    fontSize: 12,
    color: DARK_TEXT_SECONDARY,
    marginBottom: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: DARK_TEXT_SECONDARY,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: DARK_CARD,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: DARK_TEXT_PRIMARY,
  },
  modalBody: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 12,
    color: DARK_TEXT_SECONDARY,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
    color: DARK_TEXT_PRIMARY,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  actionButtonSmall: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  suspendButton: {
    backgroundColor: '#b91c1c',
  },
  unsuspendButton: {
    backgroundColor: '#15803d',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  resolveButton: {
    backgroundColor: '#4CAF50',
  },
  dismissButton: {
    backgroundColor: '#9E9E9E',
  },
  reviewButton: {
    backgroundColor: '#2196F3',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  funnelTitle: {
    color: DARK_TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  funnelRatio: {
    color: DARK_TEXT_PRIMARY,
    fontSize: 13,
    marginBottom: 6,
  },
  funnelSection: {
    color: DARK_TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  funnelInput: {
    backgroundColor: DARK_CARD,
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    color: DARK_TEXT_PRIMARY,
    padding: 12,
    minHeight: 72,
    marginTop: 8,
    marginBottom: 8,
  },
});
