import { useEffect, useState } from 'react';
import {
  Button,
  Group,
  Modal,
  NumberInput,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tables } from '@/types/database';
import type { UserRole } from '@/lib/auth-context';
import { listStatuses, updateStatus } from '../api/statuses';
import { canManageReferences } from '../lib/canManageReferences';
import { referenceKeys } from '../queryKeys';

interface Props {
  role: UserRole | null;
}

export function StatusesTab({ role }: Props) {
  const qc = useQueryClient();
  const manage = canManageReferences(role);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tables<'statuses'> | null>(null);

  const q = useQuery({
    queryKey: referenceKeys.statuses(),
    queryFn: listStatuses,
  });

  const form = useForm({
    initialValues: {
      name: '',
      order_index: 0,
      is_active: true,
    },
    validate: {
      name: (v) => (v.trim().length >= 1 ? null : 'Укажите название'),
    },
  });

  useEffect(() => {
    if (!modalOpen || !editing) return;
    form.setValues({
      name: editing.name,
      order_index: editing.order_index,
      is_active: editing.is_active,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, editing?.id]);

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form.values) => {
      if (!editing) throw new Error('Нет записи');
      return updateStatus(editing.id, {
        name: values.name.trim(),
        order_index: values.order_index,
        is_active: values.is_active,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: referenceKeys.statuses() });
      notifications.show({
        title: 'Сохранено',
        message: 'Статус обновлён',
        color: 'green',
      });
      setModalOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => {
      notifications.show({
        title: 'Ошибка',
        message: e.message || 'Не удалось сохранить',
        color: 'red',
      });
    },
  });

  const rows = q.data ?? [];

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Набор статусов в базе совпадает с перечислением задачи. Новые статусы
        добавляются только миграцией БД; здесь можно менять подписи и порядок.
      </Text>

      <Table.ScrollContainer minWidth={560}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Код</Table.Th>
              <Table.Th>Название</Table.Th>
              <Table.Th>Порядок</Table.Th>
              <Table.Th>Активен</Table.Th>
              {manage && <Table.Th w={120} />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>
                  <Text ff="monospace" size="sm">
                    {r.code}
                  </Text>
                </Table.Td>
                <Table.Td>{r.name}</Table.Td>
                <Table.Td>{r.order_index}</Table.Td>
                <Table.Td>{r.is_active ? 'Да' : 'Нет'}</Table.Td>
                {manage && (
                  <Table.Td>
                    <Button
                      variant="light"
                      size="xs"
                      onClick={() => {
                        setEditing(r);
                        setModalOpen(true);
                      }}
                    >
                      Изменить
                    </Button>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Modal
        opened={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        title="Редактировать статус"
      >
        <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
          <Stack>
            <TextInput
              label="Код"
              value={editing?.code ?? ''}
              disabled
              description="Неизменяем в интерфейсе"
            />
            <TextInput label="Название" required {...form.getInputProps('name')} />
            <NumberInput
              label="Порядок сортировки"
              {...form.getInputProps('order_index')}
            />
            <Switch
              label="Активен"
              {...form.getInputProps('is_active', { type: 'checkbox' })}
            />
            <Group justify="flex-end">
              <Button
                variant="default"
                onClick={() => {
                  setModalOpen(false);
                  setEditing(null);
                }}
              >
                Отмена
              </Button>
              <Button type="submit" loading={saveMutation.isPending}>
                Сохранить
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
