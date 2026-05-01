import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type TaskPriority = Database['public']['Enums']['task_priority'];

export interface EditTaskPayload {
  title: string;
  description: string | null;
  category_id: number;
  task_type_id: number;
  priority: TaskPriority;
  complexity: number;
  due_date: string | null;
  /** Полный целевой набор тегов по именам. Теги, которых нет, создаются. */
  tagNames: string[];
}

async function ensureTagIds(names: string[], userId: string): Promise<number[]> {
  const normalized = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const ids: number[] = [];

  for (const name of normalized) {
    const { data: existing } = await supabase
      .from('tags')
      .select('id')
      .eq('name', name)
      .maybeSingle();

    if (existing) {
      ids.push(existing.id);
      continue;
    }

    const { data: created, error } = await supabase
      .from('tags')
      .insert({ name, created_by: userId })
      .select('id')
      .single();

    if (error) {
      const { data: again } = await supabase
        .from('tags')
        .select('id')
        .eq('name', name)
        .maybeSingle();
      if (again) {
        ids.push(again.id);
        continue;
      }
      throw error;
    }
    if (created) {
      ids.push(created.id);
    }
  }

  return ids;
}

async function syncTaskTags(
  taskId: number,
  desiredTagIds: number[],
): Promise<void> {
  const { data: current, error: readErr } = await supabase
    .from('task_tags')
    .select('tag_id')
    .eq('task_id', taskId);
  if (readErr) throw readErr;

  const currentIds = new Set((current ?? []).map((r) => r.tag_id as number));
  const desiredSet = new Set(desiredTagIds);

  const toAdd = desiredTagIds.filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !desiredSet.has(id));

  if (toRemove.length > 0) {
    const { error: delErr } = await supabase
      .from('task_tags')
      .delete()
      .eq('task_id', taskId)
      .in('tag_id', toRemove);
    if (delErr) throw delErr;
  }

  if (toAdd.length > 0) {
    const { error: insErr } = await supabase.from('task_tags').insert(
      toAdd.map((tag_id) => ({ task_id: taskId, tag_id })),
    );
    if (insErr) throw insErr;
  }
}

/**
 * Редактирование уже созданной задачи. Триггер `log_task_changes` сам
 * запишет дельту по отслеживаемым полям (priority/complexity/due_date/
 * category_id и т.д.) в `task_history`.
 *
 * Поля `status` и `assignee_id` здесь НЕ меняются — для них есть отдельные
 * сценарии (lifecycle-кнопки, reject/reassign), чтобы не ломать
 * `enforce_task_status_transition` и логику уведомлений.
 */
export async function editTask(
  taskId: number,
  payload: EditTaskPayload,
  userId: string,
): Promise<void> {
  const { error: updErr } = await supabase
    .from('tasks')
    .update({
      title: payload.title,
      description: payload.description,
      category_id: payload.category_id,
      task_type_id: payload.task_type_id,
      priority: payload.priority,
      complexity: payload.complexity,
      due_date: payload.due_date,
    })
    .eq('id', taskId);
  if (updErr) throw updErr;

  const desiredTagIds = await ensureTagIds(payload.tagNames, userId);
  await syncTaskTags(taskId, desiredTagIds);
}
