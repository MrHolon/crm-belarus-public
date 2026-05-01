import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type TaskPriority = Database['public']['Enums']['task_priority'];

export interface CreateTaskPayload {
  title: string;
  description: string | null;
  category_id: number;
  task_type_id: number;
  priority: TaskPriority;
  assignee_id: string;
  due_date: string | null;
  complexity: number;
  tagNames: string[];
  parent_task_id: number | null;
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

export async function createTask(
  payload: CreateTaskPayload,
  creatorId: string,
) {
  const tagIds = await ensureTagIds(payload.tagNames, creatorId);

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      title: payload.title,
      description: payload.description,
      category_id: payload.category_id,
      task_type_id: payload.task_type_id,
      priority: payload.priority,
      assignee_id: payload.assignee_id,
      creator_id: creatorId,
      complexity: payload.complexity,
      due_date: payload.due_date,
      parent_task_id: payload.parent_task_id,
      status: 'new',
    })
    .select()
    .single();

  if (error) throw error;

  if (tagIds.length > 0) {
    const { error: tagErr } = await supabase.from('task_tags').insert(
      tagIds.map((tag_id) => ({ task_id: task.id, tag_id })),
    );
    if (tagErr) throw tagErr;
  }

  return task;
}
