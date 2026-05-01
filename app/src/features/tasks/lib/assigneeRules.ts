import type { UserRole } from '@/lib/auth-context';

export type UserPick = {
  id: string;
  role: UserRole;
};

/**
 * Who may be assigned when creating a task (ТЗ §2.2 + PLAN B1).
 * Always allows assigning to yourself.
 */
export function canAssignTaskTo(
  creatorRole: UserRole,
  creatorId: string,
  assignee: UserPick,
): boolean {
  if (assignee.id === creatorId) {
    return true;
  }

  switch (creatorRole) {
    case 'duty_officer':
    case 'manager':
    case 'admin':
      return true;
    case 'specialist':
      // ТЗ §2.2: специалист может ставить задачи специалисту, дежурному,
      // разработчику и бухгалтеру. Админ / руководитель — не в списке.
      return (
        assignee.role === 'specialist' ||
        assignee.role === 'duty_officer' ||
        assignee.role === 'developer' ||
        assignee.role === 'accountant'
      );
    case 'developer':
      return assignee.role === 'specialist';
    case 'accountant':
      return (
        assignee.role === 'duty_officer' || assignee.role === 'specialist'
      );
    default:
      return false;
  }
}

export function filterAssignableUsers<T extends UserPick>(
  creatorRole: UserRole,
  creatorId: string,
  users: T[],
): T[] {
  return users.filter((u) => canAssignTaskTo(creatorRole, creatorId, u));
}
