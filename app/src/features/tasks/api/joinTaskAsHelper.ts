import { supabase } from '@/lib/supabase';

export async function joinTaskAsHelper(
  taskId: number,
  helperComment?: string,
): Promise<void> {
  const { error } = await supabase.rpc('join_task_as_helper', {
    p_task_id: taskId,
    p_helper_comment: helperComment?.trim() ?? '',
  });
  if (error) throw new Error(error.message);
}
