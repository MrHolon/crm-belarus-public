import { Anchor, Stack } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { IconLifebuoy } from '@tabler/icons-react';
import { fetchNeedsHelpTasks } from '../api/dashboardQueries';
import { DashboardTaskRow } from './DashboardTaskRow';
import {
  WidgetCard,
  WidgetEmpty,
  WidgetError,
  WidgetSkeletonText,
} from './WidgetCard';

export function NeedsHelpWidget() {
  const q = useQuery({
    queryKey: ['dashboard', 'needs-help'],
    queryFn: () => fetchNeedsHelpTasks(5),
    staleTime: 30_000,
  });

  return (
    <WidgetCard
      title="Нужна помощь"
      icon={<IconLifebuoy size={16} />}
      color="yellow"
      action={
        <Anchor component={Link} to="/help-room" size="xs">
          Все
        </Anchor>
      }
    >
      {q.isPending ? (
        <WidgetSkeletonText />
      ) : q.isError ? (
        <WidgetError text="Не удалось загрузить запросы" />
      ) : q.data && q.data.length > 0 ? (
        <Stack gap={2}>
          {q.data.map((t) => (
            <DashboardTaskRow key={t.id} task={t} showAssignee />
          ))}
        </Stack>
      ) : (
        <WidgetEmpty text="Открытых запросов помощи нет" />
      )}
    </WidgetCard>
  );
}
