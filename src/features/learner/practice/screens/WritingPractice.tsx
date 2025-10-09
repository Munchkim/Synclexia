import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../../../../../src/lib/supabaseClient';
import BaseScreen from '../../../../components/BaseScreen';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';

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

export default function WritingPracticeScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const phonicsLessonId = route?.params?.phonicsLessonId;

  const [practiceWords, setPracticeWords] = useState<PracticeWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedLetters, setSelectedLetters] = useState<string[]>([]);
  const [disabledMap, setDisabledMap] = useState<{ [index: number]: boolean }>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [usedIndices, setUsedIndices] = useState<number[]>([]);
  const [letterChoices, setLetterChoices] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      if (!phonicsLessonId) { Alert.alert('Error', 'Missing lesson ID.'); return; }
      const { data, error } = await supabase
        .from('phonics_lessons')
        .select('examples, order_index')
        .eq('id', phonicsLessonId)
        .single();
      if (error) { console.error(error); Alert.alert('Error', 'Failed to load practice examples.'); return; }
      setPracticeWords(data.examples || []);
      setLoading(false);
    })();
  }, [phonicsLessonId]);

  const current = practiceWords[currentIndex];

  const generateLetterChoices = (word: string): string[] => {
    const wordLetters = word.toUpperCase().split('');
    const result: string[] = [...wordLetters];
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    while (result.length < 10) {
      const random = alphabet[Math.floor(Math.random() * alphabet.length)];
      const countInWord = wordLetters.filter((l) => l === random).length;
      const countInResult = result.filter((l) => l === random).length;
      if (countInResult <= countInWord || countInWord === 0) result.push(random);
    }
    return [...result].sort(() => Math.random() - 0.5);
  };

  useEffect(() => { if (current) setLetterChoices(generateLetterChoices(current.label)); }, [current?.label]);
  useEffect(() => { setSelectedLetters([]); setFeedback(null); setUsedIndices([]); setDisabledMap({}); }, [currentIndex]);

  const speak = (text: string) => Speech.speak(text, { rate: 0.8, pitch: 1, language: 'en-US' });

  const handleLetterPress = (letter: string, index: number) => {
    if (disabledMap[index]) return;
    setSelectedLetters((p) => [...p, letter]);
    setDisabledMap((p) => ({ ...p, [index]: true }));
    setUsedIndices((p) => [...p, index]);
  };
  const handleRetry = () => { setSelectedLetters([]); setFeedback(null); setDisabledMap({}); setUsedIndices([]); };
  const handleBackspace = () => {
    if (!selectedLetters.length) return;
    const restoredIndex = usedIndices[usedIndices.length - 1];
    setUsedIndices((p) => p.slice(0, -1));
    setSelectedLetters((p) => p.slice(0, -1));
    setDisabledMap((p) => ({ ...p, [restoredIndex]: false }));
  };

  const handleCheckAnswer = () => {
    const expected = current?.label?.toLowerCase().trim();
    const attempt = selectedLetters.join('').toLowerCase();
    if (!attempt) { Alert.alert('Oops!', 'Select letters before checking!'); return; }
    setFeedback(attempt === expected ? '✅ Correct!' : '❌ Try again!');
  };

  const handleNext = async () => {
    const expected = current?.label?.toLowerCase().trim();
    const attempt = selectedLetters.join('').toLowerCase();
    if (!attempt) { Alert.alert('Wait', 'You must try spelling the word first.'); return; }
    if (attempt !== expected) { Alert.alert('Incorrect', 'Try again before moving on.'); return; }

    if (currentIndex + 1 >= practiceWords.length) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user; if (!user) throw new Error('No session');

        const { error: upErr } = await supabase
          .from('lesson_progress')
          .upsert(
            [{ user_id: user.id, lesson_id: phonicsLessonId, mode: 'writing', completed: true }],
            { onConflict: 'user_id,lesson_id,mode' }
          );
        if (upErr) { console.error('progress upsert:', upErr); Alert.alert('Progress', `Failed to save progress: ${upErr.message}`); return; }

        const { data: allLessons, error: lErr } = await supabase
          .from('phonics_lessons')
          .select('id, order_index')
          .order('order_index', { ascending: true });
        if (lErr) { console.error('fetch lessons:', lErr); }

        const idx = allLessons?.findIndex((l: any) => l.id === phonicsLessonId) ?? -1;
        const nextLesson = idx >= 0 ? allLessons?.[idx + 1] : null;

        if (nextLesson) {
          await ensureNextLessonRow(user.id, nextLesson.id, 'writing');
          navigation.replace('WritingPracticeScreen', { phonicsLessonId: nextLesson.id, mode: 'writing' });
        } else {
          Alert.alert('Great job!', 'You’ve completed the final lesson.');
          navigation.navigate('MainPracticeScreen');
        }
      } catch (err: any) {
        console.error('❌ unlock flow failed:', err?.message || err);
        Alert.alert('Practice', 'Failed to unlock next lesson. See logs.');
      }
    } else {
      setCurrentIndex((p) => p + 1);
    }
  };

  if (loading || !current) {
    return (
      <BaseScreen title="Writing Practice" showBack>
        <ActivityIndicator size="large" color="#F5A623" />
      </BaseScreen>
    );
  }

  return (
    <BaseScreen title="Writing Practice" showBack>
      <Text style={styles.title}>Spell what you hear</Text>
      <Image source={{ uri: current.image_url }} style={styles.image} />
      <TouchableOpacity onPress={() => speak(current.label)} style={styles.iconButton}>
        <Ionicons name="volume-high" size={28} color="#fff" />
      </TouchableOpacity>

      <View style={styles.spellingArea}><Text style={styles.spellingText}>{selectedLetters.join('')}</Text></View>

      <View style={styles.retryBackRow}>
        <TouchableOpacity onPress={handleRetry} style={styles.bottomButton}><Ionicons name="refresh" size={20} color="#fff" /></TouchableOpacity>
        <TouchableOpacity onPress={handleBackspace} style={styles.bottomButton}><Ionicons name="backspace" size={20} color="#fff" /></TouchableOpacity>
      </View>

      <View style={styles.letterGrid}>
        {letterChoices.map((letter, index) => (
          <TouchableOpacity key={index} onPress={() => handleLetterPress(letter, index)} disabled={disabledMap[index]} style={[styles.letterTile, disabledMap[index] && { backgroundColor: '#bbb' }]}>
            <Text style={styles.letterText}>{letter}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {feedback && <Text style={styles.feedback}>{feedback}</Text>}

      <View style={styles.bottomRow}>
        <TouchableOpacity onPress={() => setCurrentIndex((p) => Math.max(0, p - 1))} style={styles.bottomButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleCheckAnswer} style={styles.checkButton}>
          <Text style={styles.buttonText}>Check Answer</Text>
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
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  image: { width: 180, height: 180, resizeMode: 'contain', alignSelf: 'center' },
  iconButton: { backgroundColor: '#F5A623', padding: 12, borderRadius: 100, alignSelf: 'center', marginVertical: 15 },
  spellingArea: { minHeight: 50, borderColor: '#ccc', borderWidth: 1, borderRadius: 10, marginHorizontal: 20, marginTop: 10, padding: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  spellingText: { fontSize: 24, fontWeight: 'bold' },
  retryBackRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 10, marginBottom: 5 },
  letterGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginVertical: 10 },
  letterTile: { width: 48, height: 48, backgroundColor: '#ddd', margin: 5, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  letterText: { fontSize: 20, fontWeight: 'bold' },
  feedback: { fontSize: 18, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 10 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10, width: '100%', paddingHorizontal: 20 },
  bottomButton: { backgroundColor: '#888', padding: 12, borderRadius: 10 },
  checkButton: { backgroundColor: '#3F51B5', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  buttonText: { color: '#fff', fontSize: 16 },
  progress: { marginTop: 20, fontSize: 16, color: '#555', textAlign: 'center' },
});


