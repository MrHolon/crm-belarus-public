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
import {
  insertTaskType,
  listTaskTypes,
  updateTaskType,
} from '../api/taskTypes';
import { canManageReferences } from '../lib/canManageReferences';
import { referenceKeys } from '../queryKeys';

const CODE_RE = /^[a-z][a-z0-9_]*$/;

interface Props {
  role: UserRole | null;
}

export function TaskTypesTab({ role }: Props) {
  const qc = useQueryClient();
  const manage = canManageReferences(role);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tables<'task_types'> | null>(null);

  const q = useQuery({
    queryKey: referenceKeys.taskTypes(),
    queryFn: listTaskTypes,
  });

  const form = useForm({
    initialValues: {
      code: '',
      name: '',
      order_index: 0,
      is_active: true,
    },
    validate: {
      code: (v) =>
        CODE_RE.test(v.trim()) ? null : 'Код: латиница, с буквы, цифры и _',
      name: (v) => (v.trim().length >= 2 ? null : 'Минимум 2 символа'),
    },
  });

  useEffect(() => {
    if (!modalOpen) return;
    if (editing) {
      form.setValues({
        code: editing.code,
        name: editing.name,
        order_index: editing.order_index,
        is_active: editing.is_active,
      });
    } else {
      form.setValues({
        code: '',
        name: '',
        order_index: ((q.data?.length ?? 0) + 1) * 10,
        is_active: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, editing?.id]);

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form.values) => {
      const payload = {
        code: values.code.trim().toLowerCase(),
        name: values.name.trim(),
        order_index: values.order_index,
        is_active: values.is_active,
      };
      if (editing) {
        return updateTaskType(editing.id, payload);
      }
      return insertTaskType(payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: referenceKeys.taskTypes() });
      notifications.show({
        title: 'Сохранено',
        message: editing ? 'Тип обновлён' : 'Тип создан',
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
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Тип задачи выбирается при создании. Код используется в данных и не
          должен совпадать с системными значениями без необходимости.
        </Text>
        {manage && (
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            Добавить тип
          </Button>
        )}
      </Group>

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
        title={editing ? 'Редактировать тип задачи' : 'Новый тип задачи'}
      >
        <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
          <Stack>
            <TextInput
              label="Код"
              required
              disabled={!!editing}
              description="Латиница, начинается с буквы"
              {...form.getInputProps('code')}
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
