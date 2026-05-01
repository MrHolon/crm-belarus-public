import { supabase } from '@/lib/supabase';

export async function deleteTask(taskId: number): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) throw new Error(error.message);
}
