import { supabase } from '@/lib/supabase';
import { listProblemCategories } from '@/features/references/api/categories';
import { listPriorities } from '@/features/references/api/priorities';
import { listTaskTypes } from '@/features/references/api/taskTypes';
import { listTags } from '@/features/references/api/tags';

export async function fetchTaskFormReferences() {
  const [categories, taskTypes, priorities, tags, usersRes] = await Promise.all([
    listProblemCategories(),
    listTaskTypes(),
    listPriorities(),
    listTags(),
    supabase
      .from('users')
      .select('id, full_name, login, role')
      .eq('is_active', true)
      .order('full_name'),
  ]);

  if (usersRes.error) throw usersRes.error;

  return {
    categories: categories.filter((c) => c.is_active),
    taskTypes: taskTypes.filter((t) => t.is_active),
    priorities: priorities.filter((p) => p.is_active),
    tags: tags.filter((t) => t.is_active),
    users: usersRes.data ?? [],
  };
}
