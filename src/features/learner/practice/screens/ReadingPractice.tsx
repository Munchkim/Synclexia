
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../../../../../src/lib/supabaseClient';
import BaseScreen from '../../../../components/BaseScreen';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { RadioButton } from 'react-native-paper';

interface PracticeWord { label: string; image_url: string; }

async function ensureNextLessonRow(userId: string, lessonId: string, mode: 'writing' | 'reading') {
  const { data: existing, error: selErr } = await supabase
    .from('lesson_progress')
    .select('user_id')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .eq('mode', mode)
    .maybeSingle();
  if (selErr) console.warn('ensureNextLessonRow(select):', selErr?.message);
  if (!existing) {
    const { error: insErr } = await supabase
      .from('lesson_progress')
      .insert([{ user_id: userId, lesson_id: lessonId, mode, completed: false }]);
    if (insErr) console.warn('ensureNextLessonRow(insert):', insErr?.message);
  }
}

export default function ReadingPracticeScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const phonicsLessonId = route?.params?.phonicsLessonId;

  const [practiceWords, setPracticeWords] = useState<PracticeWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [choices, setChoices] = useState<string[]>([]);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!phonicsLessonId) return;
      const { data, error } = await supabase
        .from('phonics_lessons')
        .select('examples, order_index')
        .eq('id', phonicsLessonId)
        .single();
      if (error) { Alert.alert('Error', 'Failed to load reading practice.'); return; }
      setPracticeWords(data.examples || []);
      setLoading(false);
    })();
  }, [phonicsLessonId]);

  const current = practiceWords[currentIndex];

  const getRandomWords = (exclude: string): string[] => {
    const fallback = ['table', 'sun', 'map', 'top', 'cat'];
    let pool = practiceWords.map((w) => w.label).filter((l) => l !== exclude);
    if (pool.length < 3) pool = [...pool, ...fallback];
    const result: string[] = [];
    while (result.length < 3) {
      const rand = pool[Math.floor(Math.random() * pool.length)];
      if (!result.includes(rand)) result.push(rand);
    }
    return result;
  };

  useEffect(() => {
    if (!current) return;
    const distractors = getRandomWords(current.label);
    const correctIdx = Math.floor(Math.random() * 4);
    const newChoices = [...distractors];
    newChoices.splice(correctIdx, 0, current.label);
    setChoices(newChoices);
    setCorrectIndex(correctIdx);
    setSelectedIndex(null);
    setFeedback(null);
  }, [currentIndex, current?.label]);

  const speak = (t: string) => Speech.speak(t, { rate: 0.8, pitch: 1, language: 'en-US' });

  const handleSelect = (index: number) => {
    setSelectedIndex(index);
    setFeedback(index === correctIndex ? '✅ Correct!' : '❌ Try again!');
  };

  const handleNext = async () => {
    if (selectedIndex !== correctIndex) { Alert.alert('Oops', 'Please select the correct sound to proceed.'); return; }

    if (currentIndex + 1 >= practiceWords.length) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user; if (!user) throw new Error('No session');

        const { error: upErr } = await supabase
          .from('lesson_progress')
          .upsert(
            [{ user_id: user.id, lesson_id: phonicsLessonId, mode: 'reading', completed: true }],
            { onConflict: 'user_id,lesson_id,mode' }
          );
        if (upErr) { console.error('progress upsert:', upErr); Alert.alert('Progress', `Failed to save progress: ${upErr.message}`); return; }

        const { data: allLessons, error: lErr } = await supabase
          .from('phonics_lessons')
          .select('id, order_index')
          .order('order_index', { ascending: true });
        if (lErr) console.error('fetch lessons:', lErr);

        const idx = allLessons?.findIndex((l: any) => l.id === phonicsLessonId) ?? -1;
        const nextLesson = idx >= 0 ? allLessons?.[idx + 1] : null;

        if (nextLesson) {
          await ensureNextLessonRow(user.id, nextLesson.id, 'reading');
          navigation.replace('ReadingPracticeScreen', { phonicsLessonId: nextLesson.id, mode: 'reading' });
        } else {
          Alert.alert('Great job!', 'You’ve completed the final reading lesson.');
          navigation.navigate('MainPracticeScreen');
        }
      } catch (err: any) {
        console.error('Failed to unlock next reading lesson:', err?.message || err);
        Alert.alert('Practice', 'Failed to unlock next lesson. See logs.');
      }
    } else {
      setCurrentIndex((p) => p + 1);
    }
  };

  if (loading || !current) {
    return (
      <BaseScreen title="Reading Practice" showBack>
        <ActivityIndicator size="large" color="#F5A623" />
      </BaseScreen>
    );
  }

  return (
    <BaseScreen title="Reading Practice" showBack>
      <Image source={{ uri: current.image_url }} style={styles.image} />
      <Text style={styles.wordText}>{current.label}</Text>

      <View style={styles.audioRow}>
        {choices.map((choice, idx) => (
          <View key={idx} style={styles.radioContainer}>
            <TouchableOpacity onPress={() => speak(choice)} style={styles.audioBtn}>
              <Text style={styles.choiceLabel}>{String.fromCharCode(65 + idx)}</Text>
              <Ionicons name="volume-high" size={24} color="#fff" />
            </TouchableOpacity>
            <RadioButton value={String(idx)} status={selectedIndex === idx ? 'checked' : 'unchecked'} onPress={() => handleSelect(idx)} color="#3F51B5" />
          </View>
        ))}
      </View>

      {feedback && <Text style={styles.feedback}>{feedback}</Text>}

      <View style={styles.bottomRow}>
        <TouchableOpacity onPress={() => setCurrentIndex((p) => Math.max(0, p - 1))} style={styles.bottomButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleNext} style={[styles.bottomButton, { backgroundColor: '#4CAF50' }]}>
          <Ionicons name="arrow-forward" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <Text style={styles.progress}>Word {currentIndex + 1} of {practiceWords.length}</Text>
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  image: { width: 200, height: 200, alignSelf: 'center', marginVertical: 15 },
  wordText: { textAlign: 'center', fontSize: 26, fontWeight: 'bold', marginBottom: 20 },
  audioRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20, flexWrap: 'wrap' },
  audioBtn: { backgroundColor: '#3F51B5', padding: 15, borderRadius: 12, alignItems: 'center' },
  selected: { backgroundColor: '#888' },
  choiceLabel: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginBottom: 5 },
  feedback: { fontSize: 18, textAlign: 'center', marginBottom: 10 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  bottomButton: { backgroundColor: '#888', padding: 12, borderRadius: 10 },
  progress: { marginTop: 15, textAlign: 'center', fontSize: 16, color: '#555' },
  radioContainer: { alignItems: 'center', marginHorizontal: 10 },
});
