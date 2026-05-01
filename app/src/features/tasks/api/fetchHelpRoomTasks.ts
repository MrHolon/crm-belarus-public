import { supabase } from '@/lib/supabase';
import type { TaskListRow } from './listTasks';

const SELECT = `
  id,
  ticket_number,
  title,
  status,
  priority,
  due_date,
  created_at,
  updated_at,
  is_overdue,
  category_id,
  task_type_id,
  assignee_id,
  creator_id,
  help_requested_at,
  category:problem_categories(id, name),
  assignee:users!tasks_assignee_id_fkey(id, full_name, login),
  task_type:task_types(id, name)
`;

/** Задачи в статусе «Нужна помощь» (пул для /help-room). */
export async function fetchHelpRoomTasks(): Promise<TaskListRow[]> {
  const { data, error } = await supabase
    .from('v_tasks')
    .select(SELECT)
    .eq('status', 'needs_help')
    .order('help_requested_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false });

  if (error) throw error;
  return (data ?? []) as TaskListRow[];
}
