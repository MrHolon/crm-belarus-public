import { supabase } from '@/lib/supabase';

export type TaskCommentRow = {
  id: number;
  comment_text: string;
  created_at: string;
  mentions: string[];
  author: { full_name: string; login: string } | null;
};

export async function listTaskComments(
  taskId: number,
): Promise<TaskCommentRow[]> {
  const { data, error } = await supabase
    .from('task_comments')
    .select(
      `
      id,
      comment_text,
      mentions,
      created_at,
      author:users!task_comments_user_id_fkey(full_name, login)
    `,
    )
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id,
    comment_text: r.comment_text,
    mentions: (r.mentions ?? []) as string[],
    created_at: r.created_at,
    author: r.author as TaskCommentRow['author'],
  }));
}

export async function insertTaskComment(
  taskId: number,
  userId: string,
  text: string,
  mentionIds: string[],
): Promise<void> {
  const { error } = await supabase.from('task_comments').insert({
    task_id: taskId,
    user_id: userId,
    comment_text: text.trim(),
    mentions: mentionIds,
  });
  if (error) throw error;
}
