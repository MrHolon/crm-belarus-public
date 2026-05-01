import { supabase } from '@/lib/supabase';
import {
  collectHistoryLookupIds,
  formatHistoryScalar,
  HISTORY_FIELD_LABEL,
  type HistoryDisplayLine,
} from '../lib/formatTaskHistory';

export type TaskHistoryRow = {
  id: number;
  field_name: string;
  old_value: unknown;
  new_value: unknown;
  changed_at: string;
};

/** Raw rows (e.g. tests). */
export async function listTaskHistory(taskId: number): Promise<TaskHistoryRow[]> {
  const { data, error } = await supabase
    .from('task_history')
    .select('id, field_name, old_value, new_value, changed_at')
    .eq('task_id', taskId)
    .order('changed_at', { ascending: false })
    .limit(200);

  if (error) throw error;

  return (data ?? []) as TaskHistoryRow[];
}

type RowWithActor = TaskHistoryRow & {
  actor: { full_name: string; login: string } | null;
};

/**
 * History for the task card: one round-trip for rows + batched lookups for users/categories.
 */
export async function fetchTaskHistoryDisplay(
  taskId: number,
): Promise<HistoryDisplayLine[]> {
  const { data, error } = await supabase
    .from('task_history')
    .select(
      `
      id,
      field_name,
      old_value,
      new_value,
      changed_at,
      actor:users!task_history_user_id_fkey(full_name, login)
    `,
    )
    .eq('task_id', taskId)
    .order('changed_at', { ascending: false })
    .limit(200);

  if (error) throw error;

  const rows = (data ?? []) as RowWithActor[];
  const { userIds, categoryIds } = collectHistoryLookupIds(rows);

  const [usersRes, catRes] = await Promise.all([
    userIds.length > 0
      ? supabase
          .from('users')
          .select('id, full_name, login')
          .in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; login: string }[], error: null }),
    categoryIds.length > 0
      ? supabase.from('problem_categories').select('id, name').in('id', categoryIds)
      : Promise.resolve({ data: [] as { id: number; name: string }[], error: null }),
  ]);

  if (usersRes.error) throw usersRes.error;
  if (catRes.error) throw catRes.error;

  const users = new Map(
    (usersRes.data ?? []).map((u) => [u.id, u] as const),
  );
  const categories = new Map(
    (catRes.data ?? []).map((c) => [c.id, c.name] as const),
  );
  const maps = { users, categories };

  return rows.map((r) => ({
    id: r.id,
    changed_at: r.changed_at,
    field_label: HISTORY_FIELD_LABEL[r.field_name] ?? r.field_name,
    old_label: formatHistoryScalar(r.field_name, r.old_value, maps),
    new_label: formatHistoryScalar(r.field_name, r.new_value, maps),
    actor: r.actor,
  }));
}
