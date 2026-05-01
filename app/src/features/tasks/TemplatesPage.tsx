import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Select,
  Slider,
  Stack,
  Table,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useAuth, type UserRole } from '@/lib/auth-context';
import {
  deleteTaskTemplate,
  listTaskTemplates,
  updateTaskTemplate,
  type TaskTemplateRow,
} from './api/taskTemplates';
import { fetchTaskFormReferences } from './api/referenceQueries';
import { taskPriorityFromCategory } from './lib/taskPriorityFromCategory';
import { TASK_PRIORITY_LABELS } from './lib/labels';
import { taskTemplateEditSchema, type TaskTemplateEditValues } from './schemas';

function canMutateTaskTemplate(
  t: TaskTemplateRow,
  userId: string,
  role: UserRole | null,
): boolean {
  if (t.created_by === userId) return true;
  if (t.is_public && (role === 'manager' || role === 'admin')) return true;
  return false;
}

function canPublishTemplate(role: UserRole | null): boolean {
  return role === 'manager' || role === 'admin';
}

export function TemplatesPage() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id ?? '';

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<TaskTemplateRow | null>(null);

  const refsQuery = useQuery({
    queryKey: ['tasks', 'new', 'refs'],
    queryFn: fetchTaskFormReferences,
  });

  const listQuery = useQuery({
    queryKey: ['task-templates'],
    queryFn: listTaskTemplates,
  });

  const editForm = useForm<TaskTemplateEditValues>({
    initialValues: {
      name: '',
      title_template: '',
      description_template: '',
      category_id: 0,
      task_type_id: 0,
      priority: 'medium',
      complexity: 3,
      default_tags: [],
      is_public: false,
    },
  });

  const updateMut = useMutation({
    mutationFn: async (payload: { id: number; values: TaskTemplateEditValues }) => {
      await updateTaskTemplate(payload.id, {
        name: payload.values.name,
        title_template: payload.values.title_template,
        description_template: payload.values.description_template ?? null,
        category_id: payload.values.category_id,
        task_type_id: payload.values.task_type_id,
        priority: payload.values.priority,
        complexity: payload.values.complexity,
        default_tags: payload.values.default_tags,
        is_public: payload.values.is_public,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['task-templates'] });
      notifications.show({
        title: 'Сохранено',
        message: 'Шаблон обновлён',
        color: 'green',
      });
      setEditOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => {
      notifications.show({
        title: 'Ошибка',
        message: e.message,
        color: 'red',
      });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteTaskTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['task-templates'] });
      notifications.show({
        title: 'Удалено',
        message: 'Шаблон удалён',
        color: 'green',
      });
    },
    onError: (e: Error) => {
      notifications.show({
        title: 'Ошибка',
        message: e.message,
        color: 'red',
      });
    },
  });

  const categories = refsQuery.data?.categories ?? [];
  const taskTypes = refsQuery.data?.taskTypes ?? [];
  const priorities = refsQuery.data?.priorities ?? [];

  const openEdit = (t: TaskTemplateRow) => {
    setEditing(t);
    editForm.setValues({
      name: t.name,
      title_template: t.title_template?.trim() ?? '',
      description_template: t.description_template ?? '',
      category_id: t.category_id ?? 0,
      task_type_id: t.task_type_id ?? 0,
      priority: t.priority ?? 'medium',
      complexity: t.complexity ?? 3,
      default_tags: [...(t.default_tags ?? [])],
      is_public: t.is_public,
    });
    setEditOpen(true);
  };

  const handleCategoryChange = (value: string | null) => {
    const id = value ? Number(value) : 0;
    editForm.setFieldValue('category_id', id);
    const cat = categories.find((c) => c.id === id);
    if (cat) {
      editForm.setFieldValue(
        'priority',
        taskPriorityFromCategory(cat, priorities),
      );
    }
  };

  const priorityOptions = priorities.map((p) => ({
    value: p.code,
    label: `${p.name} (${p.code})`,
  }));

  const rows = listQuery.data ?? [];

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Шаблоны задач</Title>
        <Text c="dimmed" size="sm" mt={4}>
          Ваши шаблоны и публичные заготовки. Создать шаблон можно из карточки задачи
          («Сохранить как шаблон»). Использовать при создании задачи — кнопка «Использовать
          шаблон» на странице{' '}
          <Link to="/tasks/new">новой задачи</Link>.
        </Text>
      </div>

      {!canPublishTemplate(role) && (
        <Alert icon={<IconAlertCircle size={16} />} color="gray" title="Публичные шаблоны">
          Публиковать шаблоны для всех могут только руководитель и администратор. Остальные
          пользователи сохраняют личные шаблоны.
        </Alert>
      )}

      {listQuery.isPending && (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      )}

      {listQuery.isError && (
        <Alert color="red" title="Ошибка">
          {(listQuery.error as Error).message || 'Не удалось загрузить шаблоны'}
        </Alert>
      )}

      {listQuery.isSuccess && rows.length === 0 && (
        <Text c="dimmed" size="sm">
          Пока нет ни одного шаблона. Откройте задачу и нажмите «Сохранить как шаблон».
        </Text>
      )}

      {listQuery.isSuccess && rows.length > 0 && (
        <Paper withBorder radius="md">
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Название</Table.Th>
                  <Table.Th>Заголовок по умолчанию</Table.Th>
                  <Table.Th>Категория</Table.Th>
                  <Table.Th>Тип</Table.Th>
                  <Table.Th>Приоритет</Table.Th>
                  <Table.Th>Доступ</Table.Th>
                  <Table.Th>Автор</Table.Th>
                  <Table.Th w={160} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((t) => {
                  const can = canMutateTaskTemplate(t, uid, role);
                  return (
                    <Table.Tr key={t.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {t.name}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={2} maw={280}>
                          {t.title_template ?? '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{t.category?.name ?? '—'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{t.task_type?.name ?? '—'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {t.priority ? TASK_PRIORITY_LABELS[t.priority] : '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {t.is_public ? (
                          <Badge color="teal" variant="light">
                            Общий
                          </Badge>
                        ) : (
                          <Badge variant="light" color="gray">
                            Личный
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{t.creator?.full_name ?? '—'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <Button
                            size="compact-xs"
                            variant="light"
                            disabled={!can}
                            onClick={() => openEdit(t)}
                          >
                            Изменить
                          </Button>
                          <Button
                            size="compact-xs"
                            color="red"
                            variant="light"
                            disabled={!can || deleteMut.isPending}
                            onClick={() => {
                              modals.openConfirmModal({
                                title: 'Удалить шаблон?',
                                children: (
                                  <Text size="sm">
                                    Шаблон «{t.name}» будет удалён безвозвратно.
                                  </Text>
                                ),
                                labels: { confirm: 'Удалить', cancel: 'Отмена' },
                                confirmProps: { color: 'red' },
                                onConfirm: () => deleteMut.mutate(t.id),
                              });
                            }}
                          >
                            Удалить
                          </Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      )}

      <Modal
        opened={editOpen && !!editing}
        onClose={() => {
          setEditOpen(false);
          setEditing(null);
        }}
        title="Редактировать шаблон"
        size="lg"
        centered
      >
        {refsQuery.isPending ? (
          <Loader />
        ) : (
          <form
            onSubmit={editForm.onSubmit((values) => {
              if (!editing) return;
              const parsed = taskTemplateEditSchema.safeParse(values);
              if (!parsed.success) {
                notifications.show({
                  title: 'Проверьте поля',
                  message: parsed.error.issues.map((i) => i.message).join(', '),
                  color: 'red',
                });
                return;
              }
              if (parsed.data.is_public && !canPublishTemplate(role)) {
                notifications.show({
                  title: 'Недостаточно прав',
                  message: 'Только руководитель и администратор могут общие шаблоны.',
                  color: 'red',
                });
                return;
              }
              updateMut.mutate({ id: editing.id, values: parsed.data });
            })}
          >
            <Stack gap="md">
              <TextInput label="Название шаблона" required {...editForm.getInputProps('name')} />
              <TextInput
                label="Заголовок по умолчанию для новой задачи"
                required
                {...editForm.getInputProps('title_template')}
              />
              <Textarea
                label="Описание по умолчанию"
                minRows={4}
                {...editForm.getInputProps('description_template')}
              />
              <Select
                label="Категория"
                required
                placeholder="Выберите категорию"
                data={categories.map((c) => ({
                  value: String(c.id),
                  label: c.name,
                }))}
                value={
                  editForm.values.category_id
                    ? String(editForm.values.category_id)
                    : null
                }
                onChange={handleCategoryChange}
                error={editForm.errors.category_id}
              />
              <Select
                label="Тип задачи"
                required
                data={taskTypes.map((t) => ({
                  value: String(t.id),
                  label: t.name,
                }))}
                value={
                  editForm.values.task_type_id
                    ? String(editForm.values.task_type_id)
                    : null
                }
                onChange={(v) =>
                  editForm.setFieldValue('task_type_id', v ? Number(v) : 0)
                }
                error={editForm.errors.task_type_id}
              />
              <Select
                label="Приоритет"
                required
                data={priorityOptions}
                {...editForm.getInputProps('priority')}
              />
              <div>
                <Text size="sm" fw={500} mb={6}>
                  Сложность: {editForm.values.complexity}
                </Text>
                <Slider
                  min={1}
                  max={5}
                  step={1}
                  marks={[
                    { value: 1, label: '1' },
                    { value: 5, label: '5' },
                  ]}
                  {...editForm.getInputProps('complexity')}
                />
              </div>
              <TagsInput
                label="Теги по умолчанию"
                placeholder="Введите и Enter"
                {...editForm.getInputProps('default_tags')}
              />
              {canPublishTemplate(role) ? (
                <Checkbox
                  label="Общий шаблон (виден всем сотрудникам)"
                  {...editForm.getInputProps('is_public', { type: 'checkbox' })}
                />
              ) : (
                <Text size="xs" c="dimmed">
                  Общие шаблоны могут включать только руководитель и администратор.
                </Text>
              )}
              <Group justify="flex-end" mt="md">
                <Button
                  variant="default"
                  type="button"
                  onClick={() => {
                    setEditOpen(false);
                    setEditing(null);
                  }}
                >
                  Отмена
                </Button>
                <Button type="submit" loading={updateMut.isPending}>
                  Сохранить
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </Modal>
    </Stack>
  );
}
