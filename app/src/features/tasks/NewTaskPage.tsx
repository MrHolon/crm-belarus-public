import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Select,
  Slider,
  Stack,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useDebouncedCallback } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth-context';
import { createTask } from './api/createTask';
import { fetchTaskFormReferences } from './api/referenceQueries';
import {
  listTaskTemplates,
  newTaskFormFromTemplate,
  type TaskTemplateRow,
} from './api/taskTemplates';
import { filterAssignableUsers } from './lib/assigneeRules';
import { taskPriorityFromCategory } from './lib/taskPriorityFromCategory';
import { taskCreateSchema, type TaskCreateFormValues } from './schemas';
import { supabase } from '@/lib/supabase';

const DRAFT_KEY = 'draft:task-new';

type FormState = TaskCreateFormValues & {
  category_id: number;
  task_type_id: number;
};

function emptyForm(userId: string): FormState {
  return {
    title: '',
    description: '',
    category_id: 0,
    task_type_id: 0,
    priority: 'medium',
    assignee_id: userId,
    due_date: null,
    complexity: 3,
    tagNames: [],
    parent_task_id: null,
  };
}

/**
 * Черновик считается «значимым» только если пользователь **ввёл** что-то
 * своё, а не просто открыл форму. Без этой проверки debounced-эффект при
 * монтировании сохраняет пустые значения в localStorage, а при следующем
 * открытии мы спрашиваем «восстановить пустоту».
 */
function hasDraftContent(v: Partial<FormState>): boolean {
  if (typeof v.title === 'string' && v.title.trim().length > 0) return true;
  if (typeof v.description === 'string' && v.description.trim().length > 0) return true;
  if (Array.isArray(v.tagNames) && v.tagNames.length > 0) return true;
  if (typeof v.category_id === 'number' && v.category_id > 0) return true;
  if (typeof v.task_type_id === 'number' && v.task_type_id > 0) return true;
  if (v.due_date) return true;
  return false;
}

