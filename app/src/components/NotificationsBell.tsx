import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Divider,
  Group,
  Indicator,
  Popover,
  ScrollArea,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { notifications as mantineNotifications } from '@mantine/notifications';
import { IconBell, IconBellOff, IconCheck } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import relativeTime from 'dayjs/plugin/relativeTime';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Tables } from '@/types/database';

dayjs.extend(relativeTime);
dayjs.locale('ru');

type Notification = Tables<'notifications'>;

const NOTIFICATIONS_QUERY_KEY = ['notifications'] as const;

function useNotifications(userId: string | undefined) {
  return useQuery<Notification[]>({
    enabled: !!userId,
    queryKey: [...NOTIFICATIONS_QUERY_KEY, userId],
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function NotificationsBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const { data, isPending } = useNotifications(user?.id);
  const mutatingRef = useRef(false);

  const unread = useMemo(
    () => (data ?? []).filter((n) => !n.is_read).length,
    [data],
  );

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`realtime:notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (!mutatingRef.current) {
            queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const notifQueryKey = [...NOTIFICATIONS_QUERY_KEY, user?.id];

  const markOne = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id: number) => {
      mutatingRef.current = true;
      await queryClient.cancelQueries({ queryKey: notifQueryKey });
      const prev = queryClient.getQueryData<Notification[]>(notifQueryKey);
      queryClient.setQueryData<Notification[]>(notifQueryKey, (old) =>
        old?.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(notifQueryKey, ctx.prev);
    },
    onSettled: () => {
      mutatingRef.current = false;
      queryClient.invalidateQueries({ queryKey: notifQueryKey });
    },
  });

  const markAll = useMutation({
    mutationFn: async (ids: number[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', ids);
      if (error) throw error;
    },
    onMutate: async () => {
      mutatingRef.current = true;
      await queryClient.cancelQueries({ queryKey: notifQueryKey });
      const prev = queryClient.getQueryData<Notification[]>(notifQueryKey);
      queryClient.setQueryData<Notification[]>(notifQueryKey, (old) =>
        old?.map((n) => ({ ...n, is_read: true })),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(notifQueryKey, ctx.prev);
      mantineNotifications.show({
        color: 'red',
        title: 'Ошибка',
        message: 'Не удалось отметить уведомления как прочитанные',
      });
    },
    onSettled: () => {
      mutatingRef.current = false;
      queryClient.invalidateQueries({ queryKey: notifQueryKey });
    },
  });

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      width={360}
      shadow="md"
      withArrow
      trapFocus={false}
    >
      <Popover.Target>
        <ActionIcon
          variant="subtle"
          size="lg"
          aria-label="Уведомления"
          title="Уведомления"
          onClick={() => setOpened((o) => !o)}
        >
          <Indicator
            color="red"
            size={16}
            offset={-4}
            label={unread > 9 ? '9+' : unread}
            disabled={unread === 0}
            inline
          >
            <IconBell size={20} />
          </Indicator>
        </ActionIcon>
      </Popover.Target>

      <Popover.Dropdown p={0}>
        <Group justify="space-between" p="sm">
          <Group gap="xs">
            <Text fw={600}>Уведомления</Text>
            {unread > 0 && (
              <Badge size="sm" variant="light" color="red">
                {unread}
              </Badge>
            )}
          </Group>
          <Button
            size="compact-xs"
            variant="subtle"
            leftSection={<IconCheck size={14} />}
            disabled={unread === 0 || markAll.isPending}
            onClick={() => {
              const ids = (data ?? []).filter((n) => !n.is_read).map((n) => n.id);
              if (ids.length > 0) markAll.mutate(ids);
            }}
          >
            Прочитать всё
          </Button>
        </Group>
        <Divider />

        <ScrollArea.Autosize mah={400}>
          {isPending ? (
            <Text p="md" c="dimmed" ta="center" size="sm">
              Загрузка…
            </Text>
          ) : !data || data.length === 0 ? (
            <Stack gap={4} p="lg" align="center">
              <IconBellOff size={24} color="var(--mantine-color-dimmed)" />
              <Text c="dimmed" size="sm">
                Пока пусто
              </Text>
            </Stack>
          ) : (
            <Stack gap={0} py={4}>
              {data.map((n) => (
                <UnstyledButton
                  key={n.id}
                  px="sm"
                  py="xs"
                  onClick={() => {
                    if (!n.is_read) markOne.mutate(n.id);
                  }}
                  style={{
                    background: n.is_read
                      ? 'transparent'
                      : 'var(--mantine-color-blue-light)',
                    borderBottom: '1px solid var(--mantine-color-default-border)',
                  }}
                >
                  <Stack gap={2}>
                    <Group justify="space-between" wrap="nowrap">
                      <Text size="sm" fw={n.is_read ? 400 : 600} lineClamp={1}>
                        {n.title}
                      </Text>
                      <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                        {dayjs(n.created_at).fromNow()}
                      </Text>
                    </Group>
                    {n.body && (
                      <Text size="xs" c="dimmed" lineClamp={2}>
                        {n.body}
                      </Text>
                    )}
                  </Stack>
                </UnstyledButton>
              ))}
            </Stack>
          )}
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}
