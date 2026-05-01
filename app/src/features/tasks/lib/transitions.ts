import type { UserRole } from '@/lib/auth-context';
import type { Database, TablesUpdate } from '@/types/database';

export type TaskStatus = Database['public']['Enums']['task_status'];

const ALL_STATUSES: TaskStatus[] = [
  'new',
  'in_progress',
  'needs_help',
  'on_review',
  'done',
  'cancelled',
];

export type TransitionContext = {
  role: UserRole;
  isAssignee: boolean;
  isCreator: boolean;
  isHelper: boolean;
  /** Whether the task already has an assignee (before transition). */
  hasAssignee: boolean;
};

/** Who may update task rows per RLS (assignee/creator/staff/active helper). */
export function canUserMutateTaskRow(ctx: {
  role: UserRole;
  userId: string;
  creatorId: string | null;
  assigneeId: string | null;
  /** Active helper on this task (B8). */
  isHelper?: boolean;
}): boolean {
  const { role, userId, creatorId, assigneeId, isHelper } = ctx;
  const staff =
    role === 'duty_officer' ||
    role === 'manager' ||
    role === 'admin';
  return (
    staff ||
    assigneeId === userId ||
    creatorId === userId ||
    !!isHelper
  );
}

/**
 * Whether a status change is allowed by ТЗ §4.1 (aligned with DB trigger
 * `enforce_task_status_transition`).
 */
export function canTransition(
  from: TaskStatus,
  to: TaskStatus,
  ctx: TransitionContext,
): boolean {
  if (from === to) return true;

  const isStaff =
    ctx.role === 'duty_officer' ||
    ctx.role === 'manager' ||
    ctx.role === 'admin';
  const canCancel =
    ctx.isCreator ||
    ctx.role === 'duty_officer' ||
    ctx.role === 'manager' ||
    ctx.role === 'admin';

  /** «Новая → В работе»: staff; исполнитель если уже назначен; создатель может назначить себя. */
  const canStartNew =
    isStaff ||
    (ctx.hasAssignee && ctx.isAssignee) ||
    (ctx.isCreator && !ctx.hasAssignee);

  const canOnReviewDecide =
    ctx.isCreator ||
    ctx.role === 'duty_officer' ||
    ctx.role === 'manager' ||
    ctx.role === 'admin';

  switch (from) {
    case 'new':
      if (to === 'in_progress') return canStartNew;
      if (to === 'cancelled') return canCancel;
      return false;
    case 'in_progress':
      if (to === 'needs_help') return ctx.isAssignee;
      if (to === 'on_review') return ctx.isAssignee;
      if (to === 'done') return ctx.isAssignee || ctx.isCreator;
      if (to === 'cancelled') return canCancel;
      return false;
    case 'needs_help':
      if (to === 'in_progress') return ctx.isAssignee || ctx.isHelper;
      if (to === 'on_review') return ctx.isAssignee || ctx.isHelper;
      if (to === 'done')
        return ctx.isAssignee || ctx.isHelper || ctx.isCreator;
      if (to === 'cancelled') return canCancel;
      return false;
    case 'on_review':
      if (to === 'in_progress' || to === 'done') return canOnReviewDecide;
      if (to === 'cancelled') return canCancel;
      return false;
    case 'done':
      return to === 'in_progress' && ctx.isCreator;
    case 'cancelled':
      return false;
    default:
      return false;
  }
}

export function allowedNextStatuses(
  current: TaskStatus,
  ctx: TransitionContext,
): TaskStatus[] {
  return ALL_STATUSES.filter(
    (to) => to !== current && canTransition(current, to, ctx),
  );
}

export function buildStatusUpdatePatch(args: {
  task: {
    id: number;
    status: TaskStatus;
    assignee_id: string | null;
  };
  nextStatus: TaskStatus;
  currentUserId: string;
  role: UserRole;
  helpComment?: string;
}): TablesUpdate<'tasks'> {
  const { task, nextStatus, currentUserId, role, helpComment } = args;
  const isStaff =
    role === 'duty_officer' || role === 'manager' || role === 'admin';

  if (task.status === 'new' && nextStatus === 'in_progress') {
    const patch: TablesUpdate<'tasks'> = {
      status: 'in_progress',
    };
    if (!task.assignee_id || isStaff) {
      patch.assignee_id = currentUserId;
    }
    return patch;
  }

  if (nextStatus === 'needs_help') {
    return {
      status: 'needs_help',
      help_comment: helpComment ?? null,
      help_requested_at: new Date().toISOString(),
    };
  }

  return { status: nextStatus };
}
