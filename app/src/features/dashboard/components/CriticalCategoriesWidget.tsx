import { Badge, Group, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconFlame } from '@tabler/icons-react';
import { fetchCriticalCategoriesOpen } from '../api/dashboardQueries';
import {
  WidgetCard,
  WidgetEmpty,
  WidgetError,
  WidgetSkeletonText,
} from './WidgetCard';

export function CriticalCategoriesWidget() {
  const q = useQuery({
    queryKey: ['dashboard', 'critical-categories'],
    queryFn: () => fetchCriticalCategoriesOpen(5, 30),
    staleTime: 60_000,
  });

  return (
    <WidgetCard
      title="Критические категории (30 дней)"
      icon={<IconFlame size={16} />}
      color="red"
    >
      {q.isPending ? (
        <WidgetSkeletonText />
      ) : q.isError ? (
        <WidgetError text="Не удалось загрузить статистику" />
      ) : q.data && q.data.length > 0 ? (
        <Stack gap={4}>
          {q.data.map((cat) => (
            <Group
              key={cat.id}
              justify="space-between"
              wrap="nowrap"
              gap="xs"
              style={{ padding: '4px 2px' }}
            >
              <Text size="sm" lineClamp={1}>
                {cat.name}
              </Text>
              <Badge size="sm" color="red" variant="light">
                {cat.openCount}
              </Badge>
            </Group>
          ))}
        </Stack>
      ) : (
        <WidgetEmpty text="Критических задач нет" />
      )}
    </WidgetCard>
  );
}
