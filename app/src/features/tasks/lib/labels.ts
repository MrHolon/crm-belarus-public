import type { Database } from '@/types/database';

type TaskStatus = Database['public']['Enums']['task_status'];
type TaskPriority = Database['public']['Enums']['task_priority'];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  needs_help: 'Нужна помощь',
  on_review: 'На проверке',
  done: 'Выполнена',
  cancelled: 'Отменена',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критический',
};

export function statusColor(
  status: TaskStatus,
): 'gray' | 'blue' | 'yellow' | 'cyan' | 'green' | 'red' {
  switch (status) {
    case 'new':
      return 'gray';
    case 'in_progress':
      return 'blue';
    case 'needs_help':
      return 'yellow';
    case 'on_review':
      return 'cyan';
    case 'done':
      return 'green';
    case 'cancelled':
      return 'red';
    default:
      return 'gray';
  }
}

export function priorityColor(
  p: TaskPriority,
): 'gray' | 'blue' | 'orange' | 'red' {
  switch (p) {
    case 'low':
      return 'gray';
    case 'medium':
      return 'blue';
    case 'high':
      return 'orange';
    case 'critical':
      return 'red';
    default:
      return 'gray';
  }
}
