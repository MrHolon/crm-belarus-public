import { useEffect, useState } from 'react';
import {
  Button,
  ColorInput,
  Group,
  Modal,
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
import { useAuth } from '@/lib/auth-context';
import type { UserRole } from '@/lib/auth-context';
import { insertTag, listTags, updateTag } from '../api/tags';
import { canManageReferences } from '../lib/canManageReferences';
import { referenceKeys } from '../queryKeys';

interface Props {
  role: UserRole | null;
}

export function TagsTab({ role }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const manage = canManageReferences(role);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tables<'tags'> | null>(null);

  const q = useQuery({
    queryKey: referenceKeys.tags(),
    queryFn: listTags,
  });

  const form = useForm({
    initialValues: {
      name: '',
      color: '',
      is_active: true,
    },
    validate: {
      name: (v) => (v.trim().length >= 2 ? null : 'Минимум 2 символа'),
    },
  });

  useEffect(() => {
    if (!modalOpen) return;
    if (editing) {
      form.setValues({
        name: editing.name,
        color: editing.color ?? '',
        is_active: editing.is_active,
      });
    } else {
      form.setValues({
        name: '',
        color: '',
        is_active: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, editing?.id]);

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form.values) => {
      const color =
        values.color.trim() === '' ? null : values.color.trim();
      const payload = {
        name: values.name.trim(),
        color,
        is_active: values.is_active,
      };
      if (editing) {
        return updateTag(editing.id, payload);
      }
      if (!user?.id) throw new Error('Нет пользователя');
      return insertTag({
        ...payload,
        created_by: user.id,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: referenceKeys.tags() });
      notifications.show({
        title: 'Сохранено',
        message: editing ? 'Тег обновлён' : 'Тег создан',
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
          Теги также можно создавать при вводе в карточке задачи. Здесь —
          каталог: цвет метки и отключение без удаления связей с задачами.
        </Text>
        {manage && (
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            Добавить тег
          </Button>
        )}
      </Group>

      <Table.ScrollContainer minWidth={480}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Цвет</Table.Th>
              <Table.Th>Название</Table.Th>
              <Table.Th>Активен</Table.Th>
              {manage && <Table.Th w={120} />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td w={72}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      backgroundColor: r.color ?? 'var(--mantine-color-gray-4)',
                      border: '1px solid var(--mantine-color-gray-3)',
                    }}
                  />
                </Table.Td>
                <Table.Td>{r.name}</Table.Td>
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
        title={editing ? 'Редактировать тег' : 'Новый тег'}
      >
        <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
          <Stack>
            <TextInput label="Название" required {...form.getInputProps('name')} />
            <ColorInput
              label="Цвет"
              placeholder="По умолчанию"
              format="hex"
              swatches={[
                '#25262b',
                '#868e96',
                '#fa5252',
                '#e64980',
                '#be4bdb',
                '#7950f2',
                '#4c6ef5',
                '#228be6',
                '#15aabf',
                '#12b886',
                '#40c057',
                '#82c91e',
                '#fab005',
                '#fd7e14',
              ]}
              {...form.getInputProps('color')}
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
