// games/session.ts (or similar)
import { supabase } from '../supabaseClient';

export type GameKind = 'NAME_PICTURE' | 'SOUND_MATCH' | 'RHYME_TIME' | 'FILL_BLANK';

type CreateSessionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createGameSession(
  kind: GameKind,
  totalRounds = 20,
  itemsPerRound = 5
): Promise<CreateSessionResult> {
  try {
    const { data: u, error: authErr } = await supabase.auth.getUser();
    if (authErr) return { ok: false, error: authErr.message };
    const user = u?.user;
    if (!user) return { ok: false, error: 'Not authenticated' };

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

    if (error || !data?.id) {
      return { ok: false, error: error?.message || 'Failed to create session' };
    }
    return { ok: true, id: data.id as string };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Unexpected error' };
  }
}

export type RoundItem = {
  item_id?: string | null;
  payload: any; // jsonb on DB
  correctIndex: number;
  selectedIndex: number | null;
};

type SaveRoundResult = { ok: true; roundScore: number } | { ok: false; error: string };

export async function saveRoundResults(opts: {
  sessionId: string | null;
  roundIndex: number;
  items: RoundItem[];
}): Promise<SaveRoundResult> {
  try {
    if (!opts.sessionId) return { ok: false, error: 'Missing sessionId' };
    if (!Number.isFinite(opts.roundIndex) || opts.roundIndex < 0) {
      return { ok: false, error: 'Invalid roundIndex' };
    }
    if (!Array.isArray(opts.items) || opts.items.length === 0) {
      return { ok: false, error: 'No items to save' };
    }

    const roundScore = opts.items.reduce(
      (s, it) => s + (it.selectedIndex === it.correctIndex ? 1 : 0),
      0
    );

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

    const { error: insertErr } = await supabase.from('game_attempts').insert(rows);
    if (insertErr) return { ok: false, error: insertErr.message };

    const { error: rpcErr } = await supabase.rpc('increment_game_score', {
      p_session_id: opts.sessionId,
      p_delta: roundScore
    });
    if (rpcErr) return { ok: false, error: rpcErr.message };

    return { ok: true, roundScore };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Unexpected error' };
  }
}
