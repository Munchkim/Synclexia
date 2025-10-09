import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import BaseScreen from '../../../../components/BaseScreen';
import { supabase } from '../../../../lib/supabaseClient';
import { useAppSettings } from '../../../../context/AppSettings';


import { useNavigation, useRoute } from '@react-navigation/native';

type Example = { label: string; image_url: string };
type Gap = { word: string; start: number; len: number; missing: string };
type Item = { example: Example; gap: Gap; choices: string[]; correctIndex: number };

const ITEMS_PER_ROUND = 5;
const TOTAL_ROUNDS = 20;
const GAME_KIND = 'FILL_BLANK';

const GRAPHEMES = [
  'sh','ch','th','ng','qu','ph','wh','ck',
  'ou','ow','oi','oy','ue','ui','ee','ea','ai','ay','oa','oo',
  'ar','er','ir','or','ur'
];
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

function makeGap(wordRaw: string): Gap {
  const word = wordRaw.toLowerCase();
  for (const g of GRAPHEMES) {
    const idx = word.indexOf(g);
    if (idx !== -1) return { word, start: idx, len: g.length, missing: g };
  }
  const mid = Math.max(1, Math.min(word.length - 2, Math.floor(word.length / 2)));
  return { word, start: mid, len: 1, missing: word[mid] };
}
function mask(len: number) { return '_'.repeat(Math.max(1, len)); }
function buildMasked(g: Gap, fill?: string) {
  if (!fill) return (g.word.slice(0, g.start) + mask(g.len) + g.word.slice(g.start + g.len)).toUpperCase();
  return (g.word.slice(0, g.start) + fill.toLowerCase() + g.word.slice(g.start + g.len)).toUpperCase();
}

export default function FillBlankScreen() {
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

      if (error) { Alert.alert('Error', 'Failed to load words.'); setLoading(false); return; }

      const uniq: Example[] = Array.from(
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

    const itemsBuilt: Item[] = chosen.map(example => {
      const gap = makeGap(example.label);
      const bank = gap.len > 1 ? GRAPHEMES : LETTERS;
      const distractors = bank.filter(x => x !== gap.missing).sort(() => Math.random() - 0.5).slice(0, 3);
      const choices = [...distractors, gap.missing].sort(() => Math.random() - 0.5).map(c => c.toUpperCase());
      const correctIndex = choices.findIndex(c => c.toLowerCase() === gap.missing);
      return { example, gap, choices, correctIndex };
    });

    setItems(itemsBuilt);
    setUsed(usedNow);
    setCursor(0); setSelected(null);
    setAnswers(Array(ITEMS_PER_ROUND).fill(null));
  };

  useEffect(() => { if (pool.length) buildRound(); }, [pool, roundIndex]);
  const current = useMemo(() => items[cursor], [items, cursor]);

  const maskedPreview = useMemo(() => {
    if (!current) return '';
    if (selected == null) return buildMasked(current.gap);
    return buildMasked(current.gap, current.choices[selected].toLowerCase());
  }, [current, selected]);

  const nextItem = async () => {
    if (selected == null) { Alert.alert('Try it', 'Choose the missing letter(s) before continuing.'); return; }
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
        promptText: `WORD: ${it.example.label.toUpperCase()}`,
        promptImage: it.example.image_url,
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
    return (<BaseScreen title="Fill the Blank" showBack><View style={styles.center}><ActivityIndicator size="large" /></View></BaseScreen>);
  }

  return (
    <BaseScreen title={`Fill the Blank • Round ${roundIndex}/${TOTAL_ROUNDS}`} showBack>
      <View style={styles.container}>
        <Image source={{ uri: current.example.image_url }} style={styles.image} />
        <Text style={[styles.masked, { fontFamily }]}>{maskedPreview.replace(/_/g,' _ ')}</Text>

        <View style={styles.options}>
          {current.choices.map((c, i) => {
            const sel = i === (selected ?? -1);
            return (
              <TouchableOpacity
                key={c + i}
                style={[styles.optionBtn, { borderColor: sel ? '#000' : '#ccc', backgroundColor: sel ? '#fff6d6' : '#fff' }]}
                onPress={() => setSelected(i)}
              >
                <Text style={[styles.optionText, { fontFamily }]}>{c}</Text>
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
  masked: { fontSize: 28, textAlign: 'center', marginBottom: 12 },
  options: { gap: 10 }, optionBtn: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 2 },
  optionText: { fontSize: 22, fontWeight: '800', color: '#222' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, marginTop: 20, gap: 12 },
  wordBtn: { backgroundColor: '#e9e9e9', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10 },
  wordBtnText: { fontSize: 14, fontWeight: '800', color: '#222' },
  wordBtnPrimary: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10 },
  wordBtnPrimaryText: { fontSize: 14, fontWeight: '800', color: '#000', letterSpacing: 0.5 },
  progress: { textAlign: 'center', marginTop: 10, color: '#666' },
});
