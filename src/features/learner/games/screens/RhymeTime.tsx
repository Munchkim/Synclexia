import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import BaseScreen from '../../../../components/BaseScreen';
import { supabase } from '../../../../lib/supabaseClient';
import { useAppSettings } from '../../../../context/AppSettings';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { deterministicPick, placeCorrect } from './deterministic';

type Example = { label: string; image_url: string };
type Item = { prompt: Example; choices: string[]; correctIndex: number };

const ITEMS_PER_ROUND = 5;
const TOTAL_ROUNDS = 20;
const GAME_KIND = 'RHYME_TIME';
const GAME_KEY  = 'rhyme_time' as const;

const V = ['a','e','i','o','u','y'];
const RIMES = [
  'eigh','eese','ouse','ight','ough','eaux','tion','sion','ture',
  'ange','inge','onge','unge','eau','igh','eer','air','are','ear','ure','oor',
  'eet','eek','eal','eap','eak','eat',
  'ain','ane','ake','ate','aze','ide','ike','ile','ine','ipe','ire','ite','ive','ize',
  'ode','oke','ole','one','ope','ore','ote','ove','oze',
  'ude','uke','ule','ume','une','use','ute',
  'all','ell','ill','oll','ull','old','olk','olt','ost','ook',
  'ash','esh','ish','osh','ush','ank','ink','onk','unk','ang','ing','ong','ung',
  'ay','ai','ee','ea','oa','oo','oi','oy','ou','ow','ue','ui',
  'ar','er','ir','or','ur'
];
function rhymeKey(w: string): string | null {
  let s = w.toLowerCase().replace(/[^a-z]/g,'');
  if (s.length < 2) return null;
  if (s.endsWith('e') && s.length > 2 && !V.includes(s[s.length-2])) s = s.slice(0,-1);
  for (const pat of [...RIMES].sort((a,b)=>b.length-a.length)) if (s.endsWith(pat)) return pat;
  for (let i = s.length-1; i>=0; i--) if (V.includes(s[i])) {
    const key = s.slice(i); if (key.length>=2 && /[aeiouy]/.test(key)) return key;
    break;
  }
  return null;
}

export default function RhymeTimeScreen() {
  const { accentColor, fontFamily } = useAppSettings();
  const navigation = useNavigation<any>();

  const route = useRoute<any>();
  const phonicsLessonId: string | null = route?.params?.phonicsLessonId ?? null;
  const passedSessionId: string | null = route?.params?.sessionId ?? null;
  const passedRoundIndex: number | undefined = route?.params?.roundIndex;


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

    // use passed session if any; else latest for this game kind or create
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

    // if a roundIndex is explicitly requested (coming from Rounds hub), switch the session to that round
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

    // load pool (unchanged from yours)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


  const buildRound = () => {
  // stable candidate pool: items that have at least one rhyming partner
  const byKey = new Map<string, Example[]>();
  [...pool]
    .sort((a,b)=>a.label.localeCompare(b.label))
    .forEach(e => {
      const k = rhymeKey(e.label);
      if (!k) return;
      byKey.set(k, [...(byKey.get(k) || []), e]);
    });

  const candidates = [...pool]
    .filter(e => { const k = rhymeKey(e.label); return !!k && (byKey.get(k)?.length || 0) >= 2; })
    .sort((a,b)=>a.label.localeCompare(b.label));

  const chosen = deterministicPick(candidates, roundIndex, ITEMS_PER_ROUND);

  const itemsBuilt: Item[] = chosen.map(prompt => {
    const key = rhymeKey(prompt.label)!;

    const partners = (byKey.get(key) || []).filter(x => x.label !== prompt.label).sort((a,b)=>a.label.localeCompare(b.label));
    const correctLabel = partners[0]?.label ?? prompt.label;

    const wrongs = [...pool]
      .filter(x => rhymeKey(x.label) !== key && x.label !== correctLabel)
      .sort((a,b)=>a.label.localeCompare(b.label))
      .slice(0, 3)
      .map(x => x.label);

    const baseChoices = [...wrongs, correctLabel].map(s => s.toUpperCase());
    const { arranged, pos } = placeCorrect(baseChoices, correctLabel.toUpperCase(), prompt.label);
    return { prompt, choices: arranged, correctIndex: pos };
  });

  setItems(itemsBuilt);
  if (cursor < 0 || cursor >= ITEMS_PER_ROUND) setCursor(0);
  if (!answers.length) setAnswers(Array(ITEMS_PER_ROUND).fill(null));
};

useEffect(() => { if (pool.length) buildRound(); /* eslint-disable-next-line */ }, [pool, roundIndex]);

  const current = useMemo(() => items[cursor], [items, cursor]);

  const speak = () => { if (current?.prompt?.label) Speech.speak(current.prompt.label, { rate: 0.9, pitch: 1, language: 'en-US' }); };

  const nextItem = async () => {
    if (selected == null) { Alert.alert('Choose one', 'Pick a rhyming word before continuing.'); return; }
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
        promptText: `WORD: ${it.prompt.label.toUpperCase()}`,
        promptImage: it.prompt.image_url,
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
          user_id: uid,
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
          { text: roundIndex >= TOTAL_ROUNDS ? 'Finish' : 'Next Round',
            onPress: () => { if (roundIndex >= TOTAL_ROUNDS) navigation.goBack(); else setRoundIndex(r => r + 1); } },
        ]
      );
    }
  };

  if (loading || !current) {
    return (<BaseScreen title="Rhyme Time" showBack><View style={styles.center}><ActivityIndicator size="large" /></View></BaseScreen>);
  }

  return (
    <BaseScreen title={`Rhyme Time • Round ${roundIndex}/${TOTAL_ROUNDS}`} showBack>
      <View style={styles.container}>
        <Image source={{ uri: current.prompt.image_url }} style={styles.image} />
        <TouchableOpacity onPress={speak} style={[styles.speaker, { backgroundColor: accentColor }]}>
          <Text style={{ fontWeight: '800' }}>SAY IT</Text>
        </TouchableOpacity>

        <View style={styles.options}>
          {current.choices.map((c, i) => {
            const sel = i === (selected ?? -1);
            return (
              <TouchableOpacity key={c + i} style={[styles.optionBtn, { borderColor: sel ? '#000' : '#ccc', backgroundColor: sel ? '#fff6d6' : '#fff' }]} onPress={() => setSelected(i)}>
                <Text style={[styles.optionText, { fontFamily }]}>{c.toUpperCase()}</Text>
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
  <TouchableOpacity onPress={() => navigation.navigate('GameRounds', { sessionId, kind: GAME_KEY })}>
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
  speaker: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 8 },
  options: { gap: 10 },
  optionBtn: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 2 },
  optionText: { fontSize: 22, fontWeight: '800', color: '#222' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, marginTop: 20, gap: 12 },
  wordBtn: { backgroundColor: '#e9e9e9', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10 },
  wordBtnText: { fontSize: 14, fontWeight: '800', color: '#222' },
  wordBtnPrimary: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10 },
  wordBtnPrimaryText: { fontSize: 14, fontWeight: '800', color: '#000', letterSpacing: 0.5 },
  progress: { textAlign: 'center', marginTop: 10, color: '#666' },
});
