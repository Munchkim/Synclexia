import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppSettings } from '../../../context/AppSettings';
import { supabase } from '../../../lib/supabaseClient';
import BaseScreen from '../../../components/BaseScreen';

type Role = 'admin' | 'learner';
interface User {
  id: string;
  username: string | null;
  email: string | null;
  role: Role;
}

export default function AdminAccountsScreen() {
  const { accentColor, fontFamily, fontSize, bgColor } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'learners' | 'admins'>('learners');

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email, role')
      .order('role', { ascending: true })
      .order('username', { ascending: true, nullsFirst: true });

    if (error) {
      console.error(error);
      Alert.alert('Error', error.message);
    } else {
      setUsers((data || []) as User[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    if (filter === 'learners') return users.filter(u => u.role === 'learner');
    return users.filter(u => u.role === 'admin');
  }, [users, filter]);

  const handlePromoteDemote = async (userId: string, targetRole: Role) => {
    const { data: meData } = await supabase.auth.getUser();
    const isSelf = meData.user?.id === userId;

    if (isSelf) {
      Alert.alert('Blocked', 'You cannot change your own role.');
      return;
    }
    const { error } = await supabase.from('users').update({ role: targetRole }).eq('id', userId);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      fetchUsers();
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const { data: meData } = await supabase.auth.getUser();
    const isSelf = meData.user?.id === userId;

    if (isSelf) {
      Alert.alert('Blocked', 'You cannot delete your own account.');
      return;
    }

    Alert.alert('Delete Account', 'Are you sure? This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('users').delete().eq('id', userId);
          if (error) {
            Alert.alert('Error', error.message);
          } else {
            fetchUsers();
            Alert.alert('Success', 'User deleted.');
          }
        },
      },
    ]);
  };

  const renderUser = ({ item }: { item: User }) => {
    const lightBorder = '#e9ecef';
    const textDark = '#333';

    const isLearner = item.role === 'learner';

    return (
      <View style={[styles.card, { borderColor: lightBorder, backgroundColor: '#fff' }]}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.username, { fontFamily, fontSize: fontSizeValue, color: textDark }]}>
              {item.username || 'No Name'}
            </Text>
            <Text style={[styles.email, { fontFamily, fontSize: fontSizeValue - 2 }]}>
              {item.email}
            </Text>
            <Text style={[styles.role, { fontFamily }]}>Role: {item.role}</Text>
          </View>

          <View style={styles.actionsCol}>
          {item.role === 'learner' && (
            <TouchableOpacity
              onPress={() => handleDeleteUser(item.id)}
              style={[styles.smallBtn, { borderColor: '#e74c3c' }]}
            >
              <Ionicons name="trash" size={18} color="#e74c3c" />
              <Text style={[styles.smallBtnText, { fontFamily, color: '#e74c3c' }]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>

        </View>
      </View>
    );
  };

  const textDark = '#333';
  const lightBorder = '#e9ecef';

  return (
    <BaseScreen title="Manage Accounts" showBack>
      {/* Filter toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          onPress={() => setFilter('learners')}
          style={[
            styles.togglePill,
            {
              borderColor: filter === 'learners' ? accentColor : lightBorder,
              backgroundColor: filter === 'learners' ? '#fff' : '#fafafa',
            },
          ]}
        >
          <Ionicons
            name="school"
            size={16}
            color={filter === 'learners' ? accentColor : '#777'}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.toggleText,
              { fontFamily, color: filter === 'learners' ? textDark : '#666' },
            ]}
          >
            Show Learners
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setFilter('admins')}
          style={[
            styles.togglePill,
            {
              borderColor: filter === 'admins' ? accentColor : lightBorder,
              backgroundColor: filter === 'admins' ? '#fff' : '#fafafa',
            },
          ]}
        >
          <Ionicons
            name="shield-checkmark"
            size={16}
            color={filter === 'admins' ? accentColor : '#777'}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.toggleText,
              { fontFamily, color: filter === 'admins' ? textDark : '#666' },
            ]}
          >
            Show Admins
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={accentColor || '#666'} />
      ) : filteredUsers.length === 0 ? (
        <Text style={[styles.empty, { fontFamily }]}>
          {filter === 'learners' ? 'No learners found.' : 'No admins found.'}
        </Text>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          contentContainerStyle={styles.list}
        />
      )}
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },

  list: { paddingBottom: 40 },

  card: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionsCol: { alignItems: 'flex-end' },

  username: { fontWeight: '700' },
  email: { color: '#666', marginTop: 2 },
  role: { color: '#555', marginTop: 6, fontWeight: '600' },

  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  smallBtnText: {
    marginLeft: 6,
    fontWeight: '700',
    color: '#333',
  },

  empty: {
    textAlign: 'center',
    color: '#666',
    marginTop: 24,
  },
});
