import { supabase } from '@/lib/supabase';
import type { TablesUpdate } from '@/types/database';

export async function updateTask(
  taskId: number,
  patch: TablesUpdate<'tasks'>,
): Promise<void> {
  const { error } = await supabase.from('tasks').update(patch).eq('id', taskId);
  if (error) throw error;
}
