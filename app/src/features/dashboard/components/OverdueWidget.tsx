import { Anchor, Stack } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { IconClockExclamation } from '@tabler/icons-react';
import { fetchMyOverdueTasks } from '../api/dashboardQueries';
import { DashboardTaskRow } from './DashboardTaskRow';
import {
  WidgetCard,
  WidgetEmpty,
  WidgetError,
  WidgetSkeletonText,
} from './WidgetCard';

interface Props {
  userId: string;
}

export function OverdueWidget({ userId }: Props) {
  const q = useQuery({
    queryKey: ['dashboard', 'overdue', userId],
    queryFn: () => fetchMyOverdueTasks(userId, 5),
    staleTime: 30_000,
  });

  return (
    <WidgetCard
      title="Просроченные"
      icon={<IconClockExclamation size={16} />}
      color="red"
      action={
        <Anchor component={Link} to="/tasks" size="xs">
          Все мои
        </Anchor>
      }
    >
      {q.isPending ? (
        <WidgetSkeletonText />
      ) : q.isError ? (
        <WidgetError text="Не удалось загрузить просрочки" />
      ) : q.data && q.data.length > 0 ? (
        <Stack gap={2}>
          {q.data.map((t) => (
            <DashboardTaskRow key={t.id} task={t} emphasizeDue />
          ))}
        </Stack>
      ) : (
        <WidgetEmpty text="Просроченных задач нет" />
      )}
    </WidgetCard>
  );
}
