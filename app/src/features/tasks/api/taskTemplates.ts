import { supabase } from '@/lib/supabase';
import type { Database, Tables, TablesInsert, TablesUpdate } from '@/types/database';

export type TaskTemplateRow = Tables<'task_templates'> & {
  category: { id: number; name: string } | null;
  task_type: { id: number; name: string; code: string } | null;
  creator: { id: string; full_name: string; login: string } | null;
};

const TEMPLATE_SELECT = `
  *,
  category:problem_categories(id, name),
  task_type:task_types(id, name, code),
  creator:users!task_templates_created_by_fkey(id, full_name, login)
`;

export async function listTaskTemplates(): Promise<TaskTemplateRow[]> {
  const { data, error } = await supabase
    .from('task_templates')
    .select(TEMPLATE_SELECT)
    .order('name');
  if (error) throw error;
  return (data ?? []) as TaskTemplateRow[];
}

export async function getTaskTemplate(id: number): Promise<TaskTemplateRow | null> {
  const { data, error } = await supabase
    .from('task_templates')
    .select(TEMPLATE_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as TaskTemplateRow | null;
}

export async function saveTaskAsTemplate(opts: {
  taskId: number;
  userId: string;
  name: string;
  descriptionTemplate: string | null;
  isPublic: boolean;
}): Promise<Tables<'task_templates'>> {
  const { taskId, userId, name, descriptionTemplate, isPublic } = opts;

  const { data: task, error: taskErr } = await supabase
    .from('tasks')
    .select(
      'title, description, category_id, task_type_id, complexity, priority',
    )
    .eq('id', taskId)
    .single();
  if (taskErr) throw taskErr;
  if (!task) throw new Error('Задача не найдена');

  const { data: tagRows, error: tagErr } = await supabase
    .from('task_tags')
    .select('tags(name)')
    .eq('task_id', taskId);
  if (tagErr) throw tagErr;
  const defaultTags: string[] = (tagRows ?? [])
    .map((r) => (r.tags as { name: string } | null)?.name)
    .filter((n): n is string => typeof n === 'string' && n.length > 0);

  const insert: TablesInsert<'task_templates'> = {
    name: name.trim(),
    created_by: userId,
    is_public: isPublic,
    title_template: task.title,
    description_template:
      descriptionTemplate?.trim() || task.description || null,
    category_id: task.category_id,
    task_type_id: task.task_type_id,
    complexity: task.complexity,
    priority: task.priority,
    default_tags: defaultTags,
  };

  const { data, error } = await supabase
    .from('task_templates')
    .insert(insert)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTaskTemplate(
  id: number,
  patch: TablesUpdate<'task_templates'>,
): Promise<void> {
  const { error } = await supabase
    .from('task_templates')
    .update(patch)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteTaskTemplate(id: number): Promise<void> {
  const { error } = await supabase.from('task_templates').delete().eq('id', id);
  if (error) throw error;
}

/** Значения формы «Новая задача» из шаблона (D2). */
export function newTaskFormFromTemplate(
  t: TaskTemplateRow,
  userId: string,
): {
  title: string;
  description: string;
  category_id: number;
  task_type_id: number;
  priority: Database['public']['Enums']['task_priority'];
  assignee_id: string;
  due_date: string | null;
  complexity: number;
  tagNames: string[];
  parent_task_id: null;
} {
  return {
    title: t.title_template?.trim() || t.name,
    description: t.description_template?.trim() ?? '',
    category_id: t.category_id ?? 0,
    task_type_id: t.task_type_id ?? 0,
    priority: t.priority ?? 'medium',
    assignee_id: userId,
    due_date: null,
    complexity: t.complexity ?? 3,
    tagNames: [...(t.default_tags ?? [])],
    parent_task_id: null,
  };
}
