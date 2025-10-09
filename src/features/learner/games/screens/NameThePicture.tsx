import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import BaseScreen from '../../../../components/BaseScreen';
import { supabase } from '../../../../lib/supabaseClient';
import { useAppSettings } from '../../../../context/AppSettings';
import { useNavigation, useRoute } from '@react-navigation/native';

type Example = { label: string; image_url: string };
type Item = { promptImage: string; choices: string[]; correctIndex: number; correctLabel: string };

const ITEMS_PER_ROUND = 5;
const TOTAL_ROUNDS = 20;
const GAME_KIND = 'NAME_PICTURE';

export default function NamePictureScreen() {
  const { accentColor, fontFamily } = useAppSettings();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const phonicsLessonId: string | null = route?.params?.phonicsLessonId ?? null;

  const [userId, setUserId] = useState<string | null>(null);
  const [pool, setPool] = useState<Example[]>([]);
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [roundIndex, setRoundIndex] = useState(1);
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: u } = await supabase.auth.getUser();
      const user = u?.user;
      if (!user) { Alert.alert('Login required'); setLoading(false); return; }
      setUserId(user.id);

      const { data: existing } = await supabase
        .from('game_sessions')
        .select('id,current_round_index')
        .eq('user_id', user.id).eq('kind', GAME_KIND)
        .order('started_at', { ascending: false }).limit(1).maybeSingle();

      if (existing?.id) {
        setSessionId(existing.id);
        setRoundIndex(existing.current_round_index ?? 1);
      } else {
        const { data: s, error: sErr } = await supabase.from('game_sessions').insert([{
          user_id: user.id, kind: GAME_KIND, started_at: new Date().toISOString(),
          total_rounds: TOTAL_ROUNDS, items_per_round: ITEMS_PER_ROUND,
          score: 0, current_round_index: 1, current_item_index: 0, status: 'active'
        }]).select('id').single();
        if (sErr) { Alert.alert('Error', sErr.message); setLoading(false); return; }
        setSessionId(s?.id ?? null);
      }

      const { data, error } = await supabase
        .from('phonics_lessons')
        .select('examples, order_index')
        .order('order_index', { ascending: true });

      if (error) { Alert.alert('Error', 'Failed to load images.'); setLoading(false); return; }

      const uniq = Array.from(
        new Map(
          (data || []).flatMap((r: any) => r.examples || [])
            .filter((e: any) => e?.label && e?.image_url)
            .map((e: any) => [String(e.label), { label: String(e.label), image_url: String(e.image_url) }])
        ).values()
      );
      setPool(uniq);
      setLoading(false);
    })();
  }, []);

  const buildRound = () => {
    const poolCopy = [...pool].sort(() => Math.random() - 0.5);
    const chosen: Example[] = [];
    const usedNow = new Set(used);

    for (const ex of poolCopy) {
      const key = ex.label + '|' + ex.image_url;
      if (!usedNow.has(key)) {
        chosen.push(ex); usedNow.add(key);
        if (chosen.length === ITEMS_PER_ROUND) break;
      }
    }
    if (chosen.length < ITEMS_PER_ROUND) {
      usedNow.clear();
      while (chosen.length < ITEMS_PER_ROUND) chosen.push(pool[Math.floor(Math.random() * pool.length)]);
    }

    const itemsBuilt: Item[] = chosen.map((correct) => {
      const distractors = pool.filter(e => e.label !== correct.label).sort(() => Math.random() - 0.5).slice(0, 3).map(e => e.label);
      const choices = [...distractors, correct.label].sort(() => Math.random() - 0.5);
      const correctIndex = choices.findIndex(c => c === correct.label);
      return { promptImage: correct.image_url, choices, correctIndex, correctLabel: correct.label };
    });

    setItems(itemsBuilt);
    setUsed(usedNow);
    setCursor(0); setSelected(null);
    setAnswers(Array(ITEMS_PER_ROUND).fill(null));
  };

  useEffect(() => { if (pool.length) buildRound(); }, [pool, roundIndex]);
  const current = useMemo(() => items[cursor], [items, cursor]);

  const nextItem = async () => {
    if (selected == null) { Alert.alert('Pick one', 'Please choose an answer before continuing.'); return; }
    const ans = [...answers]; ans[cursor] = selected; setAnswers(ans);

    if (sessionId) {
      await supabase.from('game_sessions').update({
        current_round_index: roundIndex, current_item_index: Math.min(cursor + 1, ITEMS_PER_ROUND - 1),
      }).eq('id', sessionId);
    }

    if (cursor + 1 < ITEMS_PER_ROUND) {
      setCursor(c => c + 1); setSelected(null);
    } else {
      const roundScore = items.reduce((s, it, i) => s + (ans[i] === it.correctIndex ? 1 : 0), 0);
      const wrong = items.map((it, i) => ({
        promptText: `PICTURE: ${it.correctLabel.toUpperCase()}`,
        promptImage: it.promptImage,
        choices: it.choices.map(c => c.toUpperCase()),
        correctIndex: it.correctIndex,
        selectedIndex: ans[i]
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

        const { error: insErr } = await supabase.from('game_rounds').insert([{
          session_id: sessionId, user_id: uid,
          round_index: roundIndex, score: roundScore, total_items: ITEMS_PER_ROUND,
          wrong_review_payload: wrong
        }]);
        if (insErr) {
          console.warn('game_rounds insert error', insErr);
          Alert.alert('Save error', insErr.message || 'Could not save round history.');
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
          { text: 'View all rounds', onPress: () => navigation.navigate('GameRounds', { sessionId }) },
          { text: roundIndex >= TOTAL_ROUNDS ? 'Finish' : 'Next Round',
            onPress: () => { if (roundIndex >= TOTAL_ROUNDS) navigation.goBack(); else setRoundIndex(r => r + 1); } },
        ]
      );
    }
  };

  if (loading || !current) {
    return (<BaseScreen title="Name the Picture" showBack><View style={styles.center}><ActivityIndicator size="large" /></View></BaseScreen>);
  }

  return (
    <BaseScreen title={`Name the Picture • Round ${roundIndex}/${TOTAL_ROUNDS}`} showBack>
      <View style={styles.container}>
        <Image source={{ uri: current.promptImage }} style={styles.image} />
        <View style={styles.options}>
          {current.choices.map((opt, i) => {
            const sel = i === (selected ?? -1);
            return (
              <TouchableOpacity key={opt + i} style={[styles.optionBtn, { borderColor: sel ? '#000' : '#ccc', backgroundColor: sel ? '#fff6d6' : '#fff' }]} onPress={() => setSelected(i)} activeOpacity={0.9}>
                <Text style={[styles.optionText, { fontFamily }]}>{opt.toUpperCase()}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.bottomRow}>
          <TouchableOpacity style={styles.wordBtn} onPress={() => { if (cursor > 0) { setCursor(c => c - 1); setSelected(answers[cursor - 1]); } }}>
            <Text style={[styles.wordBtnText, { fontFamily }]}>BACK</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.wordBtnPrimary, { backgroundColor: accentColor }]} onPress={nextItem}>
            <Text style={[styles.wordBtnPrimaryText, { fontFamily }]}>{cursor + 1 < ITEMS_PER_ROUND ? 'NEXT' : 'END ROUND'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.progress}>Item {cursor + 1}/{ITEMS_PER_ROUND}</Text>
        {sessionId ? (
          <TouchableOpacity onPress={() => navigation.navigate('GameRounds', { sessionId })}>
            <Text style={{ textAlign: 'center', marginTop: 6, color: '#777', textDecorationLine: 'underline' }}>View Rounds</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  image: { width: 220, height: 220, resizeMode: 'contain', alignSelf: 'center', marginVertical: 10 },
  options: { gap: 10 }, optionBtn: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 2 },
  optionText: { fontSize: 22, fontWeight: '800', color: '#222' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, marginTop: 20, gap: 12 },
  wordBtn: { backgroundColor: '#e9e9e9', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10 },
  wordBtnText: { fontSize: 14, fontWeight: '800', color: '#222' },
  wordBtnPrimary: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10 },
  wordBtnPrimaryText: { fontSize: 14, fontWeight: '800', color: '#000', letterSpacing: 0.5 },
  progress: { textAlign: 'center', marginTop: 10, color: '#666' },
});
