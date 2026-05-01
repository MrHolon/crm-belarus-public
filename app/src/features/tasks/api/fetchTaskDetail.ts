import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type TaskStatus = Database['public']['Enums']['task_status'];
type TaskPriority = Database['public']['Enums']['task_priority'];
type CategorySeverity = Database['public']['Enums']['category_severity'];

export type TaskDetail = {
  id: number;
  ticket_number: string | null;
  title: string;
  description: string | null;
  creator_id: string;
  assignee_id: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  complexity: number;
  due_date: string | null;
  created_at: string;
  updated_at: string | null;
  is_overdue: boolean | null;
  parent_task_id: number | null;
  help_comment: string | null;
  help_requested_at: string | null;
  rejection_reason: string | null;
  rejected_at: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  category: {
    id: number;
    name: string;
    severity: CategorySeverity;
  } | null;
  task_type: { id: number; name: string } | null;
  creator: { id: string; full_name: string; login: string } | null;
  assignee: { id: string; full_name: string; login: string } | null;
  rejected_by: { id: string; full_name: string; login: string } | null;
};

export type TaskDetailTag = { id: number; name: string; color: string | null };

export type TaskDetailHelper = {
  id: number;
  helper_comment: string | null;
  created_at: string;
  user: { id: string; full_name: string; login: string } | null;
};

export type TaskDetailChild = {
  id: number;
  ticket_number: string | null;
  title: string;
  status: TaskStatus;
  assignee: { full_name: string } | null;
  task_type: { code: string } | null;
};

export type TaskDetailParent = {
  id: number;
  ticket_number: string | null;
  title: string;
};

export interface TaskDetailBundle {
  task: TaskDetail;
  tags: TaskDetailTag[];
  helpers: TaskDetailHelper[];
  children: TaskDetailChild[];
  parent: TaskDetailParent | null;
}

const TASK_SELECT = `
  id,
  ticket_number,
  title,
  description,
  creator_id,
  assignee_id,
  status,
  priority,
  complexity,
  due_date,
  created_at,
  updated_at,
  is_overdue,
  parent_task_id,
  help_comment,
  help_requested_at,
  rejection_reason,
  rejected_at,
  cancellation_reason,
  cancelled_at,
  category:problem_categories(id, name, severity),
  task_type:task_types(id, name),
  creator:users!tasks_creator_id_fkey(id, full_name, login),
  assignee:users!tasks_assignee_id_fkey(id, full_name, login),
  rejected_by:users!tasks_rejected_by_id_fkey(id, full_name, login)
`;

export async function fetchTaskDetail(taskId: number): Promise<TaskDetailBundle> {
  const { data: row, error } = await supabase
    .from('v_tasks')
    .select(TASK_SELECT)
    .eq('id', taskId)
    .maybeSingle();

  if (error) throw error;
  if (!row) {
    throw new Error('Задача не найдена');
  }

  const task = row as unknown as TaskDetail;

  const parentId = task.parent_task_id;
  const [tagsRes, helpersRes, childrenRes, parentRes] = await Promise.all([
    supabase
      .from('task_tags')
      .select('tags(id, name, color)')
      .eq('task_id', taskId),
    supabase
      .from('task_helpers')
      .select(
        `
        id,
        helper_comment,
        created_at,
        user:users!task_helpers_user_id_fkey(id, full_name, login)
      `,
      )
      .eq('task_id', taskId)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('tasks')
      .select(
        `
        id,
        ticket_number,
        title,
        status,
        assignee:users!tasks_assignee_id_fkey(full_name),
        task_type:task_types(code)
      `,
      )
      .eq('parent_task_id', taskId)
      .order('id', { ascending: true }),
    parentId
      ? supabase
          .from('tasks')
          .select('id, ticket_number, title')
          .eq('id', parentId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (tagsRes.error) throw tagsRes.error;
  if (helpersRes.error) throw helpersRes.error;
  if (childrenRes.error) throw childrenRes.error;
  if (parentRes.error) throw parentRes.error;

  const tags: TaskDetailTag[] = (tagsRes.data ?? [])
    .map((r) => r.tags as TaskDetailTag | null)
    .filter((t): t is TaskDetailTag => t != null);

  const helpers: TaskDetailHelper[] = (helpersRes.data ?? []).map((h) => ({
    id: h.id,
    helper_comment: h.helper_comment,
    created_at: h.created_at,
    user: h.user as TaskDetailHelper['user'],
  }));

  const children: TaskDetailChild[] = (childrenRes.data ?? []).map((c) => ({
    id: c.id,
    ticket_number: c.ticket_number,
    title: c.title,
    status: c.status as TaskStatus,
    assignee: c.assignee as TaskDetailChild['assignee'],
    task_type: c.task_type as TaskDetailChild['task_type'],
  }));

  const parent = parentRes.data
    ? (parentRes.data as TaskDetailParent)
    : null;

  return { task, tags, helpers, children, parent };
}
