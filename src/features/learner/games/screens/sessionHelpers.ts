import { supabase } from '../../../../lib/supabaseClient';

export async function ensureSession(kind: string, passedSessionId?: string) {
  const { data: u, error: uErr } = await supabase.auth.getUser();
  if (uErr || !u?.user) throw new Error(uErr?.message || 'Not logged in');

  // Use session provided by the rounds screen if present
  if (passedSessionId) {
    const { data, error } = await supabase
      .from('game_sessions')
      .select('id, current_round_index')
      .eq('id', passedSessionId)
      .single();
    if (error || !data) throw new Error(error?.message || 'Session not found');
    return { sessionId: data.id as string, currentRound: (data.current_round_index ?? 1) as number };
  }

  // Else, newest session for this user+kind or create one
  const { data: existing, error: eErr } = await supabase
    .from('game_sessions')
    .select('id, current_round_index, started_at')
    .eq('user_id', u.user.id)
    .eq('kind', kind)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (eErr) throw new Error(eErr.message);

  if (existing?.id) {
    return {
      sessionId: existing.id as string,
      currentRound: (existing.current_round_index ?? 1) as number,
    };
  }

  const { data: created, error: cErr } = await supabase
    .from('game_sessions')
    .insert([{
      user_id: u.user.id,
      kind,
      started_at: new Date().toISOString(),   // <-- avoid NOT NULL error
      total_rounds: 20,
      items_per_round: 5,
      score: 0,
      current_round_index: 1,
      current_item_index: 0,
      status: 'active'
    }])
    .select('id, current_round_index')
    .single();
  if (cErr || !created) throw new Error(cErr?.message || 'Failed to create session');

  return {
    sessionId: created.id as string,
    currentRound: (created.current_round_index ?? 1) as number,
  };
}

export async function setSessionRound(sessionId: string, roundIndex: number) {
  await supabase
    .from('game_sessions')
    .update({ current_round_index: roundIndex, current_item_index: 0 })
    .eq('id', sessionId);
}

export function clampRound(n: number | undefined, total: number) {
  return Math.max(1, Math.min(n ?? 1, total));
}
