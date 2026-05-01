import { useState } from 'react';
import {
  Badge,
  Button,
  Group,
  Loader,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tables } from '@/types/database';
import { useAuth } from '@/lib/auth-context';
import type { UserRole } from '@/lib/auth-context';
import { ROLE_LABELS } from '@/lib/nav';
import { listUsersForAdmin, updateUserFields } from './api/users';
import { InviteUserModal } from './components/InviteUserModal';
import { formatMinskDateTime } from './lib/formatMinsk';
import { usersAdminKeys } from './queryKeys';

const ROLE_SELECT_DATA = (
  Object.keys(ROLE_LABELS) as UserRole[]
).map((value) => ({
  value,
  label: ROLE_LABELS[value],
}));

export function UsersPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const currentId = user?.id ?? null;
  const [inviteOpen, setInviteOpen] = useState(false);

  const usersQuery = useQuery({
    queryKey: usersAdminKeys.list(),
    queryFn: listUsersForAdmin,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<Tables<'users'>, 'role' | 'is_active'>>;
    }) => updateUserFields(id, patch),
    onSuccess: async (_data, { id }) => {
      await qc.invalidateQueries({ queryKey: usersAdminKeys.list() });
      if (id === currentId) {
        await qc.invalidateQueries({ queryKey: ['auth', 'profile', currentId] });
      }
      notifications.show({
        title: 'Сохранено',
        message: 'Данные пользователя обновлены',
        color: 'green',
      });
    },
    onError: (e: Error) => {
      notifications.show({
        title: 'Ошибка',
        message: e.message || 'Не удалось сохранить',
        color: 'red',
      });
    },
  });

  const rows = usersQuery.data ?? [];

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Title order={2}>Пользователи</Title>
          <Text c="dimmed" size="sm" mt={4}>
            Роли, активность учётных записей и приглашение новых сотрудников.
            Деактивация скрывает пользователя из списков назначения; задачи
            сохраняются.
          </Text>
        </div>
        <Button onClick={() => setInviteOpen(true)}>Пригласить</Button>
      </Group>

      {usersQuery.isPending ? (
        <Loader />
      ) : usersQuery.isError ? (
        <Text c="red">Не удалось загрузить список пользователей.</Text>
      ) : (
        <Table.ScrollContainer minWidth={960}>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>ФИО</Table.Th>
                <Table.Th>Логин</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Телефон</Table.Th>
                <Table.Th>Роль</Table.Th>
                <Table.Th>Активен</Table.Th>
                <Table.Th>Создан</Table.Th>
                <Table.Th>Последняя активность</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => {
                const isSelf = row.id === currentId;
                return (
                  <Table.Tr key={row.id}>
                    <Table.Td>
                      <Text fw={500} size="sm">
                        {row.full_name}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" ff="monospace">
                        {row.login}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{row.email ?? '—'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{row.phone ?? '—'}</Text>
                    </Table.Td>
                    <Table.Td maw={200}>
                      <Select
                        size="xs"
                        data={ROLE_SELECT_DATA}
                        value={row.role}
                        disabled={isSelf || updateMutation.isPending}
                        onChange={(v) => {
                          if (!v || isSelf) return;
                          updateMutation.mutate({
                            id: row.id,
                            patch: { role: v as UserRole },
                          });
                        }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Switch
                        checked={row.is_active}
                        disabled={isSelf || updateMutation.isPending}
                        onChange={(e) =>
                          updateMutation.mutate({
                            id: row.id,
                            patch: { is_active: e.currentTarget.checked },
                          })
                        }
                      />
                      {!row.is_active && (
                        <Badge size="xs" color="gray" mt={4} variant="light">
                          Отключён
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">
                        {formatMinskDateTime(row.created_at)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">
                        {formatMinskDateTime(row.last_seen_at)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <InviteUserModal
        opened={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />
    </Stack>
  );
}
