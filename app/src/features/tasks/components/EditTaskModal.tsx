import { useEffect, useMemo } from 'react';
import {
  Alert,
  Button,
  Group,
  Loader,
  Modal,
  Select,
  Slider,
  Stack,
  TagsInput,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/types/database';
import { editTask } from '../api/editTask';
import { fetchTaskFormReferences } from '../api/referenceQueries';
import { taskEditSchema } from '../schemas';
import { formatTaskUpdateError } from '../lib/formatTaskUpdateError';
import type { TaskDetailBundle } from '../api/fetchTaskDetail';

type TaskPriority = Database['public']['Enums']['task_priority'];

interface FormState {
  title: string;
  description: string;
  category_id: number;
  task_type_id: number;
  priority: TaskPriority;
  complexity: number;
  due_date: string | null;
  tagNames: string[];
}

function bundleToFormState(bundle: TaskDetailBundle): FormState {
  return {
    title: bundle.task.title ?? '',
    description: bundle.task.description ?? '',
    category_id: bundle.task.category?.id ?? 0,
    task_type_id: bundle.task.task_type?.id ?? 0,
    priority: bundle.task.priority,
    complexity: bundle.task.complexity,
    due_date: bundle.task.due_date,
    tagNames: bundle.tags.map((t) => t.name),
  };
}

export interface EditTaskModalProps {
  opened: boolean;
  onClose: () => void;
  bundle: TaskDetailBundle;
  userId: string;
  /** Вызывается после успешного сохранения (обычно — invalidateTask). */
  onSaved?: () => void;
}

export function EditTaskModal({
  opened,
  onClose,
  bundle,
  userId,
  onSaved,
}: EditTaskModalProps) {
  const queryClient = useQueryClient();

  const refsQuery = useQuery({
    queryKey: ['tasks', 'edit', 'refs'],
    queryFn: fetchTaskFormReferences,
    enabled: opened,
  });

  const form = useForm<FormState>({
    initialValues: bundleToFormState(bundle),
  });

  useEffect(() => {
    if (opened) {
      form.setValues(bundleToFormState(bundle));
      form.resetDirty();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, bundle.task.id, bundle.task.updated_at]);

  const categories = refsQuery.data?.categories ?? [];
  const taskTypes = refsQuery.data?.taskTypes ?? [];
  const priorities = refsQuery.data?.priorities ?? [];

  const priorityOptions = useMemo(
    () =>
      priorities.map((p) => ({
        value: p.code,
        label: `${p.name} (${p.code})`,
      })),
    [priorities],
  );

  const saveMut = useMutation({
    mutationFn: async (values: FormState) => {
      const parsed = taskEditSchema.safeParse({
        ...values,
        due_date: values.due_date ?? null,
      });
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => i.message).join(', ');
        throw new Error(msg || 'Проверьте форму');
      }
      await editTask(
        bundle.task.id,
        {
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          category_id: parsed.data.category_id,
          task_type_id: parsed.data.task_type_id,
          priority: parsed.data.priority,
          complexity: parsed.data.complexity,
          due_date: parsed.data.due_date ?? null,
          tagNames: parsed.data.tagNames,
        },
        userId,
      );
    },
    onSuccess: () => {
      notifications.show({
        title: 'Сохранено',
        message: 'Задача обновлена',
        color: 'green',
      });
      void queryClient.invalidateQueries({
        queryKey: ['task', 'detail', bundle.task.id],
      });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onSaved?.();
      onClose();
    },
    onError: (e: unknown) => {
      notifications.show({
        title: 'Не удалось сохранить',
        message: formatTaskUpdateError(e) || 'Ошибка',
        color: 'red',
      });
    },
  });

  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (saveMut.isPending) return;
        onClose();
      }}
      title={`Редактировать задачу ${bundle.task.ticket_number ?? `#${bundle.task.id}`}`}
      centered
      size="lg"
    >
      {refsQuery.isPending ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : refsQuery.isError ? (
        <Alert color="red" title="Ошибка">
          Не удалось загрузить справочники.
        </Alert>
      ) : (
        <form
          onSubmit={form.onSubmit((values) => saveMut.mutate(values))}
        >
          <Stack gap="md">
            <TextInput
              label="Название"
              required
              {...form.getInputProps('title')}
            />

            <Textarea
              label="Описание"
              minRows={4}
              autosize
              maxRows={12}
              {...form.getInputProps('description')}
            />

            <Group grow align="flex-start">
              <Select
                label="Категория"
                required
                searchable
                data={categories.map((c) => ({
                  value: String(c.id),
                  label: c.name,
                }))}
                value={
                  form.values.category_id
                    ? String(form.values.category_id)
                    : null
                }
                onChange={(v) =>
                  form.setFieldValue('category_id', v ? Number(v) : 0)
                }
              />

              <Select
                label="Тип задачи"
                required
                data={taskTypes.map((t) => ({
                  value: String(t.id),
                  label: t.name,
                }))}
                value={
                  form.values.task_type_id
                    ? String(form.values.task_type_id)
                    : null
                }
                onChange={(v) =>
                  form.setFieldValue('task_type_id', v ? Number(v) : 0)
                }
              />
            </Group>

            <Group grow align="flex-start">
              <Select
                label="Приоритет"
                required
                data={priorityOptions}
                {...form.getInputProps('priority')}
              />

              <DateTimePicker
                label="Срок"
                placeholder="Не задан"
                clearable
                value={form.values.due_date ? new Date(form.values.due_date) : null}
                onChange={(d) =>
                  form.setFieldValue('due_date', d ? d.toISOString() : null)
                }
              />
            </Group>

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
                  { value: 3, label: '3' },
                  { value: 5, label: '5' },
                ]}
                {...form.getInputProps('complexity')}
              />
            </div>

            <TagsInput
              label="Теги"
              placeholder="Введите и Enter"
              {...form.getInputProps('tagNames')}
            />

            <Group justify="flex-end" mt="sm">
              <Button
                type="button"
                variant="default"
                onClick={onClose}
                disabled={saveMut.isPending}
              >
                Отмена
              </Button>
              <Button type="submit" loading={saveMut.isPending}>
                Сохранить
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  );
}
