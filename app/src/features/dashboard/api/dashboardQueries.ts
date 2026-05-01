import { supabase } from '@/lib/supabase';
import { fetchHelperTaskIds } from '@/features/tasks/api/listTasks';
import type { TaskListRow } from '@/features/tasks/api/listTasks';

const DASHBOARD_TASK_SELECT = `
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

/** «В работе у меня» — мои задачи в статусе in_progress, до `limit` строк. */
export async function fetchMyInProgressTasks(
  userId: string,
  limit = 5,
): Promise<TaskListRow[]> {
  const { data, error } = await supabase
    .from('v_tasks')
    .select(DASHBOARD_TASK_SELECT)
    .eq('status', 'in_progress')
    .eq('assignee_id', userId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as TaskListRow[];
}

/**
 * «Просроченные» — задачи из «моей зоны видимости» (создатель / исполнитель /
 * помощник), у которых `is_overdue = true` и они ещё не закрыты/отменены.
 */
export async function fetchMyOverdueTasks(
  userId: string,
  limit = 5,
): Promise<TaskListRow[]> {
  const helperIds = await fetchHelperTaskIds(userId);

  const parts = [`creator_id.eq.${userId}`, `assignee_id.eq.${userId}`];
  if (helperIds.length > 0) {
    parts.push(`id.in.(${helperIds.join(',')})`);
  }

  const { data, error } = await supabase
    .from('v_tasks')
    .select(DASHBOARD_TASK_SELECT)
    .or(parts.join(','))
    .eq('is_overdue', true)
    .not('status', 'in', '(done,cancelled)')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as TaskListRow[];
}

/** «Нужна помощь» — открытые запросы помощи, видимые через RLS. */
export async function fetchNeedsHelpTasks(limit = 5): Promise<TaskListRow[]> {
  const { data, error } = await supabase
    .from('v_tasks')
    .select(DASHBOARD_TASK_SELECT)
    .eq('status', 'needs_help')
    .order('help_requested_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as TaskListRow[];
}

export interface CriticalCategoryRow {
  id: number;
  name: string;
  openCount: number;
}

/**
 * Топ категорий с `severity = 'critical'` по числу открытых задач
 * за последние 30 дней. Агрегация — на клиенте: критических категорий
 * обычно единицы, объём выборки маленький.
 */
export async function fetchCriticalCategoriesOpen(
  limit = 5,
  sinceDays = 30,
): Promise<CriticalCategoryRow[]> {
  const since = new Date(
    Date.now() - sinceDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from('tasks')
    .select('id, category:problem_categories!inner(id, name, severity)')
    .eq('category.severity', 'critical')
    .not('status', 'in', '(done,cancelled)')
    .gte('created_at', since);

  if (error) throw error;

  type Row = {
    id: number;
    category: { id: number; name: string; severity: string } | null;
  };

  const counts = new Map<number, CriticalCategoryRow>();
  for (const row of (data ?? []) as Row[]) {
    if (!row.category) continue;
    const cur = counts.get(row.category.id) ?? {
      id: row.category.id,
      name: row.category.name,
      openCount: 0,
    };
    cur.openCount += 1;
    counts.set(row.category.id, cur);
  }

  return [...counts.values()]
    .sort((a, b) => b.openCount - a.openCount || a.name.localeCompare(b.name))
    .slice(0, limit);
}
