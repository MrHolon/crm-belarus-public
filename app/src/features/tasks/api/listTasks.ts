import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type TaskStatus = Database['public']['Enums']['task_status'];
type TaskPriority = Database['public']['Enums']['task_priority'];

export interface TaskListFilters {
  status: TaskStatus[];
  categoryIds: number[];
  priorities: TaskPriority[];
  tagIds: number[];
  assigneeId: string | null;
  dueFrom: string | null;
  dueTo: string | null;
  overdueOnly: boolean;
  /** Полнотекстовый поиск (C3), пустая строка = без фильтра. */
  search: string;
}

export const defaultTaskListFilters = (): TaskListFilters => ({
  status: [],
  categoryIds: [],
  priorities: [],
  tagIds: [],
  assigneeId: null,
  dueFrom: null,
  dueTo: null,
  overdueOnly: false,
  search: '',
});

export async function fetchHelperTaskIds(userId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('task_helpers')
    .select('task_id')
    .eq('user_id', userId)
    .eq('is_active', true);
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.task_id))];
}

/** Task IDs that contain all of the given tags (AND). */
export async function fetchTaskIdsWithAllTags(
  tagIds: number[],
): Promise<number[] | null> {
  if (tagIds.length === 0) return null;

  const results = await Promise.all(
    tagIds.map(async (tagId) => {
      const { data, error } = await supabase
        .from('task_tags')
        .select('task_id')
        .eq('tag_id', tagId);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.task_id));
    }),
  );

  const [first, ...rest] = results;
  const intersection = [...first].filter((id) =>
    rest.every((s) => s.has(id)),
  );
  return intersection;
}

export type TaskListRow = {
  id: number;
  ticket_number: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
  updated_at: string | null;
  is_overdue: boolean | null;
  category_id: number | null;
  task_type_id: number | null;
  assignee_id: string | null;
  creator_id: string | null;
  help_requested_at: string | null;
  category: { id: number; name: string } | null;
  assignee: { id: string; full_name: string; login: string } | null;
  task_type: { id: number; name: string } | null;
};

const SELECT_LIST = `
  id,
  ticket_number,
  title,
  description,
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

function applyFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q: any,
  filters: TaskListFilters,
) {
  let query = q;
  if (filters.status.length > 0) {
    query = query.in('status', filters.status);
  }
  if (filters.categoryIds.length > 0) {
    query = query.in('category_id', filters.categoryIds);
  }
  if (filters.priorities.length > 0) {
    query = query.in('priority', filters.priorities);
  }
  if (filters.assigneeId) {
    query = query.eq('assignee_id', filters.assigneeId);
  }
  if (filters.dueFrom) {
    query = query.gte('due_date', filters.dueFrom);
  }
  if (filters.dueTo) {
    query = query.lte('due_date', filters.dueTo);
  }
  if (filters.overdueOnly) {
    query = query.eq('is_overdue', true);
  }
  const searchQ = filters.search.trim();
  if (searchQ.length > 0) {
    query = query.textSearch('search_tsv', searchQ, {
      type: 'websearch',
      config: 'russian',
    });
  }
  return query;
}

export interface ListTasksPageResult {
  rows: TaskListRow[];
  total: number;
}

export async function listTasksPage(opts: {
  mode: 'my' | 'all';
  userId: string;
  helperTaskIds: number[];
  filters: TaskListFilters;
  page: number;
  pageSize: number;
}): Promise<ListTasksPageResult> {
  const { mode, userId, helperTaskIds, filters, page, pageSize } = opts;

  let tagRestrictedIds: number[] | null = null;
  if (filters.tagIds.length > 0) {
    tagRestrictedIds = await fetchTaskIdsWithAllTags(filters.tagIds);
    if (!tagRestrictedIds?.length) {
      return { rows: [], total: 0 };
    }
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;

  let base = supabase.from('v_tasks').select(SELECT_LIST, {
    count: 'exact',
  });

  if (mode === 'my') {
    const parts = [`creator_id.eq.${userId}`, `assignee_id.eq.${userId}`];
    if (helperTaskIds.length > 0) {
      parts.push(`id.in.(${helperTaskIds.join(',')})`);
    }
    base = base.or(parts.join(','));
  }

  base = applyFilters(base, filters);

  if (tagRestrictedIds) {
    base = base.in('id', tagRestrictedIds);
  }

  const { data, error, count } = await base
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    rows: (data ?? []) as TaskListRow[],
    total: count ?? 0,
  };
}

const KANBAN_ROW_LIMIT = 500;

/**
 * Все подходящие задачи для канбана (без пагинации). «Отменена» исключается,
 * если в фильтре статусов не выбрана явно (ТЗ C1).
 */
export async function listTasksKanban(opts: {
  mode: 'my' | 'all';
  userId: string;
  helperTaskIds: number[];
  filters: TaskListFilters;
}): Promise<TaskListRow[]> {
  const { mode, userId, helperTaskIds, filters } = opts;

  let tagRestrictedIds: number[] | null = null;
  if (filters.tagIds.length > 0) {
    tagRestrictedIds = await fetchTaskIdsWithAllTags(filters.tagIds);
    if (!tagRestrictedIds?.length) {
      return [];
    }
  }

  let base = supabase.from('v_tasks').select(SELECT_LIST);

  if (mode === 'my') {
    const parts = [`creator_id.eq.${userId}`, `assignee_id.eq.${userId}`];
    if (helperTaskIds.length > 0) {
      parts.push(`id.in.(${helperTaskIds.join(',')})`);
    }
    base = base.or(parts.join(','));
  }

  base = applyFilters(base, filters);

  if (filters.status.length === 0 || !filters.status.includes('cancelled')) {
    base = base.neq('status', 'cancelled');
  }

  if (tagRestrictedIds) {
    base = base.in('id', tagRestrictedIds);
  }

  const { data, error } = await base
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(KANBAN_ROW_LIMIT);

  if (error) throw error;
  return (data ?? []) as TaskListRow[];
}

/** Активные задачи, где пользователь — помощник (для canTransition на канбане). */
export async function fetchActiveHelperTaskIdsForUser(
  userId: string,
  taskIds: number[],
): Promise<Set<number>> {
  if (taskIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('task_helpers')
    .select('task_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('task_id', taskIds);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.task_id as number));
}

export async function fetchTagsForTasks(
  taskIds: number[],
): Promise<Map<number, { id: number; name: string; color: string | null }[]>> {
  const map = new Map<
    number,
    { id: number; name: string; color: string | null }[]
  >();
  if (taskIds.length === 0) return map;

  const { data, error } = await supabase
    .from('task_tags')
    .select('task_id, tags(id, name, color)')
    .in('task_id', taskIds);
  if (error) throw error;

  for (const row of data ?? []) {
    const tid = row.task_id as number;
    const tag = row.tags as {
      id: number;
      name: string;
      color: string | null;
    } | null;
    if (!tag) continue;
    const list = map.get(tid) ?? [];
    list.push(tag);
    map.set(tid, list);
  }
  return map;
}
