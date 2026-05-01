import { Paper, Text, Timeline } from '@mantine/core';
import { IconHistory } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { fetchTaskHistoryDisplay } from '../api/taskHistory';
import { formatTaskDateTime } from '../lib/formatTaskDate';

export interface TaskHistorySectionProps {
  taskId: number;
}

export function TaskHistorySection({ taskId }: TaskHistorySectionProps) {
  const historyQuery = useQuery({
    queryKey: ['task', 'history', taskId],
    queryFn: () => fetchTaskHistoryDisplay(taskId),
    enabled: Number.isFinite(taskId) && taskId > 0,
  });

  if (historyQuery.isPending) {
    return (
      <Text size="sm" c="dimmed">
        Загрузка истории…
      </Text>
    );
  }

  if (historyQuery.isError) {
    return (
      <Text size="sm" c="red">
        {(historyQuery.error as Error).message || 'Не удалось загрузить историю'}
      </Text>
    );
  }

  const rows = historyQuery.data ?? [];

  if (rows.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Записей истории пока нет.
      </Text>
    );
  }

  return (
    <Timeline
      active={rows.length > 0 ? rows.length - 1 : 0}
      bulletSize={22}
      lineWidth={2}
    >
      {rows.map((line) => (
        <Timeline.Item
          key={line.id}
          bullet={<IconHistory size={11} />}
          title={
            <Text size="xs" c="dimmed" lh={1.4}>
              {formatTaskDateTime(line.changed_at)}
              {line.actor ? (
                <>
                  {' '}
                  · {line.actor.full_name}{' '}
                  <Text span c="dimmed">
                    @{line.actor.login}
                  </Text>
                </>
              ) : (
                ' · кто изменил — не указан'
              )}
            </Text>
          }
        >
          <Paper withBorder p="sm" radius="md">
            <Text size="sm">
              <strong>{line.field_label}</strong>
            </Text>
            <Text size="sm" mt={4}>
              <Text span c="dimmed">
                Было:{' '}
              </Text>
              {line.old_label}
            </Text>
            <Text size="sm" mt={2}>
              <Text span c="dimmed">
                Стало:{' '}
              </Text>
              {line.new_label}
            </Text>
          </Paper>
        </Timeline.Item>
      ))}
    </Timeline>
  );
}
