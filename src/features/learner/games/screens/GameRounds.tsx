import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, FlatList } from 'react-native';
import BaseScreen from '../../../../components/BaseScreen';
import { supabase } from '../../../../lib/supabaseClient';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAppSettings } from '../../../../context/AppSettings';
import { setSessionRound } from './sessionHelpers';

type GameType = 'sound_match' | 'name_picture' | 'rhyme_time' | 'fill_blank';

const GAME_ROUTE: Record<GameType, string> = {
  sound_match:  'SoundMatch',
  name_picture: 'NamePicture',
  rhyme_time:   'RhymeTime',
  fill_blank:   'FillBlank',
};

type RoundRow = {
  id: string;
  round_index: number;
  score: number | null;
  total_items: number | null;
  wrong_review_payload: any | null;
  created_at?: string | null;
};

const GAME_CONFIG: Record<GameType, { rounds: number; itemsPerRound: number }> = {
  sound_match:  { rounds: 20, itemsPerRound: 5 },
  name_picture: { rounds: 20, itemsPerRound: 5 },
  rhyme_time:   { rounds: 20, itemsPerRound: 5 },
  fill_blank:   { rounds: 20, itemsPerRound: 5 },
};

export default function GameRoundsScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { fontFamily, accentColor } = useAppSettings();

  const passedSessionId: string | undefined = route?.params?.sessionId;
  // ✅ always pass kind when navigating here; default only if truly none
  const passedKind: GameType | undefined = route?.params?.kind as GameType | undefined;
  const kind: GameType = passedKind ?? 'sound_match';
  const cfg = GAME_CONFIG[kind];

  const [sessionId, setSessionId] = useState<string | null>(passedSessionId ?? null);
  const [rows, setRows] = useState<RoundRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const resolveSession = useCallback(async (): Promise<string | null> => {
    if (sessionId) return sessionId;

    const { data: u, error: uErr } = await supabase.auth.getUser();
    if (uErr || !u?.user) { setErrMsg(uErr?.message || 'Not logged in'); return null; }

    // find latest for this kind
    const { data: sess, error: sErr } = await supabase
      .from('game_sessions')
      .select('id, kind, started_at')
      .eq('user_id', u.user.id)
      .eq('kind', kind)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sErr) { setErrMsg(sErr.message); return null; }

    if (sess?.id) { setSessionId(sess.id); return sess.id; }

    // create one
    const nowIso = new Date().toISOString();
    const { data: created, error: cErr } = await supabase
      .from('game_sessions')
      .insert([{
        user_id: u.user.id,
        kind,
        started_at: nowIso,
        total_rounds: cfg.rounds,
        items_per_round: cfg.itemsPerRound,
        score: 0,
        current_round_index: 1,
        current_item_index: 0,
        status: 'active'
      }])
      .select('id')
      .single();

    if (cErr || !created?.id) { setErrMsg(cErr?.message || 'Failed to create session'); return null; }
    setSessionId(created.id);
    return created.id;
  }, [sessionId, kind, cfg.rounds, cfg.itemsPerRound]);

  const loadRounds = useCallback(async () => {
    setLoading(true);
    setErrMsg(null);
    const sid = await resolveSession();
    if (!sid) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('game_rounds')
      .select('id, round_index, score, total_items, wrong_review_payload, created_at')
      .eq('session_id', sid)
      .order('round_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) { setErrMsg(error.message || 'Failed to load rounds.'); setRows(null); }
    else { setRows((data as RoundRow[]) || []); }
    setLoading(false);
  }, [resolveSession]);

  useEffect(() => { loadRounds(); }, [loadRounds]);

  const latestByRound = useMemo(() => {
    const map = new Map<number, RoundRow>();
    (rows || []).forEach((r) => map.set(r.round_index, r));
    return map;
  }, [rows]);

  const uiRounds = useMemo(() => {
    return Array.from({ length: cfg.rounds }, (_, i) => {
      const idx = i + 1;
      const dbRow = latestByRound.get(idx);
      return {
        index: idx,
        score: dbRow?.score ?? null,
        total: dbRow?.total_items ?? cfg.itemsPerRound,
        wrong: (dbRow?.wrong_review_payload as any[]) || [],
        hasData: !!dbRow,
      };
    });
  }, [cfg.rounds, cfg.itemsPerRound, latestByRound]);

  const nextRoundIndex = useMemo(() => {
    const firstUnplayed = uiRounds.find(r => !r.hasData)?.index;
    return firstUnplayed ?? cfg.rounds;
  }, [uiRounds, cfg.rounds]);

  const goToRound = useCallback(async (roundIndex: number) => {
    const sid = sessionId ?? (await resolveSession());
    if (!sid) { Alert.alert('Please wait', 'Session not ready yet.'); return; }
    // ✅ switch the session to the round you tapped, and reset item cursor to its saved value (0 by default)
    await setSessionRound(sid, roundIndex);
    // ✅ always pass kind so the correct game opens
    navigation.navigate(GAME_ROUTE[kind], { sessionId: sid, roundIndex, kind });
  }, [navigation, sessionId, kind, resolveSession]);

  if (loading) {
    return (<BaseScreen title="Game Rounds" showBack><View style={styles.center}><ActivityIndicator size="large" /></View></BaseScreen>);
  }

  return (
    <BaseScreen title="Game Rounds" showBack>
      {errMsg ? (
        <View style={{ padding: 12 }}>
          <Text style={{ color: '#b00020', marginBottom: 8 }}>Error: {errMsg}</Text>
          <TouchableOpacity onPress={loadRounds} style={[styles.btn, { backgroundColor: accentColor, alignSelf: 'flex-start' }]}>
            <Text style={[styles.btnText, { fontFamily }]}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: 12, marginBottom: 8 }}>
        <TouchableOpacity onPress={() => goToRound(nextRoundIndex)} style={[styles.btn, { backgroundColor: accentColor, alignSelf: 'flex-start' }]}>
          <Text style={[styles.btnText, { fontFamily }]}>▶ Play next round (Round {nextRoundIndex})</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        contentContainerStyle={{ padding: 12 }}
        data={uiRounds}
        keyExtractor={(r) => String(r.index)}
        renderItem={({ item }) => {
          const hasScore = item.score != null;
          const scoreTxt = hasScore ? `${item.score}/${item.total}` : `0/${item.total}`;
          return (
            <View style={styles.card}>
              <Text style={[styles.title, { fontFamily }]}>Round {item.index}</Text>
              <Text style={[styles.sub, { fontFamily }]}>Score: {scoreTxt}</Text>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: '#e9e9e9' }]} onPress={() => goToRound(item.index)}>
                  <Text style={[styles.btnText, { fontFamily }]}>{item.hasData ? 'RESUME / REPLAY' : 'START'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: accentColor, opacity: item.wrong.length ? 1 : 0.6 }]}
                  disabled={!item.wrong.length}
                  onPress={() => {
                    if (!item.wrong.length) { Alert.alert('Nothing to review', 'No wrong answers in this round.'); return; }
                    navigation.navigate('GameReview', { wrong: item.wrong });
                  }}
                >
                  <Text style={[styles.btnText, { fontFamily }]}>REVIEW</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, borderColor: '#ddd', borderWidth: 1 },
  title: { fontSize: 16, fontWeight: '800' },
  sub: { color: '#555', marginTop: 2 },
  btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  btnText: { fontWeight: '800', color: '#000' },
});
