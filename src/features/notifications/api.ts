import { supabase } from '../../lib/supabaseClient';

export async function fetchAdminUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('audience', 'admin')
    .eq('read', false);
  if (error || count == null) return 0;
  return count;
}

export async function fetchLearnerUnreadCount(userId: string): Promise<number> {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('audience', 'learner')
    .eq('user_id', userId)
    .eq('read', false);

  if (error || count == null) return 0;
  return count;
}