export function NewTaskPage() {
  const { user, profile, role } = useAuth();
  const navigate = useNavigate();
  const searchStr = useRouterState({ select: (s) => s.location.search });
  const searchParams = useMemo(() => new URLSearchParams(searchStr), [searchStr]);
  const parentId = useMemo(() => {
    const p = searchParams.get('parent');
    return p ? Number(p) : null;
  }, [searchParams]);
  const devMode = searchParams.get('dev') === '1';

  const refsQuery = useQuery({
    queryKey: ['tasks', 'new', 'refs'],
    queryFn: fetchTaskFormReferences,
  });

  const templatesQuery = useQuery({
    queryKey: ['task-templates'],
    queryFn: listTaskTemplates,
  });

  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const parentQuery = useQuery({
    queryKey: ['tasks', 'brief', parentId],
    enabled: !!parentId && !Number.isNaN(parentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, ticket_number, description, category_id')
        .eq('id', parentId as number)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const parentCommentsQuery = useQuery({
    queryKey: ['tasks', 'parent-comments', parentId],
    enabled: !!parentId && !Number.isNaN(parentId) && devMode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_comments')
        .select(
          'comment_text, created_at, user:users!task_comments_user_id_fkey(full_name)',
        )
        .eq('task_id', parentId as number)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const form = useForm<FormState>({
    initialValues: user?.id ? emptyForm(user.id) : emptyForm(''),
  });

  const draftPrompted = useRef(false);
  const devPrefilled = useRef(false);

  useEffect(() => {
    devPrefilled.current = false;
  }, [devMode, parentId]);

  useEffect(() => {
    if (!user?.id) return;
    form.setValues(emptyForm(user.id));
    form.setFieldValue('parent_task_id', parentId && !Number.isNaN(parentId) ? parentId : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, parentId]);

  useEffect(() => {
    if (!devMode || !parentId || devPrefilled.current || !user?.id) return;
    if (!refsQuery.data || !parentQuery.data) return;
    if (parentCommentsQuery.isLoading || parentCommentsQuery.isFetching) return;

    const { categories: cats, taskTypes: types, priorities: prios, users } = refsQuery.data;
    const parent = parentQuery.data;
    if (!parent) return;

    const devType = types.find((t) => t.code === 'developer_task');
    if (!devType) return;

    const comments = parentCommentsQuery.data ?? [];
    const commentBlock =
      comments.length === 0
        ? ''
        : `\n\n--- Комментарии к родительской задаче ---\n${comments
            .map((c) => {
              const u = c.user as { full_name?: string } | null;
              return `[${c.created_at}] ${u?.full_name ?? '?'}: ${c.comment_text}`;
            })
            .join('\n')}`;

    const baseDesc = (parent.description ?? '').trim();
    const description = [baseDesc, commentBlock].filter(Boolean).join('\n');

    const firstDev = users.find((u) => u.role === 'developer')?.id ?? user.id;

    form.setValues({
      ...form.values,
      parent_task_id: parentId,
      category_id: parent.category_id ?? form.values.category_id,
      task_type_id: devType.id,
      title: `DEV: ${parent.title}`,
      description,
      assignee_id: firstDev,
    });

    const cat = cats.find((c) => c.id === parent.category_id);
    if (cat) {
      form.setFieldValue('priority', taskPriorityFromCategory(cat, prios));
    }

    devPrefilled.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot prefill from parent + refs
  }, [
    devMode,
    parentId,
    user?.id,
    refsQuery.data,
    parentQuery.data,
    parentCommentsQuery.data,
    parentCommentsQuery.isLoading,
    parentCommentsQuery.isFetching,
  ]);

  useEffect(() => {
    if (!refsQuery.isSuccess || !user?.id || draftPrompted.current || devMode) return;
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) {
      draftPrompted.current = true;
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<FormState>;
      if (!parsed || typeof parsed !== 'object') {
        draftPrompted.current = true;
        return;
      }
      draftPrompted.current = true;
      if (!hasDraftContent(parsed)) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      modals.openConfirmModal({
        title: 'Черновик',
        children: (
          <Text size="sm">
            Найден сохранённый черновик формы. Восстановить его?
          </Text>
        ),
        labels: { confirm: 'Восстановить', cancel: 'Удалить' },
        onConfirm: () => {
          form.setValues({
            ...emptyForm(user.id),
            ...parsed,
            assignee_id: parsed.assignee_id ?? user.id,
            category_id: parsed.category_id ?? 0,
            task_type_id: parsed.task_type_id ?? 0,
            tagNames: Array.isArray(parsed.tagNames) ? parsed.tagNames : [],
            parent_task_id:
              parentId && !Number.isNaN(parentId) ? parentId : parsed.parent_task_id ?? null,
          });
        },
        onCancel: () => {
          localStorage.removeItem(DRAFT_KEY);
        },
      });
    } catch {
      draftPrompted.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draft prompt once when refs ready
  }, [refsQuery.isSuccess, user?.id, parentId]);

  const debouncedDraft = useDebouncedCallback((values: FormState) => {
    try {
      if (hasDraftContent(values)) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
      } else {
        // Форма пустая — не храним мусор, который потом «восстанавливать».
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      /* ignore quota */
    }
  }, 500);

  useEffect(() => {
    debouncedDraft(form.values);
  }, [form.values, debouncedDraft]);

  const categories = refsQuery.data?.categories ?? [];
  const taskTypes = refsQuery.data?.taskTypes ?? [];
  const priorities = refsQuery.data?.priorities ?? [];
  const allUsers = refsQuery.data?.users ?? [];

  const devType = taskTypes.find((t) => t.code === 'developer_task');

  const visibleTemplates = useMemo(() => {
    const all = templatesQuery.data ?? [];
    if (!devMode) return all;
    return all.filter((t) => t.task_type?.code === 'developer_task');
  }, [templatesQuery.data, devMode]);

  const applyTemplate = (t: TaskTemplateRow) => {
    if (!user?.id) return;
    const run = () => {
      const base = newTaskFormFromTemplate(t, user.id);
      form.setValues({
        ...base,
        parent_task_id:
          parentId && !Number.isNaN(parentId) ? parentId : null,
      });
      if (devMode && devType) {
        form.setFieldValue('task_type_id', devType.id);
      }
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore quota */
      }
      setTemplateModalOpen(false);
      notifications.show({
        title: 'Шаблон применён',
        message: t.name,
        color: 'green',
      });
    };

    let hasDraft = false;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FormState>;
        hasDraft = !!parsed && hasDraftContent(parsed);
      }
    } catch {
      hasDraft = false;
    }

    if (hasDraft) {
      modals.openConfirmModal({
        title: 'Заменить черновик?',
        children: (
          <Text size="sm">
            В браузере сохранён черновик формы. Применить шаблон и отбросить черновик?
          </Text>
        ),
        labels: { confirm: 'Применить шаблон', cancel: 'Отмена' },
        onConfirm: run,
      });
    } else {
      run();
    }
  };

  const assigneeOptions =
    !role || !user?.id
      ? []
      : devMode
        ? allUsers.filter((u) => u.role === 'developer')
        : filterAssignableUsers(role, user.id, allUsers);

  const priorityOptions = priorities.map((p) => ({
    value: p.code,
    label: `${p.name} (${p.code})`,
  }));

  const createMutation = useMutation({
    mutationFn: async (values: FormState) => {
      if (!user?.id) throw new Error('Нет сессии');
      let title = values.title.trim();
      if (devMode) {
        const t = title.toUpperCase();
        if (!t.startsWith('DEV:')) {
          title = `DEV: ${title}`;
        }
      }
      const parsed = taskCreateSchema.safeParse({
        ...values,
        title,
        due_date: values.due_date ?? null,
      });
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => i.message).join(', ');
        throw new Error(msg || 'Проверьте форму');
      }
      return createTask(
        {
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          category_id: parsed.data.category_id,
          task_type_id: parsed.data.task_type_id,
          priority: parsed.data.priority,
          assignee_id: parsed.data.assignee_id,
          due_date: parsed.data.due_date ?? null,
          complexity: parsed.data.complexity,
          tagNames: parsed.data.tagNames,
          parent_task_id: parsed.data.parent_task_id ?? null,
        },
        user.id,
      );
    },
    onSuccess: (task) => {
      localStorage.removeItem(DRAFT_KEY);
      notifications.show({
        title: 'Задача создана',
        message: `${task.ticket_number ?? 'Задача'}: ${task.title}`,
        color: 'green',
      });
      void navigate({ to: '/tasks' });
    },
    onError: (e: Error) => {
      notifications.show({
        title: 'Не удалось создать',
        message: e.message,
        color: 'red',
      });
    },
  });

  const handleCategoryChange = (value: string | null) => {
    const id = value ? Number(value) : 0;
    form.setFieldValue('category_id', id);
    const cat = categories.find((c) => c.id === id);
    if (cat) {
      form.setFieldValue(
        'priority',
        taskPriorityFromCategory(cat, priorities),
      );
    }
  };

  if (!user?.id || !profile) {
    return (
      <Stack align="center" py="xl">
        <Loader />
      </Stack>
    );
  }

  if (refsQuery.isPending) {
    return (
      <Stack align="center" py="xl">
        <Loader />
        <Text c="dimmed" size="sm">
          Загрузка справочников…
        </Text>
      </Stack>
    );
  }

  if (refsQuery.isError) {
    return (
      <Alert color="red" title="Ошибка">
        Не удалось загрузить данные для формы.
      </Alert>
    );
  }

  if (devMode && (parentId === null || Number.isNaN(parentId))) {
    return (
      <Stack gap="lg" maw={720}>
        <div>
          <Title order={2}>Новая задача разработчику</Title>
          <Text c="dimmed" size="sm" mt={4}>
            Тип «Задача разработчику», исполнители с ролью «Разработчик».
          </Text>
        </div>
        <Alert color="orange" title="Нужна родительская задача">
          Откройте создание из карточки задачи («Создать задачу разработчику») или укажите в адресе параметр{' '}
          <code>?parent=ID</code>.
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack gap="lg" maw={720}>
      <div>
        <Title order={2}>{devMode ? 'Новая задача разработчику' : 'Новая задача'}</Title>
        <Text c="dimmed" size="sm" mt={4}>
          {devMode
            ? 'Тип «Задача разработчику», исполнители с ролью «Разработчик».'
            : 'Заполните поля и нажмите «Создать». Черновик сохраняется в браузере.'}
        </Text>
      </div>

      {parentQuery.data ? (
        <Alert color={devMode ? 'teal' : 'blue'} title={devMode ? 'Родительская задача' : 'Подзадача'}>
          {devMode ? 'Режим разработчика: ' : null}
          Родительская задача:{' '}
          <strong>
            {parentQuery.data.ticket_number} — {parentQuery.data.title}
          </strong>
        </Alert>
      ) : null}

      <Paper withBorder p="md" radius="md">
        <form
          onSubmit={form.onSubmit((values) => createMutation.mutate(values))}
        >
          <Stack gap="md">
            <Group justify="flex-end">
              <Button
                type="button"
                variant="light"
                onClick={() => setTemplateModalOpen(true)}
              >
                Использовать шаблон
              </Button>
            </Group>

            <TextInput
              label="Название"
              required
              {...form.getInputProps('title')}
            />

            <Textarea
              label="Описание"
              minRows={4}
              {...form.getInputProps('description')}
            />

            <Select
              label="Категория"
              required
              placeholder="Выберите категорию"
              data={categories.map((c) => ({
                value: String(c.id),
                label: c.name,
              }))}
              value={form.values.category_id ? String(form.values.category_id) : null}
              onChange={handleCategoryChange}
              error={form.errors.category_id}
            />

            <Select
              label="Тип задачи"
              required
              placeholder="Выберите тип"
              disabled={devMode}
              data={taskTypes.map((t) => ({
                value: String(t.id),
                label: t.name,
              }))}
              value={form.values.task_type_id ? String(form.values.task_type_id) : null}
              onChange={(v) =>
                form.setFieldValue('task_type_id', v ? Number(v) : 0)
              }
              error={form.errors.task_type_id}
            />

            <Select
              label="Приоритет"
              required
              data={priorityOptions}
              {...form.getInputProps('priority')}
            />

            <Select
              label="Исполнитель"
              required
              searchable
              data={assigneeOptions.map((u) => ({
                value: u.id,
                label: `${u.full_name} (${u.login}) — ${u.role}`,
              }))}
              {...form.getInputProps('assignee_id')}
            />

            <div>
              <Text size="sm" fw={500} mb={6}>
                Сложность: {form.values.complexity}
              </Text>
              <Slider
                min={1}
                max={5}
                step={1}
                marks={[
                  { value: 1, label: '1' },
                  { value: 5, label: '5' },
                ]}
                {...form.getInputProps('complexity')}
              />
            </div>

            <DateTimePicker
              label="Срок выполнения"
              placeholder="Не задан"
              clearable
              value={form.values.due_date ? new Date(form.values.due_date) : null}
              onChange={(d) =>
                form.setFieldValue('due_date', d ? d.toISOString() : null)
              }
            />

            <TagsInput
              label="Теги"
              placeholder="Введите и Enter"
              {...form.getInputProps('tagNames')}
            />

            <Group justify="flex-end" mt="md">
              <Button
                type="button"
                variant="default"
                onClick={() => void navigate({ to: '/tasks' })}
              >
                Отмена
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                Создать задачу
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>

      <Modal
        opened={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title={devMode ? 'Шаблоны для задачи разработчику' : 'Выберите шаблон'}
        size="md"
        centered
      >
        {templatesQuery.isPending ? (
          <Group justify="center" py="md">
            <Loader />
          </Group>
        ) : templatesQuery.isError ? (
          <Alert color="red" title="Ошибка">
            {(templatesQuery.error as Error).message || 'Не удалось загрузить шаблоны'}
          </Alert>
        ) : visibleTemplates.length === 0 ? (
          <Text size="sm" c="dimmed">
            {devMode
              ? 'Нет шаблонов с типом «Задача разработчику». Сохраните шаблон из подходящей задачи или создайте форму вручную.'
              : 'Нет доступных шаблонов. Создайте шаблон из карточки задачи («Сохранить как шаблон»).'}
          </Text>
        ) : (
          <ScrollArea.Autosize mah={360}>
            <Stack gap="xs">
              {visibleTemplates.map((t) => (
                <Button
                  key={t.id}
                  type="button"
                  variant="light"
                  fullWidth
                  styles={{ inner: { justifyContent: 'flex-start' } }}
                  onClick={() => applyTemplate(t)}
                >
                  <Stack gap={2} align="flex-start" style={{ width: '100%' }}>
                    <Group justify="space-between" wrap="nowrap" w="100%">
                      <Text size="sm" fw={600} lineClamp={1}>
                        {t.name}
                      </Text>
                      {t.is_public ? (
                        <Text size="xs" c="teal" fw={500}>
                          общий
                        </Text>
                      ) : null}
                    </Group>
                    <Text size="xs" c="dimmed" lineClamp={2}>
                      {t.title_template ?? '—'}
                    </Text>
                  </Stack>
                </Button>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}
      </Modal>
    </Stack>
  );
}
