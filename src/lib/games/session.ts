import { supabase } from '../supabaseClient';

export type GameKind = 'NAME_PICTURE' | 'SOUND_MATCH' | 'RHYME_TIME' | 'FILL_BLANK';

export async function createGameSession(kind: GameKind, totalRounds = 20, itemsPerRound = 5) {
  try {
    const { data: u } = await supabase.auth.getUser();
    const user = u?.user;
    if (!user) return null;

    const { data, error } = await supabase
      .from('game_sessions')
      .insert([{
        user_id: user.id,
        kind,
        started_at: new Date().toISOString(),
        total_rounds: totalRounds,
        items_per_round: itemsPerRound,
        score: 0
      }])
      .select('id')
      .single();

    if (error) return null;
    return data?.id as string;
  } catch { return null; }
}

export async function saveRoundResults(opts: {
  sessionId: string | null;
  roundIndex: number;
  items: Array<{ item_id?: string | null; payload: any; correctIndex: number; selectedIndex: number | null }>;
}) {
  if (!opts.sessionId) return;
  const roundScore = opts.items.reduce((s, it) => s + (it.selectedIndex === it.correctIndex ? 1 : 0), 0);
  try {
    const rows = opts.items.map((it, i) => ({
      session_id: opts.sessionId,
      round_index: opts.roundIndex,
      order_in_round: i + 1,
      item_id: it.item_id ?? null,
      user_answer_index: it.selectedIndex,
      correct_index: it.correctIndex,
      is_correct: it.selectedIndex === it.correctIndex,
      payload: it.payload
    }));
    await supabase.from('game_attempts').insert(rows);

    await supabase.rpc('increment_game_score', { p_session_id: opts.sessionId, p_delta: roundScore });
  } catch (e) {
    console.warn('saveRoundResults', e);
  }
}
