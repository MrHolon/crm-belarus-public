import { supabase } from '@/lib/supabase';
import type { TablesUpdate } from '@/types/database';

export type MyProfilePatch = Pick<
  TablesUpdate<'users'>,
  | 'full_name'
  | 'phone'
  | 'timezone'
  | 'preferred_view'
  | 'telegram_chat_id'
>;

export async function updateMyProfile(userId: string, patch: MyProfilePatch) {
  const { data, error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
