import type { Database } from '@/types/database';
import { formatTaskDateTime } from './formatTaskDate';
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from './labels';

type TaskStatus = Database['public']['Enums']['task_status'];
type TaskPriority = Database['public']['Enums']['task_priority'];

export const HISTORY_FIELD_LABEL: Record<string, string> = {
  assignee_id: 'Исполнитель',
  status: 'Статус',
  priority: 'Приоритет',
  complexity: 'Сложность',
  due_date: 'Срок',
  category_id: 'Категория',
  rejection_reason: 'Причина отклонения',
  rejected_at: 'Дата отклонения',
  rejected_by_id: 'Кто отклонил',
  cancelled_at: 'Дата отмены',
  cancellation_reason: 'Причина отмены',
};

type UserLite = { id: string; full_name: string; login: string };

function asUuid(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)) return v;
  return null;
}

function asNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function collectHistoryLookupIds(rows: { field_name: string; old_value: unknown; new_value: unknown }[]): {
  userIds: string[];
  categoryIds: number[];
} {
  const userIds = new Set<string>();
  const categoryIds = new Set<number>();

  for (const r of rows) {
    if (r.field_name === 'assignee_id' || r.field_name === 'rejected_by_id') {
      const o = asUuid(r.old_value);
      const n = asUuid(r.new_value);
      if (o) userIds.add(o);
      if (n) userIds.add(n);
    }
    if (r.field_name === 'category_id') {
      const o = asNumber(r.old_value);
      const n = asNumber(r.new_value);
      if (o !== null) categoryIds.add(o);
      if (n !== null) categoryIds.add(n);
    }
  }

  return {
    userIds: [...userIds],
    categoryIds: [...categoryIds],
  };
}

export function formatHistoryScalar(
  fieldName: string,
  value: unknown,
  maps: {
    users: Map<string, UserLite>;
    categories: Map<number, string>;
  },
): string {
  if (value === null || value === undefined) return '—';

  switch (fieldName) {
    case 'status': {
      const s = value as TaskStatus;
      return TASK_STATUS_LABELS[s] ?? String(value);
    }
    case 'priority': {
      const p = value as TaskPriority;
      return TASK_PRIORITY_LABELS[p] ?? String(value);
    }
    case 'assignee_id': {
      const id = asUuid(value);
      if (!id) return '—';
      const u = maps.users.get(id);
      return u ? `${u.full_name} (@${u.login})` : id;
    }
    case 'category_id': {
      const id = asNumber(value);
      if (id === null) return '—';
      return maps.categories.get(id) ?? `#${id}`;
    }
    case 'complexity':
      return String(value);
    case 'due_date': {
      const s = typeof value === 'string' ? value : null;
      return s ? formatTaskDateTime(s) : '—';
    }
    case 'rejected_at': {
      const s = typeof value === 'string' ? value : null;
      return s ? formatTaskDateTime(s) : '—';
    }
    case 'rejected_by_id': {
      const id = asUuid(value);
      if (!id) return '—';
      const u = maps.users.get(id);
      return u ? `${u.full_name} (@${u.login})` : id;
    }
    case 'rejection_reason':
      return typeof value === 'string' && value.trim() ? value : '—';
    case 'cancelled_at': {
      const s = typeof value === 'string' ? value : null;
      return s ? formatTaskDateTime(s) : '—';
    }
    case 'cancellation_reason':
      return typeof value === 'string' && value.trim() ? value : '—';
    default:
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}

export type HistoryDisplayLine = {
  id: number;
  changed_at: string;
  field_label: string;
  old_label: string;
  new_label: string;
  actor: { full_name: string; login: string } | null;
};
