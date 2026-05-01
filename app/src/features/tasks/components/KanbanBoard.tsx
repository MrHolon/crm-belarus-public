import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconExternalLink,
  IconGripVertical,
} from '@tabler/icons-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { Database } from '@/types/database';
import type { TaskListRow } from '../api/listTasks';
import { priorityColor, statusColor, TASK_STATUS_LABELS } from '../lib/labels';

type TaskStatus = Database['public']['Enums']['task_status'];

export type KanbanDensity = 'comfortable' | 'compact';

const KANBAN_STATUSES: TaskStatus[] = [
  'new',
  'in_progress',
  'done',
  'on_review',
  'needs_help',
];

/**
 * Columns that are hidden from the Kanban board as long as there are no
 * tasks in them. In this workflow "На проверке" is a rarely-used pit-stop
 * — collapsing it when empty keeps the board compact, but re-showing it
 * as soon as a task lands in it means nothing becomes invisible.
 */
const COLLAPSIBLE_WHEN_EMPTY: ReadonlySet<TaskStatus> = new Set(['on_review']);

const COLLAPSED_STORAGE_KEY = 'crm:tasks:kanban_collapsed';

function loadCollapsed(): Set<TaskStatus> {
  try {
    const raw = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is TaskStatus => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

function saveCollapsed(s: Set<TaskStatus>) {
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
}

function colId(status: TaskStatus) {
  return `kanban-col-${status}`;
}

function taskDragId(taskId: number) {
  return `task-${taskId}`;
}

function parseTaskDragId(id: string | number): number | null {
  const s = String(id);
  if (!s.startsWith('task-')) return null;
  const n = Number(s.slice(5));
  return Number.isFinite(n) ? n : null;
}

function resolveDropStatus(
  overId: string | number | null | undefined,
  taskById: Map<number, TaskListRow>,
): TaskStatus | null {
  if (overId == null) return null;
  const s = String(overId);
  if (s.startsWith('kanban-col-')) {
    return s.slice('kanban-col-'.length) as TaskStatus;
  }
  if (s.startsWith('task-')) {
    const tid = Number(s.slice(5));
    return taskById.get(tid)?.status ?? null;
  }
  return null;
}

/**
 * Human-friendly due date: today / tomorrow / "ещё N дн." / formatted date.
 * The string is intentionally short for Kanban cards.
 */
function formatDueShort(iso: string | null): { text: string; overdue: boolean } | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;

  const now = new Date();
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
  const overdue = due.getTime() < now.getTime();

  const fmtDate = (d: Date) =>
    d.toLocaleDateString('ru-BY', {
      timeZone: 'Europe/Minsk',
      day: '2-digit',
      month: '2-digit',
    });

  if (diffDays === 0) {
    return {
      text: `сегодня, ${due.toLocaleTimeString('ru-BY', {
        timeZone: 'Europe/Minsk',
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      overdue,
    };
  }
  if (diffDays === 1) return { text: `завтра, ${fmtDate(due)}`, overdue };
  if (diffDays === -1) return { text: `вчера, ${fmtDate(due)}`, overdue };
  if (diffDays > 1 && diffDays <= 7)
    return { text: `через ${diffDays} дн. · ${fmtDate(due)}`, overdue };
  if (diffDays < -1 && diffDays >= -30)
    return { text: `${Math.abs(diffDays)} дн. назад · ${fmtDate(due)}`, overdue };

  return { text: fmtDate(due), overdue };
}

/** Collapsed column — a thin vertical strip with label and count. */
function CollapsedColumn({
  status,
  count,
  onExpand,
}: {
  status: TaskStatus;
  count: number;
  onExpand: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: colId(status) });
  return (
    <Paper
      ref={setNodeRef}
      withBorder
      radius="md"
      p={0}
      onClick={onExpand}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onExpand();
        }
      }}
      aria-label={`Развернуть колонку «${TASK_STATUS_LABELS[status]}»`}
      style={{
        flex: '0 0 44px',
        minHeight: 200,
        display: 'flex',
        cursor: 'pointer',
        background: isOver
          ? 'var(--mantine-color-blue-light)'
          : 'var(--mantine-color-body)',
      }}
    >
      <Stack gap={8} align="center" justify="space-between" p="xs" style={{ width: '100%' }}>
        <Tooltip label={`Развернуть «${TASK_STATUS_LABELS[status]}»`} withArrow>
          <ActionIcon variant="subtle" size="sm" aria-hidden>
            <IconChevronRight size={14} />
          </ActionIcon>
        </Tooltip>
        <Text
          size="xs"
          fw={600}
          c={`${statusColor(status)}.6`}
          style={{
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            whiteSpace: 'nowrap',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}
        >
          {TASK_STATUS_LABELS[status]}
        </Text>
        <Badge size="sm" color={statusColor(status)} variant="light">
          {count}
        </Badge>
      </Stack>
    </Paper>
  );
}

function KanbanColumn({
  status,
  count,
  density,
  onCollapse,
  children,
}: {
  status: TaskStatus;
  count: number;
  density: KanbanDensity;
  onCollapse: () => void;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: colId(status),
  });

  const width = density === 'compact' ? 240 : 280;

  return (
    <Paper
      ref={setNodeRef}
      withBorder
      radius="md"
      p={0}
      style={{
        flex: `0 0 ${width}px`,
        minHeight: 200,
        maxHeight: 'calc(100vh - 220px)',
        display: 'flex',
        flexDirection: 'column',
        background: isOver
          ? 'var(--mantine-color-blue-light)'
          : 'var(--mantine-color-body)',
      }}
    >
      <Group
        justify="space-between"
        px="sm"
        py="xs"
        gap={4}
        style={{
          borderBottom: '1px solid var(--mantine-color-default-border)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        wrap="nowrap"
        onClick={onCollapse}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onCollapse();
          }
        }}
        aria-label={`Свернуть колонку «${TASK_STATUS_LABELS[status]}»`}
      >
        <Group gap={6} wrap="nowrap">
          <Badge size="sm" color={statusColor(status)} variant="light">
            {TASK_STATUS_LABELS[status]}
          </Badge>
        </Group>
        <Group gap={4} wrap="nowrap">
          <Text size="xs" c="dimmed">
            {count}
          </Text>
          <Tooltip label="Свернуть" withArrow>
            <ActionIcon
              variant="subtle"
              size="sm"
              aria-hidden
              onClick={(e) => {
                e.stopPropagation();
                onCollapse();
              }}
            >
              <IconChevronLeft size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <ScrollArea.Autosize mah="calc(100vh - 280px)" type="scroll" scrollbarSize={6}>
        <Stack gap={density === 'compact' ? 6 : 'xs'} p={density === 'compact' ? 6 : 'xs'}>
          {children}
        </Stack>
      </ScrollArea.Autosize>
    </Paper>
  );
}

/** Static card body shared by both the in-place card and the drag overlay. */
function KanbanCardBody({
  task,
  tags,
  density,
  disabled,
  onOpen,
}: {
  task: TaskListRow;
  tags: { id: number; name: string; color: string | null }[];
  density: KanbanDensity;
  disabled: boolean;
  onOpen?: () => void;
}) {
  const pri = priorityColor(task.priority);
  const due = formatDueShort(task.due_date);
  const overdue = !!task.is_overdue || !!due?.overdue;
  const isCompact = density === 'compact';

  return (
    <>
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 4,
          top: 6,
          bottom: 6,
          width: 3,
          borderRadius: 3,
          backgroundColor: `var(--mantine-color-${pri}-filled)`,
        }}
      />

      <Group justify="space-between" align="flex-start" wrap="nowrap" gap={6}>
        <Group gap={4} wrap="nowrap" style={{ flex: 1, minWidth: 0 }} align="flex-start">
          {!disabled ? (
            <IconGripVertical
              size={14}
              stroke={1.5}
              style={{
                color: 'var(--mantine-color-dimmed)',
                marginTop: 2,
                flexShrink: 0,
              }}
            />
          ) : null}
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" fw={500} lineClamp={isCompact ? 2 : 3}>
              {task.title}
            </Text>
            <Text size="xs" c="dimmed" ff="monospace" mt={2}>
              {task.ticket_number ?? `#${task.id}`}
            </Text>
          </Box>
        </Group>
        {onOpen ? (
          <ActionIcon
            size="sm"
            variant="subtle"
            aria-label="Открыть задачу"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            <IconExternalLink size={16} />
          </ActionIcon>
        ) : null}
      </Group>

      {!isCompact && task.description && task.description.trim().length > 0 ? (
        <Text size="xs" c="dimmed" mt={6} lineClamp={2} style={{ whiteSpace: 'pre-wrap' }}>
          {task.description}
        </Text>
      ) : null}

      {tags.length > 0 ? (
        <Group gap={4} mt={6} wrap="wrap">
          {tags.slice(0, isCompact ? 2 : 3).map((t) => (
            <Badge
              key={t.id}
              size="xs"
              variant="light"
              style={
                t.color ? { backgroundColor: `${t.color}22`, color: t.color } : undefined
              }
            >
              {t.name}
            </Badge>
          ))}
          {tags.length > (isCompact ? 2 : 3) ? (
            <Text size="xs" c="dimmed">
              +{tags.length - (isCompact ? 2 : 3)}
            </Text>
          ) : null}
        </Group>
      ) : null}

      <Group justify="space-between" mt={6} wrap="nowrap" gap={6}>
        <Text size="xs" c="dimmed" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
          {task.assignee?.full_name ?? '—'}
        </Text>
        {due ? (
          <Group
            gap={3}
            wrap="nowrap"
            style={{
              color: overdue
                ? 'var(--mantine-color-red-6)'
                : 'var(--mantine-color-dimmed)',
              fontWeight: overdue ? 600 : 400,
              flexShrink: 0,
            }}
          >
            <IconClock size={12} />
            <Text size="xs" inherit>
              {due.text}
            </Text>
          </Group>
        ) : null}
      </Group>
    </>
  );
}

function KanbanCard({
  task,
  tags,
  density,
  disabled,
  onOpen,
}: {
  task: TaskListRow;
  tags: { id: number; name: string; color: string | null }[];
  density: KanbanDensity;
  disabled: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: taskDragId(task.id),
    disabled,
  });

  const isCompact = density === 'compact';

  return (
    <Paper
      ref={setNodeRef}
      withBorder
      radius="sm"
      style={{
        position: 'relative',
        overflow: 'hidden',
        cursor: disabled ? 'default' : isDragging ? 'grabbing' : 'grab',
        paddingTop: isCompact ? 6 : 8,
        paddingRight: isCompact ? 8 : 10,
        paddingBottom: isCompact ? 6 : 8,
        paddingLeft: isCompact ? 10 : 12,
        opacity: isDragging ? 0.35 : 1,
        borderStyle: isDragging ? 'dashed' : 'solid',
        transition: 'opacity 150ms ease, border-style 150ms ease',
      }}
      {...listeners}
      {...attributes}
    >
      <KanbanCardBody
        task={task}
        tags={tags}
        density={density}
        disabled={disabled}
        onOpen={onOpen}
      />
    </Paper>
  );
}

/** Floating card rendered inside DragOverlay — follows the cursor on a portal layer. */
function DragOverlayCard({
  task,
  tags,
  density,
}: {
  task: TaskListRow;
  tags: { id: number; name: string; color: string | null }[];
  density: KanbanDensity;
}) {
  const isCompact = density === 'compact';
  const width = density === 'compact' ? 228 : 258;

  return (
    <Paper
      withBorder
      radius="sm"
      style={{
        position: 'relative',
        overflow: 'hidden',
        cursor: 'grabbing',
        paddingTop: isCompact ? 6 : 8,
        paddingRight: isCompact ? 8 : 10,
        paddingBottom: isCompact ? 6 : 8,
        paddingLeft: isCompact ? 10 : 12,
        width,
        boxShadow: '0 12px 28px rgba(0,0,0,0.18), 0 4px 10px rgba(0,0,0,0.12)',
        transform: 'scale(1.03) rotate(1.5deg)',
        background: 'var(--mantine-color-body)',
      }}
    >
      <KanbanCardBody task={task} tags={tags} density={density} disabled={false} />
    </Paper>
  );
}

export interface KanbanBoardProps {
  tasks: TaskListRow[];
  tagMap: Map<number, { id: number; name: string; color: string | null }[]>;
  density?: KanbanDensity;
  disabled?: boolean;
  onTaskOpen: (taskId: number) => void;
  onDragToStatus: (task: TaskListRow, nextStatus: TaskStatus) => void;
}

export function KanbanBoard({
  tasks,
  tagMap,
  density = 'comfortable',
  disabled = false,
  onTaskOpen,
  onDragToStatus,
}: KanbanBoardProps) {
  const [collapsed, setCollapsed] = useState<Set<TaskStatus>>(() => loadCollapsed());
  const [activeId, setActiveId] = useState<number | null>(null);

  const toggleCollapsed = (s: TaskStatus) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      saveCollapsed(next);
      return next;
    });
  };

  const taskById = useMemo(() => {
    const m = new Map<number, TaskListRow>();
    for (const t of tasks) m.set(t.id, t);
    return m;
  }, [tasks]);

  const byStatus = useMemo(() => {
    const m = new Map<TaskStatus, TaskListRow[]>();
    for (const s of KANBAN_STATUSES) m.set(s, []);
    for (const t of tasks) {
      if (t.status === 'cancelled') continue;
      const list = m.get(t.status);
      if (list) list.push(t);
    }
    return m;
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const taskId = parseTaskDragId(event.active.id);
    setActiveId(taskId);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || disabled) return;
      const taskId = parseTaskDragId(active.id);
      if (taskId == null) return;
      const task = taskById.get(taskId);
      if (!task) return;
      const nextStatus = resolveDropStatus(over.id, taskById);
      if (!nextStatus || nextStatus === task.status) return;
      onDragToStatus(task, nextStatus);
    },
    [disabled, taskById, onDragToStatus],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const activeTask = activeId != null ? taskById.get(activeId) ?? null : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <Box
        style={{
          display: 'flex',
          gap:
            density === 'compact'
              ? 'var(--mantine-spacing-sm)'
              : 'var(--mantine-spacing-md)',
          overflowX: 'auto',
          paddingBottom: 8,
        }}
      >
        {KANBAN_STATUSES.map((status) => {
          const colTasks = byStatus.get(status) ?? [];
          if (colTasks.length === 0 && COLLAPSIBLE_WHEN_EMPTY.has(status)) {
            return null;
          }
          if (collapsed.has(status)) {
            return (
              <CollapsedColumn
                key={status}
                status={status}
                count={colTasks.length}
                onExpand={() => toggleCollapsed(status)}
              />
            );
          }
          return (
            <KanbanColumn
              key={status}
              status={status}
              count={colTasks.length}
              density={density}
              onCollapse={() => toggleCollapsed(status)}
            >
              {colTasks.map((task) => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  tags={tagMap.get(task.id) ?? []}
                  density={density}
                  disabled={disabled}
                  onOpen={() => onTaskOpen(task.id)}
                />
              ))}
            </KanbanColumn>
          );
        })}
      </Box>

      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
        {activeTask ? (
          <DragOverlayCard
            task={activeTask}
            tags={tagMap.get(activeTask.id) ?? []}
            density={density}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
