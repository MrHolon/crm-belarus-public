import { Badge, Group, Stack, Text } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import type { TaskListRow } from '@/features/tasks/api/listTasks';
import {
  priorityColor,
  TASK_PRIORITY_LABELS,
} from '@/features/tasks/lib/labels';
import { formatTaskDateTime } from '@/features/tasks/lib/formatTaskDate';

interface Props {
  task: TaskListRow;
  /** Показывать исполнителя (для виджета «Нужна помощь» — полезно). */
  showAssignee?: boolean;
  /** Подсвечивать дедлайн красным (для виджета «Просроченные»). */
  emphasizeDue?: boolean;
}

export function DashboardTaskRow({
  task,
  showAssignee = false,
  emphasizeDue = false,
}: Props) {
  const ticket = task.ticket_number ?? `#${task.id}`;
  const due = task.due_date ? formatTaskDateTime(task.due_date) : null;

  return (
    <Link
      to="/tasks/$taskId"
      params={{ taskId: String(task.id) }}
      style={{
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
        padding: '6px 4px',
        borderRadius: 6,
      }}
      className="dashboard-task-row"
    >
      <Group wrap="nowrap" gap="xs" align="flex-start">
        <Badge
          size="xs"
          variant="light"
          color={priorityColor(task.priority)}
          style={{ flexShrink: 0, marginTop: 4 }}
        >
          {TASK_PRIORITY_LABELS[task.priority]}
        </Badge>
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={500} lineClamp={1}>
            {task.title}
          </Text>
          <Group gap={6} wrap="nowrap">
            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
              {ticket}
            </Text>
            {task.category?.name && (
              <Text size="xs" c="dimmed" lineClamp={1}>
                · {task.category.name}
              </Text>
            )}
            {showAssignee && task.assignee?.full_name && (
              <Text size="xs" c="dimmed" lineClamp={1}>
                · {task.assignee.full_name}
              </Text>
            )}
            {due && (
              <Text
                size="xs"
                c={emphasizeDue ? 'red' : 'dimmed'}
                fw={emphasizeDue ? 600 : 400}
                style={{ flexShrink: 0 }}
              >
                · до {due}
              </Text>
            )}
          </Group>
        </Stack>
      </Group>
    </Link>
  );
}
