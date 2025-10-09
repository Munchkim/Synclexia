import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabaseClient';                 // <-- adjust if you use path aliases
import { fetchAdminUnreadCount } from '../../../features/notifications/api';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function AdminHeaderBell() {
  const nav = useNavigation<Nav>();
  const [unread, setUnread] = React.useState(0);

  const refresh = React.useCallback(async () => {
    try {
      const n = await fetchAdminUnreadCount();
      setUnread(Number.isFinite(n) ? n : 0);
    } catch (e) {
      // fail silently (badge just won't update)
      console.log('[AdminHeaderBell] refresh error', e);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      let active = true;

      (async () => {
        if (!active) return;
        await refresh();
      })();

      const ch = supabase
        .channel('notif_admin_badge')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: 'audience=eq.admin' },
          () => refresh()
        )
        .subscribe();

      return () => {
        active = false;
        try { supabase.removeChannel(ch); } catch {}
      };
    }, [refresh])
  );

  const max = 99;
  const show = Math.min(unread, max);
  const label = unread > max ? '99+' : String(show);

  return (
    <TouchableOpacity
      onPress={() => nav.navigate('AdminNotificationsScreen')}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityLabel="Open admin notifications"
      testID="admin-header-bell"
    >
      <Ionicons name="notifications-outline" size={22} color="#222" />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 8, paddingVertical: 6 },
  badge: {
    position: 'absolute', right: 4, top: 2,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#e53935',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
