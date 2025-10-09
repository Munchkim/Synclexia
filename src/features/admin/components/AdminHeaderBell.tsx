import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../../src/lib/supabaseClient';
import { fetchAdminUnreadCount } from '../../../features/notifications/api';

export default function AdminHeaderBell() {
  const nav = useNavigation<any>();
  const [unread, setUnread] = React.useState(0);

 const refresh = React.useCallback(async () => {
  const n = await fetchAdminUnreadCount();
  console.log('[AdminHeaderBell] unread from DB =', n);
  setUnread(n);
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

  return (
    <TouchableOpacity onPress={() => nav.navigate('AdminNotifications')} style={styles.wrap}>
      <Ionicons name="notifications-outline" size={22} color="#222" />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>{unread}</Text>
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
