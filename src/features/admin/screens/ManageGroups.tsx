// screens/admin/phonics/AdminPhonicsGroupScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BaseScreen from '../../../components/BaseScreen';
import { useAppSettings } from '../../../../src/context/AppSettings';
import { supabase } from '../../../../src/lib/supabaseClient';
import { useNavigation, useRoute } from '@react-navigation/native';

type Lesson = {
  id: string;
  label: string;
  phoneme: string | null;
  order_index: number;
  audio_url: string | null;
  video_url: string | null;
  // ⬅️ removed tracing_url
};

type RouteParams = { groupId: string; title?: string };

export default function AdminPhonicsGroupScreen() {
  const { fontFamily } = useAppSettings();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { groupId, title: incomingTitle } = route.params as RouteParams;

  const [loading, setLoading] = useState(true);
  const [groupTitle, setGroupTitle] = useState<string>(incomingTitle || '');
  const [lessons, setLessons] = useState<Lesson[]>([]);

  async function load() {
    setLoading(true);

    const { data: gData } = await supabase
      .from('phonics_groups')
      .select('id, title')
      .eq('id', groupId)
      .maybeSingle();
    if (gData?.title) setGroupTitle(gData.title);

    const { data: lData, error: lErr } = await supabase
      .from('phonics_lessons')
      // ⬇️ no tracing fields in the select
      .select('id,label,phoneme,order_index,audio_url,video_url')
      .eq('group_id', groupId)
      .order('order_index', { ascending: true });

    if (lErr) {
      Alert.alert('Error', lErr.message);
      setLessons([]);
      setLoading(false);
      return;
    }

    setLessons((lData as Lesson[]) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [groupId]);

  const goToLesson = (lesson: Lesson) => {
    navigation.navigate('AdminPhonicsLesson', { lessonId: lesson.id, label: lesson.label });
  };

  const renderLesson = ({ item }: { item: Lesson }) => (
    <TouchableOpacity style={styles.lessonCard} onPress={() => goToLesson(item)}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.lessonTitle, { fontFamily }]}>{item.label}</Text>
        <Text style={styles.meta}>Order: {item.order_index}</Text>
        <Text style={[styles.meta, { marginTop: 2 }]}>
          {/* ⬇️ Configured only if audio or video exists */}
          {(item.video_url || item.audio_url) ? 'Configured' : 'Not configured yet'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#444" />
    </TouchableOpacity>
  );

  return (
    <BaseScreen title={groupTitle ? `Group: ${groupTitle}` : 'Group'} showBack>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#666" />
        </View>
      ) : (
        <FlatList
          data={lessons}
          keyExtractor={(l) => l.id}
          renderItem={renderLesson}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  lessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e9eef3',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  lessonTitle: { fontWeight: '700', color: '#1c1c1c' },
  meta: { color: '#666', fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
});
