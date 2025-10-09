import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { useAppSettings } from '../../../../../src/context/AppSettings';
import { useUser } from '../../../../../src/context/UserContext';
import { supabase } from '../../../../../src/lib/supabaseClient';
import BaseScreen from '../../../../components/BaseScreen';

type Row = {
  id: string;
  user_id: string | null;
  audience: 'learner' | 'admin' | null;
  message: string;
  read: boolean | null;
  created_at: string | null;
  type: string | null;
  target: string | null;
};

export default function NotificationScreen() {
  const { accentColor, fontFamily, fontSize } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;
  const { user } = useUser();
  const navigation = useNavigation<any>();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRows = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('audience', 'learner')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error) setRows((data || []) as Row[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`notif_learner_list_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: 'audience=eq.learner' },
        (payload) => {
          const n: any = (payload as any).new || {};
          const o: any = (payload as any).old || {};
          const affected = (n?.user_id ?? o?.user_id) === user.id;
          if (affected) fetchRows();
        }
      )
      .subscribe();
    fetchRows();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, fetchRows]);

  const markAllAsRead = async () => {
    if (!user?.id) return;
    setRows(prev => prev.map(r => ({ ...r, read: true })));
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('audience', 'learner')
      .eq('user_id', user.id)
      .eq('read', false);
    if (error) {
      Alert.alert('Error', 'Failed to mark all as read.');
      fetchRows();
    }
  };

  const markOneAsRead = async (id: string) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, read: true } : r)));
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('audience', 'learner');
    if (error) {
      setRows(prev => prev.map(r => (r.id === id ? { ...r, read: false } : r)));
    }
  };

  const openTarget = (row: Row) => {
    const t = (row.target || '').trim();
    if (t) {
      const [kind, value] = t.split(':');
      switch ((kind || '').toLowerCase()) {
        case 'feedback':
          navigation.navigate('Feedback' as never, { focusId: value } as never);
          return;
        case 'lesson':
          navigation.navigate('Phonics' as never, { lessonId: value } as never);
          return;
        case 'game':
          navigation.navigate('Games' as never, { key: value } as never);
          return;
        case 'practice':
          navigation.navigate('MainPracticeScreen' as never);
          return;
        case 'screen':
          if (value) {
            navigation.navigate(value as never);
            return;
          }
          break;
        default:
          break;
      }
    }

    if ((row.type || '').toLowerCase() === 'feedback_reply') {
      navigation.navigate('Feedback' as never);
    } else if ((row.type || '').toLowerCase().startsWith('system')) {
      navigation.navigate('Dashboard' as never);
    } else {
    }
  };

  const renderItem = ({ item }: { item: Row }) => {
    const isUnread = item.read !== true;
    return (
      <TouchableOpacity
        onPress={async () => {
          if (isUnread) await markOneAsRead(item.id);
          openTarget(item);
        }}
        activeOpacity={0.9}
        style={[
          styles.card,
          { backgroundColor: isUnread ? accentColor : '#ddd' },
        ]}
      >
        <View style={styles.rowHead}>
          <Ionicons
            name={
              (item.type || '').startsWith('feedback')
                ? 'chatbubble-ellipses'
                : (item.type || '').startsWith('system')
                ? 'notifications'
                : 'alert-circle'
            }
            size={18}
            color="#000"
            style={{ marginRight: 8 }}
          />
          <Text style={[styles.message, { fontFamily, fontSize: fontSizeValue }]}>
            {item.message}
          </Text>
        </View>
        <Text style={[styles.timestamp, { fontFamily }]}>
          🕒 {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <BaseScreen title="Notifications">
      {rows.length > 0 && (
        <TouchableOpacity onPress={markAllAsRead} style={[styles.markReadBtn, { backgroundColor: accentColor }]}>
          <Text style={[styles.markReadText, { fontFamily }]}>Mark all as read</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={fetchRows}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={[styles.emptyText, { fontFamily }]}>No notifications yet.</Text>}
        renderItem={renderItem}
      />
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 100 },
  emptyText: { textAlign: 'center', color: '#555', fontSize: 16, marginTop: 40 },

  card: { borderRadius: 10, padding: 14, marginBottom: 12 },
  rowHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  message: { flex: 1, fontWeight: '600' },
  timestamp: { fontSize: 12, color: '#555' },

  markReadBtn: { alignSelf: 'center', marginBottom: 16, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  markReadText: { fontWeight: 'bold', color: '#333' },
});
