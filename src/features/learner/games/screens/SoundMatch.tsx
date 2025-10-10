import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import BaseScreen from '../../../../components/BaseScreen';
import { supabase } from '../../../../lib/supabaseClient';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAppSettings } from '../../../../context/AppSettings';
import { deterministicPick, placeCorrect } from './deterministic';

type Lesson = { id: string; label: string; audio_url: string; group_name: string | null };
type Item = { audio: string; choices: string[]; correctIndex: number };

const ITEMS_PER_ROUND = 5;
const TOTAL_ROUNDS = 20;
const GAME_KIND = 'SOUND_MATCH';
const GAME_KEY  = 'sound_match' as const;

export default function SoundMatchScreen() {
  const navigation = useNavigation<any>();
  const { accentColor, fontFamily } = useAppSettings();

  const route = useRoute<any>();
  const phonicsLessonId: string | null = route?.params?.phonicsLessonId ?? null;
  const passedSessionId: string | null = route?.params?.sessionId ?? null;
  const passedRoundIndex: number | undefined = route?.params?.roundIndex;

  const [userId, setUserId] = useState<string | null>(null);
  const [pool, setPool] = useState<Lesson[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [roundIndex, setRoundIndex] = useState(1);
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [loading, setLoading] = useState(true);

  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data: u } = await supabase.auth.getUser();
      const user = u?.user;
      if (!user) { Alert.alert('Login required'); setLoading(false); return; }
      setUserId(user.id);

      // Use passed session when navigating from rounds hub; else reuse last or create.
      let sid = passedSessionId ?? null;
      if (!sid) {
        const { data: existing } = await supabase
          .from('game_sessions')
          .select('id,current_round_index,current_item_index')
          .eq('user_id', user.id).eq('kind', GAME_KIND)
          .order('started_at', { ascending: false }).limit(1).maybeSingle();

        if (existing?.id) {
          sid = existing.id;
          setRoundIndex(existing.current_round_index ?? 1);
          setCursor(Math.min(existing.current_item_index ?? 0, ITEMS_PER_ROUND - 1));
        } else {
          const now = new Date().toISOString();
          const { data: s, error: sErr } = await supabase.from('game_sessions').insert([{
            user_id: user.id, kind: GAME_KIND, started_at: now,
            total_rounds: TOTAL_ROUNDS, items_per_round: ITEMS_PER_ROUND,
            score: 0, current_round_index: 1, current_item_index: 0, status: 'active'
          }]).select('id,current_round_index,current_item_index').single();
          if (sErr) { Alert.alert('Error', sErr.message); setLoading(false); return; }
          sid = s?.id ?? null;
          setRoundIndex(1);
          setCursor(0);
        }
      }
      setSessionId(sid);

      // If a round is explicitly requested from the hub, switch to it (keep current_item_index).
      if (passedRoundIndex && sid) {
        await supabase.from('game_sessions')
          .update({ current_round_index: passedRoundIndex })
          .eq('id', sid);
        const { data: sess2 } = await supabase
          .from('game_sessions')
          .select('current_item_index')
          .eq('id', sid)
          .single();
        setRoundIndex(passedRoundIndex);
        setCursor(Math.min(sess2?.current_item_index ?? 0, ITEMS_PER_ROUND - 1));
      }

      // 🔊 Load lessons with audio (NOT examples)
      const { data, error } = await supabase
        .from('phonics_lessons')
        .select('id,label,audio_url,group_name,order_index')
        .order('group_name', { ascending: true })
        .order('order_index', { ascending: true });

      if (error) { Alert.alert('Error', 'Failed to load sounds.'); setLoading(false); return; }

      const withAudio = (data || [])
        .filter((r: any) => !!r.audio_url && !!r.label)
        .map((r: any) => ({
          id: String(r.id),
          label: String(r.label),
          audio_url: String(r.audio_url),
          group_name: r.group_name ? String(r.group_name) : null,
        }));

      // de-dup by label for stability
      const uniq = Array.from(new Map(withAudio.map(r => [r.label, r])).values());
      setPool(uniq);
      setLoading(false);
    })();

    return () => { if (soundRef.current) soundRef.current.unloadAsync(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildRound = () => {
    // stable ordering
    const poolSorted = [...pool].sort((a, b) => a.label.localeCompare(b.label));
    // choose the fixed set for this round
    const picked = deterministicPick(poolSorted, roundIndex, ITEMS_PER_ROUND);

    const itemsBuilt: Item[] = picked.map(correct => {
      // deterministic distractors: first 3 labels after filtering out the correct
      const distractors = poolSorted
        .filter(r => r.label !== correct.label)
        .slice(0, 3)
        .map(r => r.label.toUpperCase());

      const correctUpper = correct.label.toUpperCase();
      const baseChoices = [...distractors, correctUpper];

      // place the correct choice deterministically
      const { arranged, pos } = placeCorrect(baseChoices, correctUpper, correct.label);

      return { audio: correct.audio_url, choices: arranged, correctIndex: pos };
    });

    setItems(itemsBuilt);
    if (cursor < 0 || cursor >= ITEMS_PER_ROUND) setCursor(0);
    if (!answers.length) setAnswers(Array(ITEMS_PER_ROUND).fill(null));
  };

  useEffect(() => { if (pool.length) buildRound(); /* eslint-disable-next-line */ }, [pool, roundIndex]);

  const current = useMemo(() => items[cursor], [items, cursor]);

  const playSound = async () => {
    if (!current?.audio) return;
    try {
      if (soundRef.current) await soundRef.current.unloadAsync();
      const { sound } = await Audio.Sound.createAsync({ uri: current.audio });
      soundRef.current = sound;
      await sound.playAsync();
    } catch (e: any) { console.warn('audio', e?.message ?? e); }
  };

  const nextItem = async () => {
    if (selected == null) { Alert.alert('Choose one', 'Please select an answer before continuing.'); return; }
    const ans = [...answers]; ans[cursor] = selected; setAnswers(ans);

    if (sessionId) {
      await supabase.from('game_sessions').update({
        current_round_index: roundIndex,
        current_item_index: Math.min(cursor + 1, ITEMS_PER_ROUND - 1),
      }).eq('id', sessionId);
    }

    if (cursor + 1 < ITEMS_PER_ROUND) {
      setCursor(c => c + 1); setSelected(null);
    } else {
      const roundScore = items.reduce((s, it, i) => s + (ans[i] === it.correctIndex ? 1 : 0), 0);
      const wrong = items.map((it, i) => ({
        promptText: 'SOUND', promptImage: null,
        choices: it.choices.map(c => c.toUpperCase()),
        correctIndex: it.correctIndex, selectedIndex: ans[i],
      })).filter(w => w.selectedIndex !== w.correctIndex);

      const { data: u2 } = await supabase.auth.getUser();
      const uid = userId ?? u2?.user?.id ?? null;

      if (!sessionId || !uid) {
        Alert.alert('Save error', 'Missing session or user id.');
      } else {
        const { error: advErr } = await supabase.from('game_sessions').update({
          current_round_index: Math.min(roundIndex + 1, TOTAL_ROUNDS), current_item_index: 0
        }).eq('id', sessionId);
        if (advErr) console.warn('session advance error', advErr);

        const { error: upErr } = await supabase
          .from('game_rounds')
          .upsert([{
            session_id: sessionId,
            user_id: uid, // keep RLS happy
            round_index: roundIndex,
            score: roundScore,
            total_items: ITEMS_PER_ROUND,
            wrong_review_payload: wrong
          }], { onConflict: 'session_id,round_index' });

        if (upErr) {
          console.warn('game_rounds upsert error', upErr);
          Alert.alert('Save error', upErr.message || 'Could not save round history.');
        }
      }

      if (phonicsLessonId) {
        const { data: u } = await supabase.auth.getUser();
        const user = u?.user;
        if (user) {
          await supabase.from('lesson_progress').upsert([{
            user_id: user.id, lesson_id: phonicsLessonId, mode: 'game',
            completed: true, completed_at: new Date().toISOString(),
            accuracy: Math.round((roundScore / ITEMS_PER_ROUND) * 100),
          }], { onConflict: 'user_id,lesson_id,mode' });
        }
      }

      Alert.alert(
        `Round ${roundIndex} complete`,
        `Score: ${roundScore}/${ITEMS_PER_ROUND}`,
        [
          { text: 'Review wrong answers', onPress: () => navigation.navigate('GameReview', { wrong }) },
          { text: 'View all rounds', onPress: () => navigation.navigate('GameRounds', { sessionId, kind: GAME_KEY }) },
          {
            text: roundIndex >= TOTAL_ROUNDS ? 'Finish' : 'Next Round',
            onPress: () => { if (roundIndex >= TOTAL_ROUNDS) navigation.goBack(); else setRoundIndex(r => r + 1); }
          },
        ]
      );
    }
  };

  if (loading || !current) {
    return (
      <BaseScreen title="Sound Match" showBack>
        <View style={styles.center}><ActivityIndicator size="large" /></View>
      </BaseScreen>
    );
  }

  return (
    <BaseScreen title={`Sound Match • Round ${roundIndex}/${TOTAL_ROUNDS}`} showBack>
      <View style={styles.container}>
        <TouchableOpacity onPress={playSound} style={[styles.speaker, { backgroundColor: accentColor }]}>
          <Text style={{ fontWeight: '800' }}>PLAY</Text>
        </TouchableOpacity>

        <View style={styles.options}>
          {current.choices.map((opt, i) => {
            const sel = i === (selected ?? -1);
            return (
              <TouchableOpacity
                key={opt + i}
                style={[styles.optionBtn, { borderColor: sel ? '#000' : '#ccc', backgroundColor: sel ? '#fff6d6' : '#fff' }]}
                onPress={() => setSelected(i)}
              >
                <Text style={[styles.optionText, { fontFamily }]}>{opt.toUpperCase()}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.bottomRow}>
          <TouchableOpacity
            style={styles.wordBtn}
            onPress={() => { if (cursor > 0) { setCursor(c => c - 1); setSelected(answers[cursor - 1]); } }}
          >
            <Text style={[styles.wordBtnText, { fontFamily }]}>BACK</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.wordBtnPrimary, { backgroundColor: accentColor }]} onPress={nextItem}>
            <Text style={[styles.wordBtnPrimaryText, { fontFamily }]}>{cursor + 1 < ITEMS_PER_ROUND ? 'NEXT' : 'END ROUND'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.progress}>Item {cursor + 1}/{ITEMS_PER_ROUND}</Text>

        {sessionId ? (
          <TouchableOpacity onPress={() => navigation.navigate('GameRounds', { sessionId, kind: GAME_KEY })}>
            <Text style={{ textAlign: 'center', marginTop: 6, color: '#777', textDecorationLine: 'underline' }}>
              View Rounds
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  speaker: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 16 },
  options: { gap: 10 },
  optionBtn: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 2 },
  optionText: { fontSize: 22, fontWeight: '800', color: '#222' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, marginTop: 22, gap: 12 },
  wordBtn: { backgroundColor: '#e9e9e9', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10 },
  wordBtnText: { fontSize: 14, fontWeight: '800', color: '#222' },
  wordBtnPrimary: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10 },
  wordBtnPrimaryText: { fontSize: 14, fontWeight: '800', color: '#000', letterSpacing: 0.5 },
  progress: { textAlign: 'center', marginTop: 10, color: '#666' },
});
