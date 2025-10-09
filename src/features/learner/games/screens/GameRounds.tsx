import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, FlatList } from 'react-native';
import BaseScreen from '../../../../components/BaseScreen';
import { supabase } from '../../../../lib/supabaseClient';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAppSettings } from '../../../../context/AppSettings';

type RoundRow = {
  id: string;
  round_index: number;
  score: number | null;
  total_items: number | null;
  wrong_review_payload: any | null;
};

export default function GameRoundsScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { fontFamily, accentColor } = useAppSettings();

  const passedSessionId: string | undefined = route?.params?.sessionId;
  const passedKind: string | undefined = route?.params?.kind;

  const [sessionId, setSessionId] = useState<string | null>(passedSessionId ?? null);
  const [rounds, setRounds] = useState<RoundRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const resolveSession = useCallback(async () => {
    if (sessionId) return sessionId;

    const { data: u, error: uErr } = await supabase.auth.getUser();
    if (uErr || !u?.user) { setErrMsg(uErr?.message || 'Not logged in'); return null; }

    let q = supabase
      .from('game_sessions')
      .select('id, kind, started_at')
      .eq('user_id', u.user.id)
      .order('started_at', { ascending: false })
      .limit(1);

    if (passedKind) q = q.eq('kind', passedKind);

    const { data: sess, error: sErr } = await q.maybeSingle();
    if (sErr) { setErrMsg(sErr.message); return null; }
    if (!sess?.id) { setErrMsg('No session found. Play a round first.'); return null; }
    setSessionId(sess.id);
    return sess.id;
  }, [sessionId, passedKind]);

  const loadRounds = useCallback(async () => {
    setLoading(true);
    setErrMsg(null);
    const sid = await resolveSession();
    if (!sid) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('game_rounds')
      .select('id, round_index, score, total_items, wrong_review_payload')
      .eq('session_id', sid)
      .order('round_index', { ascending: true });

    if (error) { setErrMsg(error.message || 'Failed to load rounds.'); setRounds(null); }
    else setRounds((data as RoundRow[]) || []);
    setLoading(false);
  }, [resolveSession]);

  useEffect(() => { loadRounds(); }, [loadRounds]);

  if (loading) {
    return <BaseScreen title="Game Rounds" showBack><View style={styles.center}><ActivityIndicator size="large" /></View></BaseScreen>;
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

      <FlatList
        contentContainerStyle={{ padding: 12 }}
        data={rounds || []}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => {
          const total = item.total_items || 5;
          const scoreTxt = item.score != null ? `${item.score}/${total}` : '—';
          return (
            <View style={styles.card}>
              <Text style={[styles.title, { fontFamily }]}>Round {item.round_index}</Text>
              <Text style={[styles.sub, { fontFamily }]}>Score: {scoreTxt}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: '#e9e9e9' }]} onPress={() => navigation.goBack()}>
                  <Text style={[styles.btnText, { fontFamily }]}>RESUME</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: accentColor }]}
                  onPress={() => {
                    const wrong = item.wrong_review_payload || [];
                    if (!wrong.length) { Alert.alert('Nothing to review', 'No wrong answers in this round.'); return; }
                    navigation.navigate('GameReview', { wrong });
                  }}
                >
                  <Text style={[styles.btnText, { fontFamily }]}>REVIEW</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={{ padding: 20 }}>
            <Text style={{ textAlign: 'center' }}>No rounds saved yet. Finish a round to see history.</Text>
            <TouchableOpacity onPress={loadRounds} style={[styles.btn, { backgroundColor: accentColor, alignSelf: 'center', marginTop: 10 }]}>
              <Text style={[styles.btnText, { fontFamily }]}>Refresh</Text>
            </TouchableOpacity>
          </View>
        }
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
