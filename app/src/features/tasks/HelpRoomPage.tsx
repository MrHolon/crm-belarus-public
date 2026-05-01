import { useState } from 'react';
import {
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconLifebuoy } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth-context';
import { fetchHelpRoomTasks } from './api/fetchHelpRoomTasks';
import { fetchHelperTaskIds } from './api/listTasks';
import { joinTaskAsHelper } from './api/joinTaskAsHelper';
import { formatTaskDateTime } from './lib/formatTaskDate';
import { formatTaskUpdateError } from './lib/formatTaskUpdateError';
import {
  priorityColor,
  statusColor,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from './lib/labels';

export function HelpRoomPage() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [joinTaskId, setJoinTaskId] = useState<number | null>(null);
  const [joinComment, setJoinComment] = useState('');

  const listQuery = useQuery({
    queryKey: ['tasks', 'help-room'],
    queryFn: fetchHelpRoomTasks,
  });

  const helperIdsQuery = useQuery({
    queryKey: ['tasks', 'helper-ids', user?.id],
    queryFn: () => fetchHelperTaskIds(user!.id),
    enabled: !!user?.id,
  });

  const joinMut = useMutation({
    mutationFn: async (payload: { taskId: number; comment: string }) => {
      await joinTaskAsHelper(payload.taskId, payload.comment || undefined);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', 'help-room'] });
      void queryClient.invalidateQueries({ queryKey: ['tasks', 'helper-ids', user?.id] });
      void queryClient.invalidateQueries({ queryKey: ['tasks', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setJoinTaskId(null);
      setJoinComment('');
      notifications.show({
        title: 'Вы в помощниках',
        message: 'Исполнитель получит уведомление.',
        color: 'green',
      });
    },
    onError: (e: Error) => {
      notifications.show({
        title: 'Ошибка',
        message: formatTaskUpdateError(e) || e.message,
        color: 'red',
      });
    },
  });

  const uid = user?.id ?? '';
  const helperSet = new Set(helperIdsQuery.data ?? []);

  const openJoin = (taskId: number) => {
    setJoinTaskId(taskId);
    setJoinComment('');
  };

  const submitJoin = () => {
    if (joinTaskId == null) return;
    joinMut.mutate({ taskId: joinTaskId, comment: joinComment.trim() });
  };

  if (listQuery.isPending) {
    return (
      <Group>
        <Loader size="sm" />
        <Text c="dimmed">Загрузка пула…</Text>
      </Group>
    );
  }

  if (listQuery.isError) {
    return (
      <Text c="red">{(listQuery.error as Error).message || 'Не удалось загрузить список'}</Text>
    );
  }

  const rows = listQuery.data ?? [];

  return (
    <Stack gap="md">
      <div>
        <Group gap="sm" align="center">
          <IconLifebuoy size={28} />
          <Title order={2}>Нужна помощь</Title>
        </Group>
        <Text size="sm" c="dimmed" mt={4}>
          Задачи в статусе «Нужна помощь». Можно присоединиться как помощник — задача появится в «Моих
          задачах», исполнитель получит уведомление.
        </Text>
      </div>

      <Paper withBorder p={0} radius="md">
        {rows.length === 0 ? (
          <Text p="md" c="dimmed">
            Сейчас нет задач в этом статусе.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={720}>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>№</Table.Th>
                  <Table.Th>Заголовок</Table.Th>
                  <Table.Th>Исполнитель</Table.Th>
                  <Table.Th>Запрошено</Table.Th>
                  <Table.Th w={140} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((t) => {
                  const isAssignee = t.assignee_id === uid;
                  const alreadyHelper = helperSet.has(t.id);
                  const canJoin =
                    !!uid &&
                    !isAssignee &&
                    !alreadyHelper &&
                    role &&
                    role !== 'accountant';

                  return (
                    <Table.Tr key={t.id}>
                      <Table.Td>
                        <Button
                          variant="subtle"
                          size="compact-xs"
                          component={Link}
                          to={`/tasks/${t.id}`}
                        >
                          {t.ticket_number ?? t.id}
                        </Button>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={2}>
                          {t.title}
                        </Text>
                        <Group gap={6} mt={4}>
                          <Badge size="xs" color={statusColor(t.status)} variant="light">
                            {TASK_STATUS_LABELS[t.status]}
                          </Badge>
                          <Badge size="xs" color={priorityColor(t.priority)} variant="outline">
                            {TASK_PRIORITY_LABELS[t.priority]}
                          </Badge>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{t.assignee?.full_name ?? '—'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {t.help_requested_at ? formatTaskDateTime(t.help_requested_at) : '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {alreadyHelper ? (
                          <Text size="xs" c="dimmed">
                            Вы помощник
                          </Text>
                        ) : isAssignee ? (
                          <Text size="xs" c="dimmed">
                            Вы исполнитель
                          </Text>
                        ) : !canJoin ? (
                          <Text size="xs" c="dimmed">
                            —
                          </Text>
                        ) : (
                          <Button size="xs" variant="light" onClick={() => openJoin(t.id)}>
                            Присоединиться
                          </Button>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <Modal opened={joinTaskId !== null} onClose={() => setJoinTaskId(null)} title="Помочь по задаче">
        <Text size="sm" mb="sm">
          Кратко опишите, чем можете помочь (необязательно). Вы будете добавлены в помощники задачи.
        </Text>
        <Textarea
          minRows={3}
          value={joinComment}
          onChange={(e) => setJoinComment(e.currentTarget.value)}
          placeholder="Комментарий для исполнителя…"
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setJoinTaskId(null)}>
            Отмена
          </Button>
          <Button onClick={submitJoin} loading={joinMut.isPending}>
            Присоединиться
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}
