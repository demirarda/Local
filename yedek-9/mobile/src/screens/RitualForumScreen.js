import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import {
  fetchForumTargets,
  fetchForumComments,
  postForumComment,
  voteForumComment,
  repostToPulse,
  fetchRitualReposts,
  createModReport,
} from '../services/api';
import ReportModal from '../components/ReportModal';

const PRIMARY = '#f9a13d';

export default function RitualForumScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { ritualId, ritualTitle } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [comments, setComments] = useState([]);
  const [reposts, setReposts] = useState([]);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);

  const load = useCallback(async () => {
    if (!ritualId) return;
    try {
      setLoading(true);
      const meta = await fetchForumTargets(ritualId);
      const t = meta.targets || [];
      setTargets(t);
      if (!selectedTarget && t.length > 0) setSelectedTarget(t[0]);
    } catch (e) {
      Alert.alert('Forum', e.message || 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [ritualId, selectedTarget]);

  const loadComments = useCallback(async () => {
    if (!ritualId || !selectedTarget) return;
    try {
      const rows = await fetchForumComments(ritualId, {
        target_type: selectedTarget.target_type,
        target_id: selectedTarget.target_id || undefined,
      });
      setComments(rows);
    } catch (e) {
      console.warn('forum comments', e);
    }
  }, [ritualId, selectedTarget]);

  const loadReposts = useCallback(async () => {
    if (!ritualId) return;
    try {
      const rows = await fetchRitualReposts(ritualId, 30);
      setReposts(rows);
    } catch (e) {
      console.warn('forum reposts', e);
    }
  }, [ritualId]);

  useEffect(() => {
    load();
    loadReposts();
  }, [load, loadReposts]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handlePost = async () => {
    const text = draft.trim();
    if (!text || !selectedTarget) return;
    setPosting(true);
    try {
      await postForumComment(ritualId, {
        target_type: selectedTarget.target_type,
        target_id: selectedTarget.target_id,
        content: text,
      });
      setDraft('');
      await loadComments();
    } catch (e) {
      Alert.alert('Yorum', e.message || 'Gönderilemedi');
    } finally {
      setPosting(false);
    }
  };

  const handleVote = async (commentId, vote) => {
    try {
      await voteForumComment(commentId, vote);
      await loadComments();
    } catch (e) {
      Alert.alert('Oy', e.message || 'Başarısız');
    }
  };

  const handleRepost = async (commentId) => {
    try {
      await repostToPulse(ritualId, { comment_id: commentId });
      Alert.alert('Repost', 'Pulse\'a 24 saatlik repost oluşturuldu.');
      await loadReposts();
    } catch (e) {
      Alert.alert('Repost', e.message || 'Başarısız');
    }
  };

  if (!ritualId) {
    return (
      <View style={styles.center}>
        <Text>Ritual bulunamadı</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          Forum · {ritualTitle || 'Ritual'}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={PRIMARY} />
      ) : (
        <>
          <FlatList
            horizontal
            data={targets}
            keyExtractor={(item, i) => `${item.target_type}-${item.target_id || i}`}
            style={styles.targetRow}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.targetChip,
                  selectedTarget?.target_id === item.target_id &&
                    selectedTarget?.target_type === item.target_type &&
                    styles.targetChipActive,
                ]}
                onPress={() => setSelectedTarget(item)}
              >
                <Text style={styles.targetChipText} numberOfLines={1}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
          />

          {reposts.length > 0 ? (
            <View style={styles.repostSection}>
              <Text style={styles.repostSectionTitle}>Pulse Reposts ({reposts.length})</Text>
              {reposts.slice(0, 5).map((r) => (
                <View key={r.id} style={styles.repostCard}>
                  <Text style={styles.repostAuthor}>{r.user_name || 'Kullanici'}</Text>
                  <Text style={styles.repostSnippet} numberOfLines={2}>
                    {r.snippet || r.comment_content || r.memory_content || 'Repost'}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            renderItem={({ item }) => (
              <View style={styles.commentCard}>
                <Text style={styles.commentAuthor}>{item.user_name}</Text>
                <Text style={styles.commentBody}>{item.content}</Text>
                <View style={styles.commentActions}>
                  <TouchableOpacity onPress={() => handleVote(item.id, 1)}>
                    <Text style={styles.vote}>▲ {item.upvotes || 0}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleVote(item.id, -1)}>
                    <Text style={styles.vote}>▼ {item.downvotes || 0}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleRepost(item.id)}>
                    <Text style={styles.repost}>Pulse'a taşı</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setReportTarget({ id: item.id, type: 'forum' })}>
                    <Text style={[styles.vote, { color: '#b45309' }]}>Bildir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>Henüz yorum yok — ilk sen yaz.</Text>
            }
          />

          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              placeholder="Yorum yaz..."
              value={draft}
              onChangeText={setDraft}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, posting && { opacity: 0.6 }]}
              onPress={handlePost}
              disabled={posting}
            >
              <MaterialIcons name="send" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </>
      )}

      <ReportModal
        visible={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        reportType="forum"
        onReport={async (payload) => {
          try {
            await createModReport({
              targetType: 'forum',
              targetId: reportTarget?.id,
              ritualId,
              categoryKey: payload.category_key || payload.reason,
              description: payload.description,
            });
            Alert.alert('Rapor', 'Forum içeriği bildirildi');
            setReportTarget(null);
          } catch (e) {
            Alert.alert('Hata', e?.message || 'Rapor gönderilemedi');
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: { flex: 1, fontSize: 17, fontWeight: '700' },
  targetRow: { maxHeight: 48, paddingHorizontal: 12, paddingVertical: 8 },
  targetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#eee',
    marginRight: 8,
    maxWidth: 160,
  },
  targetChipActive: { backgroundColor: PRIMARY },
  targetChipText: { fontSize: 13, fontWeight: '600' },
  repostSection: { paddingHorizontal: 16, paddingBottom: 8 },
  repostSectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8, color: '#333' },
  repostCard: {
    backgroundColor: '#fff7ed',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  repostAuthor: { fontSize: 12, fontWeight: '700', color: PRIMARY },
  repostSnippet: { fontSize: 13, color: '#444', marginTop: 4 },
  commentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  commentAuthor: { fontWeight: '700', marginBottom: 4 },
  commentBody: { fontSize: 15, lineHeight: 20 },
  commentActions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  vote: { fontSize: 13, color: '#555' },
  repost: { fontSize: 13, color: PRIMARY, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#888', marginTop: 24 },
  composer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sendBtn: {
    backgroundColor: PRIMARY,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
