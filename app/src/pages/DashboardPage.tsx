import {
  Anchor,
  Badge,
  Card,
  Container,
  Grid,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconBellRinging,
  IconListCheck,
  IconPlus,
  IconSparkles,
} from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { ROLE_LABELS } from '@/lib/nav';
import {
  CriticalCategoriesWidget,
  MyInProgressWidget,
  NeedsHelpWidget,
  OverdueWidget,
} from '@/features/dashboard';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function useUnreadCount(userId: string | undefined) {
  return useQuery({
    enabled: !!userId,
    queryKey: ['notifications', 'unread-count', userId],
    staleTime: 10_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function DashboardPage() {
  const { profile, role } = useAuth();
  const unread = useUnreadCount(profile?.id);

  // Live-refresh is wired globally in AppLayout — any task change there
  // invalidates the `['dashboard']` cache so these widgets re-fetch.

  // Видимость виджетов по ТЗ §5.3 / §5.2.
  const showNeedsHelp =
    role === 'specialist' ||
    role === 'duty_officer' ||
    role === 'manager' ||
    role === 'admin';
  const showCritical =
    role === 'duty_officer' || role === 'manager' || role === 'admin';

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Stack gap={4}>
            <Text c="dimmed" size="sm">
              {greeting()},
            </Text>
            <Title order={2}>{profile?.full_name ?? 'пользователь'}</Title>
          </Stack>
          {role && (
            <Badge size="lg" variant="light">
              Роль: {ROLE_LABELS[role]}
            </Badge>
          )}
        </Group>

        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card withBorder radius="md" padding="lg" h="100%">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Text size="sm" c="dimmed">
                    Непрочитанные уведомления
                  </Text>
                  <Title order={3}>
                    {unread.isPending ? '…' : (unread.data ?? 0)}
                  </Title>
                </Stack>
                <ThemeIcon size="lg" variant="light" color="red" radius="md">
                  <IconBellRinging size={20} />
                </ThemeIcon>
              </Group>
              <Text size="xs" c="dimmed" mt="xs">
                Колокольчик в шапке покажет все события по вашим задачам в
                реальном времени.
              </Text>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card withBorder radius="md" padding="lg" h="100%">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Text size="sm" c="dimmed">
                    Быстрые действия
                  </Text>
                  <Title order={3}>Задачи</Title>
                </Stack>
                <ThemeIcon size="lg" variant="light" color="brand" radius="md">
                  <IconListCheck size={20} />
                </ThemeIcon>
              </Group>
              <Group gap="sm" mt="md">
                <Anchor component={Link} to="/tasks/new" size="sm">
                  <Group gap={4}>
                    <IconPlus size={14} />
                    Создать задачу
                  </Group>
                </Anchor>
                <Anchor component={Link} to="/tasks" size="sm">
                  Перейти к моим задачам
                </Anchor>
              </Group>
            </Card>
          </Grid.Col>
        </Grid>

        {profile?.id && (
          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <MyInProgressWidget userId={profile.id} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <OverdueWidget userId={profile.id} />
            </Grid.Col>
            {showNeedsHelp && (
              <Grid.Col span={{ base: 12, md: showCritical ? 6 : 12 }}>
                <NeedsHelpWidget />
              </Grid.Col>
            )}
            {showCritical && (
              <Grid.Col span={{ base: 12, md: showNeedsHelp ? 6 : 12 }}>
                <CriticalCategoriesWidget />
              </Grid.Col>
            )}
          </Grid>
        )}

        <Card withBorder radius="md" padding="lg">
          <Group gap="sm" align="flex-start">
            <ThemeIcon size="lg" variant="light" color="teal" radius="md">
              <IconSparkles size={20} />
            </ThemeIcon>
            <Stack gap={4}>
              <Text fw={600}>Что готово в MVP</Text>
              <Text size="sm" c="dimmed">
                Аутентификация через Supabase, автосоздание профиля с ролью,
                приватные роуты, макет приложения со светлой и тёмной темой и
                Realtime-колокольчик уведомлений.
              </Text>
              <Text size="sm" c="dimmed">
                Следующие шаги: полировка виджетов, тесты RLS, Webhook-и, база
                знаний и вложения.
              </Text>
            </Stack>
          </Group>
        </Card>
      </Stack>
    </Container>
  );
}
