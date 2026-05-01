import { supabase } from '@/lib/supabase';
import type { TablesUpdate } from '@/types/database';

export async function listUsersForAdmin() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateUserFields(
  id: string,
  patch: Partial<Pick<TablesUpdate<'users'>, 'role' | 'is_active'>>,
) {
  const { data, error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
