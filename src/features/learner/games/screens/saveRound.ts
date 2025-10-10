// src/features/games/saveRound.ts
import { supabase } from '../../../../lib/supabaseClient';

export async function saveRoundResult(args: {
  sessionId: string;
  userId: string;                // <-- add this
  roundIndex: number;
  score: number;
  totalItems: number;
  wrongReviewPayload: any[];
}) {
  const { sessionId, userId, roundIndex, score, totalItems, wrongReviewPayload } = args;

  const { error } = await supabase
    .from('game_rounds')
    .upsert(
      [{
        session_id: sessionId,
        user_id: userId,                      // <-- include this so RLS passes
        round_index: roundIndex,
        score,
        total_items: totalItems,
        wrong_review_payload: wrongReviewPayload,
      }],
      { onConflict: 'session_id,round_index' }
    );

  if (error) throw error;
}
