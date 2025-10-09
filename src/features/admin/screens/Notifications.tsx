//screens/admin/Notifications.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import tinycolor from 'tinycolor2';

import BaseScreen from '../../../components/BaseScreen';
import { useAppSettings } from '../../../../src/context/AppSettings';
import { supabase } from '../../../../src/lib/supabaseClient';

const AUDIENCE = 'admin' as const;

type NotificationRow = {
  id: string;
  user_id: string | null;
  message: string;
  read: boolean | null;
  created_at: string | null;
  type: string | null;  
  target: string | null;
  audience: 'admin' | 'learner' | null;
};

type FilterTab = 'all' | 'unread';

export async function fetchAdminUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('audience', AUDIENCE)
    .eq('read', false);

  if (error || count == null) return 0;
  return count;
}

export default function AdminNotificationsScreen() {
  const { bgColor, accentColor, fontFamily, fontSize } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  const borderSoft = useMemo(
    () =>
      tinycolor(bgColor)
        .darken(tinycolor(bgColor).isLight() ? 6 : 12)
        .setAlpha(0.25)
        .toRgbString(),
    [bgColor]
  );
  const cardBg = '#fff';
  const textDark = '#222';
  const textMuted = '#666';

  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');

  const fetchingRef = useRef(false);

  const fetchRows = async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      if (!refreshing) setLoading(true);

      let query = supabase
        .from('notifications')
        .select('*')
        .eq('audience', AUDIENCE)        
        .order('created_at', { ascending: false });

      if (filter === 'unread') {
        query = query.eq('read', false);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Notifications fetch error:', error);
        Alert.alert('Error', 'Failed to load notifications.');
        return;
      }
      setRows((data || []) as NotificationRow[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      fetchingRef.current = false;
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel('notifications_admin_live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: 'audience=eq.admin' },
        () => fetchRows()
      )
      .subscribe();

    fetchRows();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRows();
  };

  const markReadToggle = async (id: string, nextVal: boolean) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, read: nextVal } : r)));

    const { error } = await supabase
      .from('notifications')
      .update({ read: nextVal })
      .eq('id', id)
      .eq('audience', AUDIENCE);

    if (error) {
      setRows(prev => prev.map(r => (r.id === id ? { ...r, read: !nextVal } : r)));
      Alert.alert('Error', 'Failed to update notification.');
    }
  };

  const markAllRead = async () => {
    if (rows.length === 0) return;
    setRows(prev => prev.map(r => ({ ...r, read: true })));

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('audience', AUDIENCE)
      .eq('read', false);

    if (error) {
      Alert.alert('Error', 'Failed to mark all as read.');
      fetchRows();
    }
  };

  const handleOpenTarget = (row: NotificationRow) => {
    if (!row.target) return;
    const [kind, value] = row.target.split(':');
    if (!kind || !value) return;


    switch (kind) {
      case 'feedback':
        break;
      case 'user':
        break;
      case 'lesson':
        break;
      default:
        break;
    }
  };

  const renderItem = ({ item }: { item: NotificationRow }) => {
    const isUnread = item.read !== true;
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          if (isUnread) markReadToggle(item.id, true);
          handleOpenTarget(item);
        }}
        style={[styles.card, { backgroundColor: cardBg, borderColor: borderSoft }]}
      >
        <View style={styles.cardLeft}>
          <View
            style={[
              styles.badge,
              { borderColor: borderSoft, backgroundColor: isUnread ? accentColor : '#fff' },
            ]}
          >
            <Ionicons
              name={
                item.type === 'feedback'
                  ? 'chatbubble-ellipses'
                  : item.type === 'system'
                  ? 'notifications'
                  : item.type === 'progress'
                  ? 'stats-chart'
                  : 'alert-circle'
              }
              size={18}
              color={isUnread ? '#fff' : textMuted}
            />
          </View>
        </View>

        <View style={styles.cardMid}>
          <Text style={[styles.message, { fontFamily, fontSize: fontSizeValue, color: textDark }]}>
            {item.message}
          </Text>
          {item.created_at ? (
            <Text style={[styles.when, { fontFamily, color: textMuted }]}>
              {new Date(item.created_at).toLocaleString()}
            </Text>
          ) : null}
        </View>

        <View style={styles.cardRight}>
          <TouchableOpacity
            onPress={() => markReadToggle(item.id, !item.read)}
            style={[
              styles.readPill,
              {
                borderColor: borderSoft,
                backgroundColor: isUnread
                  ? '#fff'
                  : tinycolor(accentColor).setAlpha(0.1).toRgbString(),
              },
            ]}
          >
            <Ionicons name={isUnread ? 'mail-unread' : 'mail-open'} size={18} color={textDark} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <BaseScreen title="Notifications" showBack>
      <View style={[styles.toolbar, { borderColor: borderSoft }]}>
        <View style={styles.tabs}>
          <TouchableOpacity
            onPress={() => setFilter('all')}
            style={[
              styles.tabBtn,
              filter === 'all' && { backgroundColor: '#fff', borderColor: borderSoft },
            ]}
          >
            <Text style={[styles.tabText, { fontFamily, color: textDark }]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter('unread')}
            style={[
              styles.tabBtn,
              filter === 'unread' && { backgroundColor: '#fff', borderColor: borderSoft },
            ]}
          >
            <Text style={[styles.tabText, { fontFamily, color: textDark }]}>Unread</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={markAllRead} style={[styles.markAllBtn, { borderColor: borderSoft }]}>
          <Ionicons name="checkmark-done" size={18} color={textDark} />
          <Text style={[styles.markAllText, { fontFamily, color: textDark }]}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: borderSoft }]} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="mail" size={36} color={textMuted} />
              <Text style={[styles.emptyText, { fontFamily, color: textMuted }]}>No notifications</Text>
            </View>
          ) : null
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentColor} />}
      />
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  tabs: { flexDirection: 'row', gap: 8 },
  tabBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1 },
  tabText: { fontWeight: '600' },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  markAllText: { fontWeight: '600' },
  list: { paddingVertical: 4 },
  sep: { height: 1, marginHorizontal: 8 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 10,
    borderRadius: 12, borderWidth: 1,
    marginHorizontal: 4, marginVertical: 6,
  },
  cardLeft: { marginRight: 10 },
  badge: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1,
  },
  cardMid: { flex: 1 },
  message: { fontWeight: '600' },
  when: { marginTop: 2, fontSize: 12 },
  cardRight: { marginLeft: 10 },
  readPill: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '600' },
});
