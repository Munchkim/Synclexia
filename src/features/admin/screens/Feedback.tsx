import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BaseScreen from '../../../components/BaseScreen';
import { useAppSettings } from '../../../context/AppSettings';
import { supabase } from '../../../lib/supabaseClient';

type TabKey = 'all' | 'resolved' | 'unresolved';

interface Feedback {
  id: string;
  user_id: string | null;
  content: string;
  rating: number | null;
  created_at: string;
  resolved: boolean | null;
  users?: { username?: string | null } | null;
}

interface Reply {
  id: string;
  feedback_id: string;
  admin_id: string | null;
  text: string;
  created_at: string;
}

export default function AdminFeedbackScreen() {
  const { fontFamily, fontSize } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  const [loading, setLoading] = useState(true);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [repliesByFeedback, setRepliesByFeedback] = useState<Record<string, Reply[]>>({});
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  const [replyForId, setReplyForId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const textDark = '#1c1c1c';
  const cardBg = '#ffffff';
  const border = '#e9eef3';

  async function fetchAll() {
    setLoading(true);

    const { data: raw, error: fbErr } = await supabase
      .from('feedbacks')
      .select(`
        id,
        user_id,
        content,
        rating,
        created_at,
        resolved,
        users:users!feedbacks_user_id_fkey ( username )
      `)
      .order('created_at', { ascending: false });

    if (fbErr) {
      console.error('fetch feedbacks error', fbErr);
      setFeedbacks([]);
      setRepliesByFeedback({});
      setLoading(false);
      return;
    }

    const fbData: Feedback[] = (raw ?? []).map((row: any) => {
      const u = Array.isArray(row.users) ? row.users[0] : row.users;
      return {
        id: row.id,
        user_id: row.user_id,
        content: row.content,
        rating: row.rating ?? 0,
        created_at: row.created_at,
        resolved: !!row.resolved,
        users: u ? { username: u.username ?? null } : null,
      };
    });

    setFeedbacks(fbData);

    if (fbData.length === 0) {
      setRepliesByFeedback({});
      setLoading(false);
      return;
    }

    const ids = fbData.map(f => f.id);
    const { data: rData, error: rErr } = await supabase
      .from('feedback_replies')
      .select('id,feedback_id,admin_id,body,created_at')
      .in('feedback_id', ids)
      .order('created_at', { ascending: true });

    if (rErr) {
      console.error('fetch replies error', rErr);
      setRepliesByFeedback({});
      setLoading(false);
      return;
    }

    const grouped: Record<string, Reply[]> = {};
    (rData || []).forEach((row: any) => {
      const r: Reply = {
        id: row.id,
        feedback_id: row.feedback_id,
        admin_id: row.admin_id,
        text: row.body ?? '',          
        created_at: row.created_at,
      };
      if (!grouped[r.feedback_id]) grouped[r.feedback_id] = [];
      grouped[r.feedback_id].push(r);
    });

    setRepliesByFeedback(grouped);
    setLoading(false);
  }

  useEffect(() => {
    const sub = supabase
      .channel('feedback_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedbacks' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback_replies' }, fetchAll)
      .subscribe();

    fetchAll();
    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  const filtered = useMemo(() => {
    if (activeTab === 'resolved') return feedbacks.filter(f => !!f.resolved);
    if (activeTab === 'unresolved') return feedbacks.filter(f => !f.resolved);
    return feedbacks;
  }, [feedbacks, activeTab]);

  const openReply = (feedbackId: string) => {
    setReplyForId(feedbackId);
    setReplyText('');
  };

  const sendReply = async () => {
    if (!replyForId || !replyText.trim()) return;

    const { data: ures, error: uerr } = await supabase.auth.getUser();
    const adminId = ures?.user?.id ?? null;
    if (uerr || !adminId) {
      Alert.alert('Not signed in', 'Please sign in again to send replies.');
      return;
    }

    setSending(true);

    const { data: inserted, error: rErr } = await supabase
      .from('feedback_replies')
      .insert({
        feedback_id: replyForId,
        admin_id: adminId,
        body: replyText.trim(),       
      })
      .select('id,feedback_id,admin_id,body,created_at')
      .single();

    if (rErr) {
      setSending(false);
      Alert.alert('Error', rErr.message);
      return;
    }

    if (inserted) {
      setRepliesByFeedback(prev => {
        const list = prev[replyForId] ? [...prev[replyForId]] : [];
        list.push({
          id: inserted.id,
          feedback_id: inserted.feedback_id,
          admin_id: inserted.admin_id,
          text: inserted.body ?? '',
          created_at: inserted.created_at,
        });
        return { ...prev, [replyForId]: list };
      });
    }

    const fb = feedbacks.find(f => f.id === replyForId);
    if (fb?.user_id) {
      await supabase.from('notifications').insert({
        user_id: fb.user_id,
        message: 'Your feedback has a new admin reply.',
        type: 'feedback_reply',
        target: `feedback:${replyForId}`,
        audience: 'learner',
      });
    }

    setSending(false);
    setReplyText('');
    setReplyForId(null);
  };

  const toggleResolved = async (feedbackId: string, newVal: boolean) => {
    setFeedbacks(prev =>
      prev.map(f => (f.id === feedbackId ? { ...f, resolved: newVal } : f))
    );

    const { error } = await supabase
      .from('feedbacks')
      .update({ resolved: newVal })
      .eq('id', feedbackId);

    if (error) {
      setFeedbacks(prev =>
        prev.map(f => (f.id === feedbackId ? { ...f, resolved: !newVal } : f))
      );
      Alert.alert('Error', error.message);
    }
  };

  const renderItem = ({ item }: { item: Feedback }) => {
    const replies = repliesByFeedback[item.id] ?? [];
    const chip = item.resolved ? 'Resolved' : 'Unresolved';

    return (
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { fontFamily, color: textDark }]}>
              {item.users?.username ?? 'Learner'}
            </Text>
            <Text style={[styles.timestamp, { fontFamily }]}>
              🕒 {new Date(item.created_at).toLocaleString()}
            </Text>
          </View>
          <View
            style={[
              styles.statusChip,
              { borderColor: item.resolved ? '#2ecc71' : '#e67e22' },
            ]}
          >
            <Text
              style={[
                styles.statusTxt,
                { fontFamily, color: item.resolved ? '#2c7f51' : '#7a4c13' },
              ]}
            >
              {chip}
            </Text>
          </View>
        </View>

        {typeof item.rating === 'number' && (
          <View style={styles.starsRow}>
            {[...Array(item.rating)].map((_, i) => (
              <Ionicons key={`s${i}`} name="star" size={18} color="#f1c40f" style={{ marginRight: 2 }} />
            ))}
            {[...Array(Math.max(0, 5 - (item.rating || 0)))].map((_, i) => (
              <Ionicons key={`o${i}`} name="star-outline" size={18} color="#ccc" style={{ marginRight: 2 }} />
            ))}
          </View>
        )}

        <Text style={[styles.content, { fontFamily, color: textDark }]}>
          {item.content}
        </Text>

        {replies.length > 0 && (
          <View style={styles.replyThread}>
            <Text style={[styles.threadLabel, { fontFamily }]}>Admin Replies</Text>
            {replies.map((r) => (
              <View key={r.id} style={styles.replyBubble}>
                <Text style={[styles.replyText, { fontFamily }]}>{r.text}</Text>
                <Text style={[styles.replyTs, { fontFamily }]}>
                  {new Date(r.created_at).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.smallBtn, { borderColor: border }]} onPress={() => openReply(item.id)}>
            <Ionicons name="chatbox-ellipses-outline" size={18} color={textDark} />
            <Text style={[styles.smallBtnTxt, { fontFamily }]}>Reply</Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            style={[styles.smallBtn, { borderColor: item.resolved ? '#2ecc71' : border }]}
            onPress={() => toggleResolved(item.id, !item.resolved)}
          >
            <Ionicons
              name={item.resolved ? 'checkmark-done-outline' : 'ellipse-outline'}
              size={18}
              color={item.resolved ? '#2ecc71' : textDark}
            />
            <Text style={[styles.smallBtnTxt, { fontFamily }]}>
              {item.resolved ? 'Mark Unresolved' : 'Mark Resolved'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <BaseScreen title="Manage Feedback" showBack>
      <View style={styles.filtersRow}>
        {(['all', 'resolved', 'unresolved'] as TabKey[]).map((key) => {
          const active = activeTab === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setActiveTab(key)}
              style={[
                styles.pill,
                { backgroundColor: active ? '#fff' : 'transparent', borderColor: active ? '#dfe6ee' : '#e6ebf1' },
              ]}
            >
              <Text style={[styles.pillText, { fontFamily, color: textDark, opacity: active ? 1 : 0.8 }]}>
                {key[0].toUpperCase() + key.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centerFill}><ActivityIndicator size="large" color="#666" /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.centerFill}>
          <Text style={[styles.emptyText, { fontFamily }]}>
            {activeTab === 'all'
              ? 'No feedback yet.'
              : activeTab === 'resolved'
              ? 'No resolved feedback.'
              : 'No unresolved feedback.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}

      <Modal visible={!!replyForId} transparent animationType="fade" onRequestClose={() => setReplyForId(null)}>
        <View style={styles.modalBackground}>
          <View style={[styles.replyBox, { backgroundColor: '#ffffff', borderColor: border }]}>
            <Text style={[styles.modalTitle, { fontFamily }]}>Write a reply</Text>
            <TextInput
              placeholder="Type your reply…"
              value={replyText}
              onChangeText={setReplyText}
              multiline
              style={[styles.input, { fontFamily, fontSize: fontSizeValue }]}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                disabled={sending || !replyText.trim()}
                style={[styles.cta, { backgroundColor: sending || !replyText.trim() ? '#cfd8e3' : '#ffffff', borderColor: border }]}
                onPress={sendReply}
              >
                <Text style={[styles.ctaTxt, { fontFamily, color: textDark }]}>{sending ? 'Sending…' : 'Send'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cta, { backgroundColor: '#ffffff', borderColor: border }]}
                onPress={() => { setReplyForId(null); setReplyText(''); }}
              >
                <Text style={[styles.ctaTxt, { fontFamily, color: '#555' }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  filtersRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderRadius: 20 },
  pillText: { fontWeight: '600' },

  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  userName: { fontWeight: '700' },
  timestamp: { fontSize: 12, color: '#666' },
  starsRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'center' },
  content: { fontSize: 14, marginBottom: 10 },

  statusChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  statusTxt: { fontSize: 12, fontWeight: '700' },

  replyThread: { gap: 8, marginTop: 6, marginBottom: 10 },
  threadLabel: { fontWeight: '700', color: '#333' },
  replyBubble: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef2f7', borderRadius: 10, padding: 10 },
  replyText: { color: '#222' },
  replyTs: { color: '#666', fontSize: 12, marginTop: 4 },

  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  smallBtnTxt: { fontWeight: '600', color: '#222' },

  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#666' },

  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  replyBox: { width: '90%', borderWidth: 1, borderRadius: 12, padding: 16 },
  modalTitle: { fontWeight: '700', fontSize: 16, marginBottom: 8 },
  input: { minHeight: 90, borderWidth: 1, borderColor: '#dfe6ee', borderRadius: 10, padding: 10, backgroundColor: '#fff', marginBottom: 10 },
  cta: { paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderRadius: 10 },
  ctaTxt: { fontWeight: '700' },
});
