import type { UserRole } from '@/lib/auth-context';
import type { TaskStatus } from './transitions';

/** ТЗ §4.10 — физическое удаление. */
export function canDeleteTask(opts: {
  status: TaskStatus;
  creatorId: string;
  userId: string;
  role: UserRole | null | undefined;
}): boolean {
  const { status, creatorId, userId, role } = opts;
  if (status !== 'new') {
    return role === 'admin';
  }
  return creatorId === userId || role === 'admin';
}

/** ТЗ §4.10 — перевод в «Отменена» с причиной (как `canTransition` → `cancelled`). */
export function canCancelTask(opts: {
  status: TaskStatus;
  creatorId: string;
  userId: string;
  role: UserRole | null | undefined;
}): boolean {
  const { status, creatorId, userId, role } = opts;
  if (status === 'done' || status === 'cancelled') {
    return false;
  }
  if (!role) return false;
  const staff =
    role === 'duty_officer' || role === 'manager' || role === 'admin';
  return creatorId === userId || staff;
}

export function canCreateDeveloperChildTask(role: UserRole | null | undefined): boolean {
  return (
    role === 'specialist' ||
    role === 'duty_officer' ||
    role === 'manager' ||
    role === 'admin'
  );
}

/**
 * Кто может редактировать карточку задачи (название, описание, категория,
 * тип, приоритет, сложность, срок, теги). Смена исполнителя — через отдельный
 * сценарий (reject/reassign), здесь не меняем.
 *
 * Правила:
 * - `done` / `cancelled` — нельзя никогда (историческая запись).
 * - staff (`duty_officer`, `manager`, `admin`) — можно всегда до закрытия.
 * - создатель — можно всегда до закрытия (чинит свою же опечатку).
 * - исполнитель-не-создатель / помощник — нельзя: для этого есть
 *   комментарии, «отклонить», «нужна помощь».
 */
export function canEditTask(opts: {
  status: TaskStatus;
  creatorId: string;
  userId: string;
  role: UserRole | null | undefined;
}): boolean {
  const { status, creatorId, userId, role } = opts;
  if (status === 'done' || status === 'cancelled') return false;
  if (!role) return false;
  const staff =
    role === 'duty_officer' || role === 'manager' || role === 'admin';
  if (staff) return true;
  return creatorId === userId;
}
