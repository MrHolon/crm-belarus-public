import { supabase } from '@/lib/supabase';

export type MentionUser = {
  id: string;
  login: string;
  full_name: string;
};

/** Active users visible via RLS — same pool as assignee pickers / references. */
export async function fetchMentionUsers(): Promise<MentionUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, login, full_name')
    .eq('is_active', true)
    .order('full_name');
  if (error) throw error;
  return (data ?? []) as MentionUser[];
}
