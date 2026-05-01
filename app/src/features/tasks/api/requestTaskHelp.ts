import { supabase } from '@/lib/supabase';

export async function requestTaskHelp(
  taskId: number,
  comment: string,
  helperIds: string[],
): Promise<void> {
  const { error } = await supabase.rpc('request_task_help', {
    p_task_id: taskId,
    p_help_comment: comment.trim(),
    p_helper_ids: helperIds,
  });
  if (error) throw new Error(error.message);
}
