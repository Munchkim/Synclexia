import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BaseScreen from '../../../components/BaseScreen';
import { useAppSettings } from '../../../../src/context/AppSettings';
import { supabase } from '../../../../src/lib/supabaseClient';
import { useNavigation } from '@react-navigation/native';

type Group = {
  id: string;
  title: string;
  image_url: string | null;
  created_at: string;
  lessons_count?: number;
};

const SPECIAL_TITLES = new Set(['ALTERNATIVES 1', 'ALTERNATIVES 2', 'TRICKY WORDS']);

export default function AdminPhonicsScreen() {
  const { fontFamily } = useAppSettings();
  const navigation = useNavigation<any>();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    const { data: gData, error: gErr } = await supabase
      .from('phonics_groups')
      .select('id, title, image_url, created_at')
      .order('created_at', { ascending: true });

    if (gErr) {
      console.error(gErr);
      setGroups([]);
      setLoading(false);
      return;
    }

    // filter out Alternatives 1/2 & Tricky Words (no admin editing here)
    const filtered = (gData || []).filter(
      g => !SPECIAL_TITLES.has((g.title || '').toUpperCase())
    );

    // build per-group lesson counts
    let counts: Record<string, number> = {};
    if (filtered.length > 0) {
      const { data: lData } = await supabase.from('phonics_lessons').select('group_id');
      if (lData) {
        counts = lData.reduce((acc: Record<string, number>, cur: any) => {
          const k = cur.group_id ?? '';
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        }, {});
      }
    }

    const enriched = filtered.map(g => ({ ...g, lessons_count: counts[g.id] || 0 }));
    setGroups(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }: { item: Group }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate('AdminPhonicsGroup', { groupId: item.id, title: item.title })
      }
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, { fontFamily }]}>{item.title}</Text>
        <Text style={[styles.meta, { fontFamily }]}>{item.lessons_count} lessons</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#444" />
    </TouchableOpacity>
  );

  return (
    <BaseScreen title="Manage Phonics" showBack>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#666" />
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: '#666' }}>No groups were found.</Text>
            </View>
          }
        />
      )}
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e9eef3',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  cardTitle: { fontWeight: '700', color: '#1c1c1c', marginBottom: 2 },
  meta: { color: '#666', fontSize: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
