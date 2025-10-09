import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import BaseScreen from '../../../../components/BaseScreen';
import { useAppSettings } from '../../../../../src/context/AppSettings';
import { useUser } from '../../../../../src/context/UserContext';
import { supabase } from '../../../../../src/lib/supabaseClient';

type FeedbackRow = {
  id: string;
  user_id: string | null;
  content: string;
  rating: number | null;
  created_at: string;
  resolved: boolean | null;
};

type ReplyRow = {
  id: string;
  feedback_id: string;
  admin_id: string | null;
  body: string;     
  created_at: string;
};

export default function FeedbackScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { bgColor, accentColor, fontFamily, fontSize } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;
  const { user } = useUser();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([]);
  const [repliesByFb, setRepliesByFb] = useState<Record<string, ReplyRow[]>>({});

  const [modalVisible, setModalVisible] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const listRef = useRef<FlatList>(null);
  const focusId: string | undefined = route.params?.focusId;

  const tokens = useMemo(() => {
    const chipResolved = '#2ecc71';
    const chipUnresolved = '#e67e22';
    return { chipResolved, chipUnresolved, cardBorder: '#e9eef3', replyBorder: '#eef2f7' };
  }, []);

  const fetchAll = useCallback(async () => {
    if (!user?.id) return;
    try {
      if (!refreshing) setLoading(true);

      const { data: fbRows, error: fbErr } = await supabase
        .from('feedbacks')
        .select('id, user_id, content, rating, created_at, resolved')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fbErr) throw fbErr;
      const fbs = (fbRows || []) as FeedbackRow[];
      setFeedbacks(fbs);

      if (fbs.length > 0) {
        const ids = fbs.map(f => f.id);
        const { data: rRows, error: rErr } = await supabase
          .from('feedback_replies')
          .select('id, feedback_id, admin_id, body, created_at')
          .in('feedback_id', ids)
          .order('created_at', { ascending: true });

        if (rErr) throw rErr;

        const grouped: Record<string, ReplyRow[]> = {};
        (rRows || []).forEach((r: ReplyRow) => {
          if (!grouped[r.feedback_id]) grouped[r.feedback_id] = [];
          grouped[r.feedback_id].push(r);
        });
        setRepliesByFb(grouped);
      } else {
        setRepliesByFb({});
      }
    } catch (e: any) {
      console.log('fetchAll feedback error', e?.message || e);
      Alert.alert('Error', 'Failed to load feedback.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, refreshing]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`feedback_learner_live_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feedbacks', filter: `user_id=eq.${user.id}` },
        fetchAll
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feedback_replies' },
        fetchAll
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user?.id, fetchAll]);

  useEffect(() => {
    if (!focusId || feedbacks.length === 0) return;
    const idx = feedbacks.findIndex(f => f.id === focusId);
    if (idx >= 0 && listRef.current) {
      setTimeout(() => listRef.current?.scrollToIndex({ index: idx, animated: true }), 250);
    }
  }, [focusId, feedbacks]);

  const handleSubmit = async () => {
    if (!user?.id) return;
    if (!feedbackText.trim() || rating <= 0) {
      Alert.alert('Incomplete', 'Please provide both feedback and a rating.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('feedbacks').insert({
      user_id: user.id,
      content: feedbackText.trim(),
      rating,
    });
    setSubmitting(false);
    if (error) return Alert.alert('Error', error.message);

    setFeedbackText('');
    setRating(0);
    setModalVisible(false);
    fetchAll();
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  const renderStars = (n: number) => (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {[1,2,3,4,5].map(i => (
        <Ionicons
          key={i}
          name={i <= (n || 0) ? 'star' : 'star-outline'}
          size={16}
          color="#f1c40f"
          style={{ marginRight: 2 }}
        />
      ))}
    </View>
  );

  const renderItem = ({ item }: { item: FeedbackRow }) => {
    const replies = repliesByFb[item.id] || [];
    const isResolved = !!item.resolved;

    return (
      <View style={[styles.card, { borderColor: tokens.cardBorder, backgroundColor: '#fff' }]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.timestamp, { fontFamily }]}>
              🕒 {new Date(item.created_at).toLocaleString()}
            </Text>
          </View>
          <View
            style={[
              styles.statusChip,
              { borderColor: isResolved ? tokens.chipResolved : tokens.chipUnresolved }
            ]}
          >
            <Text
              style={[
                styles.statusTxt,
                { fontFamily, color: isResolved ? '#2c7f51' : '#7a4c13' }
              ]}
            >
              {isResolved ? 'Resolved' : 'Unresolved'}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 4, marginBottom: 6 }}>{renderStars(item.rating || 0)}</View>

        <Text style={[styles.content, { fontFamily }]}>{item.content}</Text>

        {replies.length > 0 && (
          <View style={[styles.thread, { borderColor: tokens.replyBorder, backgroundColor: '#fafcff' }]}>
            <Text style={[styles.threadLabel, { fontFamily }]}>Admin Replies</Text>
            {replies.map(r => (
              <View key={r.id} style={[styles.replyBubble, { borderColor: tokens.replyBorder }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Ionicons name="shield-checkmark" size={16} color="#333" style={{ marginRight: 6 }} />
                  <Text style={[styles.replyMeta, { fontFamily }]}>
                    {new Date(r.created_at).toLocaleString()}
                  </Text>
                </View>
                <Text style={[styles.replyText, { fontFamily }]}>{r.body}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <BaseScreen title="Feedback" showBack>
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.cta, { borderColor: '#e6ebf1', backgroundColor: '#fff' }]}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="star" size={18} color="#000" />
          <Text style={[styles.ctaTxt, { fontFamily }]}>Leave Feedback</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cta, { borderColor: '#e6ebf1', backgroundColor: '#fff' }]}
          onPress={fetchAll}
        >
          <Ionicons name="refresh" size={18} color="#000" />
          <Text style={[styles.ctaTxt, { fontFamily }]}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerFill}><ActivityIndicator size="large" color="#666" /></View>
      ) : feedbacks.length === 0 ? (
        <View style={styles.centerFill}>
          <Text style={[styles.emptyText, { fontFamily }]}>No feedback yet.</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={feedbacks}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentColor} />}
          contentContainerStyle={{ paddingBottom: 28 }}
          onScrollToIndexFailed={() => {}}
        />
      )}

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackground}>
          <View style={[styles.modalCard, { backgroundColor: '#fff', borderColor: '#e9eef3' }]}>
            <Text style={[styles.modalTitle, { fontFamily, fontSize: fontSizeValue + 2 }]}>Your Feedback</Text>

            <View style={styles.starsRow}>
              {[1,2,3,4,5].map((val) => (
                <TouchableOpacity key={val} onPress={() => setRating(val)} activeOpacity={0.8}>
                  <Ionicons
                    name={val <= rating ? 'star' : 'star-outline'}
                    size={28}
                    color="#f6b100"
                    style={{ marginHorizontal: 2 }}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[
                styles.input,
                { fontFamily, fontSize: fontSizeValue, backgroundColor: '#fff', borderColor: '#e6ebf1' },
              ]}
              placeholder="Write your feedback here…"
              placeholderTextColor="#999"
              multiline
              value={feedbackText}
              onChangeText={setFeedbackText}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                disabled={submitting || !feedbackText.trim() || rating <= 0}
                style={[
                  styles.modalBtn,
                  { borderColor: '#e6ebf1', backgroundColor: submitting || !feedbackText.trim() || rating <= 0 ? '#cfd8e3' : accentColor }
                ]}
                onPress={handleSubmit}
              >
                <Text style={[styles.modalBtnTxt, { fontFamily, color: '#000' }]}>
                  {submitting ? 'Submitting…' : 'Submit'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: '#e6ebf1', backgroundColor: '#fff' }]}
                onPress={() => {
                  setModalVisible(false);
                  setFeedbackText('');
                  setRating(0);
                }}
              >
                <Text style={[styles.modalBtnTxt, { fontFamily, color: '#555' }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#666' },

  toolbar: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1,
  },
  ctaTxt: { fontWeight: '700', color: '#1c1c1c' },

  card: { borderWidth: 1, borderRadius: 14, padding: 12, marginHorizontal: 2, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  timestamp: { fontSize: 12, color: '#666' },
  statusChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  statusTxt: { fontSize: 12, fontWeight: '700' },

  content: { fontSize: 14, color: '#222', marginTop: 2 },

  thread: {
    marginTop: 10, borderWidth: 1, borderRadius: 10, padding: 10,
  },
  threadLabel: { fontWeight: '700', color: '#333', marginBottom: 6 },
  replyBubble: { backgroundColor: '#fff', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  replyMeta: { fontSize: 12, color: '#666' },
  replyText: { color: '#222' },

  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  modalCard: { width: '100%', borderWidth: 1, borderRadius: 14, padding: 16 },
  modalTitle: { fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', marginVertical: 8 },
  input: { minHeight: 110, borderWidth: 1, borderRadius: 10, padding: 12, textAlignVertical: 'top', marginBottom: 12 },
  modalBtn: { flex: 1, borderWidth: 1, borderRadius: 10, alignItems: 'center', paddingVertical: 12 },
  modalBtnTxt: { fontWeight: '800' },
});
