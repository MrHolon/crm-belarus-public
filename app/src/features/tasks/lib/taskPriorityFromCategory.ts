import type { Tables } from '@/types/database';
import { defaultPriorityIdForSeverity } from '@/features/references/lib/defaultPriorityForSeverity';

type TaskPriority = Tables<'tasks'>['priority'];

export function taskPriorityFromCategory(
  category: Tables<'problem_categories'>,
  priorities: Tables<'priorities'>[],
): TaskPriority {
  const active = priorities.filter((p) => p.is_active);
  const pid =
    category.default_priority_id ??
    defaultPriorityIdForSeverity(category.severity, active);
  const row = active.find((p) => p.id === pid);
  const code = (row?.code ?? 'medium') as TaskPriority;
  if (['low', 'medium', 'high', 'critical'].includes(code)) {
    return code;
  }
  return 'medium';
}
