import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconArrowDown, IconArrowUp } from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tables } from '@/types/database';
import {
  insertProblemCategory,
  listProblemCategories,
  swapCategorySortOrder,
  updateProblemCategory,
} from '../api/categories';
import { listPriorities } from '../api/priorities';
import { defaultPriorityIdForSeverity } from '../lib/defaultPriorityForSeverity';
import { canManageReferences } from '../lib/canManageReferences';
import { referenceKeys } from '../queryKeys';
import type { UserRole } from '@/lib/auth-context';

const SEVERITY_OPTIONS = [
  { value: 'normal', label: 'Обычная' },
  { value: 'important', label: 'Важная' },
  { value: 'critical', label: 'Критическая' },
] as const;

function severityLabel(s: Tables<'problem_categories'>['severity']) {
  return SEVERITY_OPTIONS.find((o) => o.value === s)?.label ?? s;
}

interface Props {
  role: UserRole | null;
}

export function CategoriesTab({ role }: Props) {
  const qc = useQueryClient();
  const manage = canManageReferences(role);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tables<'problem_categories'> | null>(
    null,
  );

  const categoriesQuery = useQuery({
    queryKey: referenceKeys.categories(),
    queryFn: listProblemCategories,
  });

  const prioritiesQuery = useQuery({
    queryKey: referenceKeys.priorities(),
    queryFn: listPriorities,
  });

  const priorities = prioritiesQuery.data ?? [];

  const form = useForm({
    initialValues: {
      name: '',
      description: '',
      severity: 'normal' as Tables<'problem_categories'>['severity'],
      default_priority_id: null as string | null,
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
        description: editing.description ?? '',
        severity: editing.severity,
        default_priority_id:
          editing.default_priority_id != null
            ? String(editing.default_priority_id)
            : null,
        is_active: editing.is_active,
      });
    } else {
      form.setValues({
        name: '',
        description: '',
        severity: 'normal',
        default_priority_id: defaultPriorityIdForSeverity('normal', priorities)
          ? String(defaultPriorityIdForSeverity('normal', priorities)!)
          : null,
        is_active: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open/edit sync only
  }, [modalOpen, editing?.id]);

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form.values) => {
      let defaultPriorityId = values.default_priority_id
        ? Number(values.default_priority_id)
        : null;
      if (defaultPriorityId == null || Number.isNaN(defaultPriorityId)) {
        defaultPriorityId = defaultPriorityIdForSeverity(
          values.severity,
          priorities,
        );
      }
      const payload = {
        name: values.name.trim(),
        description: values.description.trim() || null,
        severity: values.severity,
        default_priority_id: defaultPriorityId,
        is_active: values.is_active,
      };
      if (editing) {
        return updateProblemCategory(editing.id, payload);
      }
      return insertProblemCategory(payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: referenceKeys.categories() });
      notifications.show({
        title: 'Сохранено',
        message: editing ? 'Категория обновлена' : 'Категория создана',
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

  const reorderMutation = useMutation({
    mutationFn: async (payload: {
      a: { id: number; sort_order: number };
      b: { id: number; sort_order: number };
    }) => swapCategorySortOrder(payload.a, payload.b),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: referenceKeys.categories() });
    },
    onError: (e: Error) => {
      notifications.show({
        title: 'Не удалось переставить',
        message: e.message || 'Ошибка',
        color: 'red',
      });
    },
  });

  const rows = categoriesQuery.data ?? [];

  const moveCategory = (idx: number, direction: -1 | 1) => {
    const a = rows[idx];
    const b = rows[idx + direction];
    if (!a || !b) return;
    reorderMutation.mutate({
      a: { id: a.id, sort_order: a.sort_order },
      b: { id: b.id, sort_order: b.sort_order },
    });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Категории проблем обязательны при создании задачи. Деактивация скрывает
          категорию в списках, но не меняет уже созданные задачи.
        </Text>
        {manage && (
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            Добавить категорию
          </Button>
        )}
      </Group>

      <Table.ScrollContainer minWidth={720}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              {manage && <Table.Th w={88}>Порядок</Table.Th>}
              <Table.Th>Название</Table.Th>
              <Table.Th>Критичность</Table.Th>
              <Table.Th>Приоритет по умолчанию</Table.Th>
              <Table.Th>Статус</Table.Th>
              {manage && <Table.Th w={120} />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((c, idx) => {
              const dp = priorities.find((p) => p.id === c.default_priority_id);
              const isFirst = idx === 0;
              const isLast = idx === rows.length - 1;
              return (
                <Table.Tr key={c.id}>
                  {manage && (
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Tooltip label="Выше" withArrow>
                          <ActionIcon
                            size="sm"
                            variant="light"
                            aria-label="Выше"
                            disabled={isFirst || reorderMutation.isPending}
                            onClick={() => moveCategory(idx, -1)}
                          >
                            <IconArrowUp size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Ниже" withArrow>
                          <ActionIcon
                            size="sm"
                            variant="light"
                            aria-label="Ниже"
                            disabled={isLast || reorderMutation.isPending}
                            onClick={() => moveCategory(idx, 1)}
                          >
                            <IconArrowDown size={14} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  )}
                  <Table.Td>
                    <Text fw={500}>{c.name}</Text>
                    {c.description ? (
                      <Text size="xs" c="dimmed" lineClamp={2}>
                        {c.description}
                      </Text>
                    ) : null}
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light">{severityLabel(c.severity)}</Badge>
                  </Table.Td>
                  <Table.Td>{dp?.name ?? '—'}</Table.Td>
                  <Table.Td>
                    {c.is_active ? (
                      <Badge color="green">Активна</Badge>
                    ) : (
                      <Badge color="gray">Неактивна</Badge>
                    )}
                  </Table.Td>
                  {manage && (
                    <Table.Td>
                      <Button
                        variant="light"
                        size="xs"
                        onClick={() => {
                          setEditing(c);
                          setModalOpen(true);
                        }}
                      >
                        Изменить
                      </Button>
                    </Table.Td>
                  )}
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Modal
        opened={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        title={editing ? 'Редактировать категорию' : 'Новая категория'}
      >
        <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
          <Stack>
            <TextInput
              label="Название"
              required
              {...form.getInputProps('name')}
            />
            <Textarea
              label="Описание"
              minRows={2}
              {...form.getInputProps('description')}
            />
            <Select
              label="Критичность"
              data={[...SEVERITY_OPTIONS]}
              {...form.getInputProps('severity')}
              onChange={(v) => {
                form.setFieldValue(
                  'severity',
                  (v ?? 'normal') as Tables<'problem_categories'>['severity'],
                );
                const pid = defaultPriorityIdForSeverity(
                  (v ?? 'normal') as Tables<'problem_categories'>['severity'],
                  priorities,
                );
                if (pid != null) {
                  form.setFieldValue('default_priority_id', String(pid));
                }
              }}
            />
            <Select
              label="Приоритет по умолчанию"
              placeholder="Авто по критичности"
              clearable
              data={priorities.map((p) => ({
                value: String(p.id),
                label: `${p.name} (${p.code})`,
              }))}
              {...form.getInputProps('default_priority_id')}
            />
            <Switch
              label="Активна"
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
