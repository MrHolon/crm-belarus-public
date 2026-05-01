import { supabase } from '@/lib/supabase';

export async function rejectTask(taskId: number, reason: string): Promise<void> {
  const { error } = await supabase.rpc('reject_task', {
    p_task_id: taskId,
    p_reason: reason.trim(),
  });
  if (error) throw new Error(error.message);
}
