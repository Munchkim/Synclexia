
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../../../src/lib/supabaseClient';
import BaseScreen from '../../../../components/BaseScreen';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppSettings } from '../../../../../src/context/AppSettings';
import tinycolor from 'tinycolor2';

type Lesson = {
  id: string;
  label: string;
  group_name: string;
  order_index: number;
  audio_url: string | null;
};

type RootStackParamList = {
  WritingPracticeScreen: { phonicsLessonId: string; mode: 'writing' };
  ReadingPracticeScreen: { phonicsLessonId: string; mode: 'reading' };
};

export default function MainPracticeScreen() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progressByMode, setProgressByMode] = useState<{ writing: Record<string, boolean>; reading: Record<string, boolean> }>({ writing: {}, reading: {} });
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'writing' | 'reading'>('writing');

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accentColor, fontFamily, fontSize } = useAppSettings();

  const contrastColor = tinycolor(accentColor).isLight() ? tinycolor(accentColor).darken(25).toHexString() : tinycolor(accentColor).lighten(25).toHexString();

  const fetchAll = async () => {
    try {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) throw new Error('No active session.');

      const [lessonsRes, progressRes] = await Promise.all([
        supabase.from('phonics_lessons').select('id, label, group_name, order_index, audio_url').order('group_name', { ascending: true }).order('order_index', { ascending: true }),
        supabase.from('lesson_progress').select('lesson_id, completed, mode').eq('user_id', user.id).in('mode', ['writing', 'reading']),
      ]);

      if (lessonsRes.error) throw lessonsRes.error;
      if (progressRes.error) throw progressRes.error;

      setLessons(lessonsRes.data || []);

      const next = { writing: {} as Record<string, boolean>, reading: {} as Record<string, boolean> };
      (progressRes.data || []).forEach((row: any) => { if (row.completed) (next as any)[row.mode][row.lesson_id] = true; });
      setProgressByMode(next);
    } catch (e: any) {
      console.error('Practice: fetchAll error →', e?.message || e);
      Alert.alert('Practice', 'Failed to load lessons/progress.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchAll);
    fetchAll();
    return unsub as any;
  }, [navigation]);

  useEffect(() => {
    let ch: any;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id; if (!uid) return;
      ch = supabase
        .channel(`progress_practice_${uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lesson_progress', filter: `user_id=eq.${uid}` }, (payload: any) => {
          const row: any = payload.new || payload.old; if (!row) return;
          setProgressByMode((prev) => {
            const m = (row.mode || 'writing') as 'writing' | 'reading';
            const next = { ...prev, [m]: { ...prev[m] } };
            if (payload.eventType === 'DELETE') { delete (next[m] as any)[row.lesson_id]; } else if (row.completed) { (next[m] as any)[row.lesson_id] = true; }
            return next;
          });
        })
        .subscribe();
    })();
    return () => { if (ch) supabase.removeChannel(ch); };
  }, []);

  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  const handleModeChange = (selected: 'writing' | 'reading') => { setMode(selected); };

  const progressMap = useMemo(() => progressByMode[mode] || {}, [progressByMode, mode]);

  const isUnlockedAtIndex = (index: number) => {
    if (index === 0) return true;
    const item = lessons[index];
    if (progressMap[item.id]) return true;
    const prev = lessons[index - 1];
    return !!progressMap[prev.id];
  };

  const renderLesson = ({ item, index }: { item: Lesson; index: number }) => {
    const unlocked = isUnlockedAtIndex(index);
    const screen = mode === 'writing' ? 'WritingPracticeScreen' : 'ReadingPracticeScreen';
    return (
      <TouchableOpacity
        style={[styles.lessonCard, { opacity: unlocked ? 1 : 0.4, borderColor: contrastColor, shadowColor: contrastColor }]}
        disabled={!unlocked}
        onPress={() => navigation.navigate(screen as keyof RootStackParamList, { phonicsLessonId: item.id, mode } as any)}
      >
        <Text style={[styles.lessonLabel, { fontFamily, fontSize: fontSizeValue }]}>{item.label}</Text>
        <Text style={[styles.lockIcon, unlocked && { color: '#4CAF50' }]}>{unlocked ? '🔓' : '🔒'}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <BaseScreen title="Practice" showBack>
      <View style={styles.modeToggle}>
        <TouchableOpacity style={[styles.toggleBtn, mode === 'writing' && [styles.activeToggle, { backgroundColor: accentColor }]]} onPress={() => handleModeChange('writing')}>
          <Text style={styles.toggleText}>✍️ Writing</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toggleBtn, mode === 'reading' && [styles.activeToggle, { backgroundColor: accentColor }]]} onPress={() => handleModeChange('reading')}>
          <Text style={styles.toggleText}>📣 Reading</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}><ActivityIndicator size="large" color={accentColor || '#ff9900'} /></View>
      ) : (
        <FlatList
          data={lessons}
          renderItem={renderLesson}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContainer}
          removeClippedSubviews
          windowSize={3}
          maxToRenderPerBatch={12}
          updateCellsBatchingPeriod={16}
          extraData={progressMap}
        />
      )}
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  modeToggle: { flexDirection: 'row', justifyContent: 'center', marginTop: 12, marginBottom: 16, gap: 12 },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1, borderColor: '#999', backgroundColor: '#fff' },
  activeToggle: { borderColor: '#fff' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#000' },
  listContainer: { gap: 10, alignItems: 'center', paddingBottom: 40 },
  lessonCard: { backgroundColor: '#fff', paddingVertical: 18, paddingHorizontal: 12, margin: 8, borderRadius: 12, width: '45%', alignItems: 'center', justifyContent: 'center', elevation: 4, shadowOpacity: 0.6, shadowRadius: 6, borderWidth: 2 },
  lessonLabel: { fontWeight: '600', textAlign: 'center' },
  lockIcon: { fontSize: 20, marginTop: 6, color: '#999' },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});


