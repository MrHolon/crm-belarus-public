import { Anchor, Stack } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { IconPlayerPlay } from '@tabler/icons-react';
import { fetchMyInProgressTasks } from '../api/dashboardQueries';
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

export function MyInProgressWidget({ userId }: Props) {
  const q = useQuery({
    queryKey: ['dashboard', 'my-in-progress', userId],
    queryFn: () => fetchMyInProgressTasks(userId, 5),
    staleTime: 30_000,
  });

  return (
    <WidgetCard
      title="В работе у меня"
      icon={<IconPlayerPlay size={16} />}
      color="blue"
      action={
        <Anchor component={Link} to="/tasks" size="xs">
          Все мои
        </Anchor>
      }
    >
      {q.isPending ? (
        <WidgetSkeletonText />
      ) : q.isError ? (
        <WidgetError text="Не удалось загрузить задачи" />
      ) : q.data && q.data.length > 0 ? (
        <Stack gap={2}>
          {q.data.map((t) => (
            <DashboardTaskRow key={t.id} task={t} />
          ))}
        </Stack>
      ) : (
        <WidgetEmpty text="Нет задач в работе" />
      )}
    </WidgetCard>
  );
}
