import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Grid,
  Group,
  Modal,
  MultiSelect,
  Paper,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBan,
  IconCode,
  IconFileDescription,
  IconHistory,
  IconMessage,
  IconPaperclip,
  IconPencil,
  IconPlus,
  IconUserX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth-context';
import type { Database } from '@/types/database';
import { cancelTask } from './api/cancelTask';
import { deleteTask } from './api/deleteTask';
import { fetchMentionUsers } from './api/mentionUsers';
import { fetchTaskDetail } from './api/fetchTaskDetail';
import { rejectTask } from './api/rejectTask';
import { requestTaskHelp } from './api/requestTaskHelp';
import { saveTaskAsTemplate } from './api/taskTemplates';
import { EditTaskModal } from './components/EditTaskModal';
import { TaskCommentsSection } from './components/TaskCommentsSection';
import { TaskHistorySection } from './components/TaskHistorySection';
import { updateTask } from './api/updateTask';
import { formatTaskDateTime } from './lib/formatTaskDate';
import {
  priorityColor,
  statusColor,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from './lib/labels';
import { formatTaskUpdateError } from './lib/formatTaskUpdateError';
import {
  allowedNextStatuses,
  buildStatusUpdatePatch,
  canUserMutateTaskRow,
  type TaskStatus,
} from './lib/transitions';
import {
  canCancelTask,
  canCreateDeveloperChildTask,
  canDeleteTask,
  canEditTask,
} from './lib/taskActions';
import {
  saveTaskTemplateSchema,
  taskCancelReasonSchema,
  taskRejectReasonSchema,
} from './schemas';
import { useTasksRealtime } from './hooks/useTasksRealtime';

type CategorySeverity = Database['public']['Enums']['category_severity'];

const SEVERITY_LABEL: Record<CategorySeverity, string> = {
  normal: 'Обычная',
  important: 'Важная',
  critical: 'Критическая',
};

export function TaskDetailPage() {
  const { taskId: rawId } = useParams({ strict: false }) as { taskId?: string };
  const taskId = rawId ? Number.parseInt(rawId, 10) : Number.NaN;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, role } = useAuth();

  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [helpDraft, setHelpDraft] = useState('');
  const [helpHelperIds, setHelpHelperIds] = useState<string[]>([]);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReasonDraft, setRejectReasonDraft] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReasonDraft, setCancelReasonDraft] = useState('');
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [templatePublic, setTemplatePublic] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: ['task', 'detail', taskId],
    queryFn: () => fetchTaskDetail(taskId),
    enabled: Number.isFinite(taskId) && taskId > 0,
  });

  const invalidateTask = () => {
    void queryClient.invalidateQueries({ queryKey: ['task', 'detail', taskId] });
    void queryClient.invalidateQueries({ queryKey: ['task', 'comments', taskId] });
    void queryClient.invalidateQueries({ queryKey: ['task', 'history', taskId] });
    void queryClient.invalidateQueries({ queryKey: ['tasks', 'list'] });
    void queryClient.invalidateQueries({ queryKey: ['tasks', 'help-room'] });
    void queryClient.invalidateQueries({ queryKey: ['tasks', 'helper-ids'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  // Live-refresh the card whenever the underlying task row changes
  // (someone else takes it, a trigger edits it, etc.).
  useTasksRealtime({
    enabled: Number.isFinite(taskId) && taskId > 0,
    filter: `id=eq.${taskId}`,
    onChange: invalidateTask,
  });

  const helpUsersQuery = useQuery({
    queryKey: ['users', 'mention-list'],
    queryFn: fetchMentionUsers,
    enabled: helpModalOpen,
  });

  const updateMut = useMutation({
    mutationFn: async (patch: Parameters<typeof updateTask>[1]) => {
      await updateTask(taskId, patch);
    },
    onSuccess: () => {
      invalidateTask();
      notifications.show({ title: 'Сохранено', message: 'Задача обновлена', color: 'green' });
    },
    onError: (e: Error) => {
      notifications.show({
        title: 'Ошибка',
        message: formatTaskUpdateError(e) || 'Не удалось обновить задачу',
        color: 'red',
      });
    },
  });

  const rejectMut = useMutation({
    mutationFn: async (reason: string) => {
      await rejectTask(taskId, reason);
    },
    onSuccess: () => {
      invalidateTask();
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setRejectModalOpen(false);
      setRejectReasonDraft('');
      notifications.show({
        title: 'Задача отклонена',
        message: 'Создатель получит уведомление.',
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

  const deleteMut = useMutation({
    mutationFn: async () => {
      await deleteTask(taskId);
    },
    onSuccess: () => {
      notifications.show({ title: 'Задача удалена', message: '', color: 'green' });
      void navigate({ to: '/tasks' });
    },
    onError: (e: Error) => {
      notifications.show({
        title: 'Ошибка',
        message: formatTaskUpdateError(e) || e.message,
        color: 'red',
      });
    },
  });

  const cancelMut = useMutation({
    mutationFn: async (reason: string) => {
      await cancelTask(taskId, reason);
    },
    onSuccess: () => {
      invalidateTask();
      setCancelModalOpen(false);
      setCancelReasonDraft('');
      notifications.show({
        title: 'Задача отменена',
        message: 'Статус: «Отменена».',
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

  const helpRequestMut = useMutation({
    mutationFn: async (payload: { comment: string; helperIds: string[] }) => {
      await requestTaskHelp(taskId, payload.comment, payload.helperIds);
    },
    onSuccess: () => {
      invalidateTask();
      setHelpModalOpen(false);
      setHelpHelperIds([]);
      setHelpDraft('');
      notifications.show({
        title: 'Запрошена помощь',
        message: 'Выбранные сотрудники получат уведомление.',
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

  const saveTemplateMut = useMutation({
    mutationFn: async (input: {
      name: string;
      description_template: string | null;
      is_public: boolean;
    }) => {
      if (!user?.id) throw new Error('Нет сессии');
      if (!Number.isFinite(taskId) || taskId <= 0) {
        throw new Error('Некорректная задача');
      }
      const canPub = role === 'manager' || role === 'admin';
      const parsed = saveTaskTemplateSchema.safeParse({
        name: input.name,
        description_template: input.description_template,
        is_public: canPub ? input.is_public : false,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues.map((i) => i.message).join(', '));
      }
      await saveTaskAsTemplate({
        taskId,
        userId: user.id,
        name: parsed.data.name,
        descriptionTemplate: parsed.data.description_template ?? null,
        isPublic: parsed.data.is_public,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['task-templates'] });
      setTemplateModalOpen(false);
      notifications.show({
        title: 'Шаблон сохранён',
        message: 'Его можно открыть в разделе «Шаблоны» или при создании задачи.',
        color: 'green',
      });
    },
    onError: (e: Error) => {
      notifications.show({
        title: 'Не удалось сохранить',
        message: e.message,
        color: 'red',
      });
    },
  });

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return (
      <Text c="dimmed">
        Некорректный номер задачи.{' '}
        <Button variant="subtle" component={Link} to="/tasks">
          К списку
        </Button>
      </Text>
    );
  }

  if (detailQuery.isPending) {
    return <Text c="dimmed">Загрузка…</Text>;
  }

  if (detailQuery.isError) {
    return (
      <Stack gap="sm">
        <Text c="red">
          {(detailQuery.error as Error).message || 'Не удалось загрузить задачу'}
        </Text>
        <Button
          variant="light"
          leftSection={<IconArrowLeft size={16} />}
          component={Link}
          to="/tasks"
        >
          К списку задач
        </Button>
      </Stack>
    );
  }

  const { task, tags, helpers, children, parent } = detailQuery.data;
  const devChildren = children.filter((c) => c.task_type?.code === 'developer_task');
  const otherChildren = children.filter((c) => c.task_type?.code !== 'developer_task');
  const uid = user?.id ?? '';
  const isAssignee = task.assignee?.id === uid;
  const isCreator = task.creator?.id === uid;
  const isHelper = helpers.some((h) => h.user?.id === uid);
  const hasAssignee = !!task.assignee_id;

  const canRow =
    !!role &&
    canUserMutateTaskRow({
      role,
      userId: uid,
      creatorId: task.creator_id,
      assigneeId: task.assignee_id,
      isHelper,
    });

  const nextStatuses = (
    role
      ? allowedNextStatuses(task.status, {
          role,
          isAssignee,
          isCreator,
          isHelper,
          hasAssignee,
        })
      : []
  ).filter((s) => s !== task.status);

  /** Кнопкой «Отменить» — с причиной; не через общий переход статуса. */
  const transitionButtonStatuses = nextStatuses.filter((s) => s !== 'cancelled');

  const showTransitionButtons = canRow && transitionButtonStatuses.length > 0;

  const canDelete = canDeleteTask({
    status: task.status,
    creatorId: task.creator_id,
    userId: uid,
    role,
  });
  const canCancel = canCancelTask({
    status: task.status,
    creatorId: task.creator_id,
    userId: uid,
    role,
  });
  const canDevChild = canCreateDeveloperChildTask(role);
  const canEdit = canEditTask({
    status: task.status,
    creatorId: task.creator_id,
    userId: uid,
    role,
  });

  const applyTransition = (next: TaskStatus) => {
    if (!user?.id || !role) return;
    if (next === 'needs_help') {
      setHelpDraft(task.help_comment ?? '');
      setHelpHelperIds([]);
      setHelpModalOpen(true);
      return;
    }
    const patch = buildStatusUpdatePatch({
      task: {
        id: task.id,
        status: task.status,
        assignee_id: task.assignee_id,
      },
      nextStatus: next,
      currentUserId: user.id,
      role,
    });
    updateMut.mutate(patch);
  };

  const submitHelpRequest = () => {
    const t = helpDraft.trim();
    if (t.length < 1) {
      notifications.show({
        title: 'Комментарий обязателен',
        message: 'Опишите, какая нужна помощь',
        color: 'orange',
      });
      return;
    }
    if (helpHelperIds.length < 1) {
      notifications.show({
        title: 'Выберите помощников',
        message: 'Нужен хотя бы один пользователь.',
        color: 'orange',
      });
      return;
    }
    helpRequestMut.mutate({
      comment: helpDraft.trim(),
      helperIds: helpHelperIds,
    });
  };

  const openDeleteModal = () => {
    const isAdminFullDelete = role === 'admin' && task.status !== 'new';
    modals.openConfirmModal({
      title: 'Удалить задачу?',
      children: (
        <Text size="sm">
          {isAdminFullDelete
            ? 'Задача будет удалена безвозвратно вместе с комментариями и историей (ТЗ §4.10).'
            : 'Задача будет удалена безвозвратно вместе с комментариями и историей. Продолжить?'}
        </Text>
      ),
      labels: { confirm: 'Удалить', cancel: 'Отмена' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteMut.mutate(),
    });
  };

  const confirmCancel = () => {
    const parsed = taskCancelReasonSchema.safeParse({ reason: cancelReasonDraft });
    if (!parsed.success) {
      const msg =
        parsed.error.flatten().fieldErrors.reason?.[0] ??
        'Укажите причину не короче 5 символов';
      notifications.show({ title: 'Проверьте форму', message: msg, color: 'orange' });
      return;
    }
    cancelMut.mutate(parsed.data.reason);
  };

  const canReject =
    isAssignee && (task.status === 'new' || task.status === 'in_progress');

  const confirmReject = () => {
    const parsed = taskRejectReasonSchema.safeParse({ reason: rejectReasonDraft });
    if (!parsed.success) {
      const msg =
        parsed.error.flatten().fieldErrors.reason?.[0] ?? 'Укажите причину не короче 10 символов';
      notifications.show({ title: 'Проверьте форму', message: msg, color: 'orange' });
      return;
    }
    rejectMut.mutate(parsed.data.reason);
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          component={Link}
          to="/tasks"
        >
          Назад к списку
        </Button>
      </Group>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="md">
            <div>
              <Group gap="sm" align="center" wrap="wrap">
                <Text size="sm" c="dimmed" ff="monospace">
                  {task.ticket_number ?? `#${task.id}`}
                </Text>
                <Badge color={statusColor(task.status)} variant="light">
                  {TASK_STATUS_LABELS[task.status]}
                </Badge>
                {task.is_overdue ? (
                  <Badge color="red" variant="outline">
                    Просрочено
                  </Badge>
                ) : null}
              </Group>
              <Title order={2} mt={8}>
                {task.title}
              </Title>
            </div>

            {task.rejection_reason ? (
              <Alert color="orange" title="Отклонена исполнителем" icon={<IconAlertTriangle size={18} />}>
                <Text size="sm">
                  {task.rejected_by
                    ? `${task.rejected_by.full_name}: `
                    : ''}
                  {task.rejection_reason}
                </Text>
                {task.rejected_at ? (
                  <Text size="xs" c="dimmed" mt={4}>
                    {formatTaskDateTime(task.rejected_at)}
                  </Text>
                ) : null}
              </Alert>
            ) : null}

            {task.status === 'cancelled' &&
            (task.cancellation_reason?.trim() || task.cancelled_at) ? (
              <Alert color="gray" title="Отменена" icon={<IconBan size={18} />}>
                {task.cancellation_reason?.trim() ? (
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {task.cancellation_reason}
                  </Text>
                ) : null}
                {task.cancelled_at ? (
                  <Text size="xs" c="dimmed" mt={task.cancellation_reason?.trim() ? 4 : 0}>
                    {formatTaskDateTime(task.cancelled_at)}
                  </Text>
                ) : null}
              </Alert>
            ) : null}

            <Paper withBorder p="md" radius="md">
              <Text size="sm" fw={600} mb="xs">
                Описание
              </Text>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {task.description?.trim() ? task.description : '—'}
              </Text>
            </Paper>

            {(task.status === 'needs_help' ||
              task.help_comment ||
              helpers.length > 0) && (
              <Paper withBorder p="md" radius="md">
                <Text size="sm" fw={600} mb="xs">
                  Помощь по задаче
                </Text>
                {task.help_requested_at ? (
                  <Text size="xs" c="dimmed" mb={8}>
                    Запрошено: {formatTaskDateTime(task.help_requested_at)}
                  </Text>
                ) : null}
                {task.help_comment ? (
                  <Text size="sm" mb="md" style={{ whiteSpace: 'pre-wrap' }}>
                    {task.help_comment}
                  </Text>
                ) : null}
                {helpers.length > 0 ? (
                  <Stack gap="xs">
                    {helpers.map((h) => (
                      <Paper key={h.id} p="sm" withBorder>
                        <Text size="sm" fw={500}>
                          {h.user?.full_name ?? 'Помощник'}
                        </Text>
                        {h.helper_comment ? (
                          <Text size="xs" mt={4}>
                            {h.helper_comment}
                          </Text>
                        ) : null}
                      </Paper>
                    ))}
                  </Stack>
                ) : null}
              </Paper>
            )}

            {parent ? (
              <Paper withBorder p="md" radius="md">
                <Text size="sm" fw={600} mb={4}>
                  Родительская задача
                </Text>
                <Button
                  variant="light"
                  size="compact-sm"
                  component={Link}
                  to={`/tasks/${parent.id}`}
                >
                  {parent.ticket_number ?? parent.id}: {parent.title}
                </Button>
              </Paper>
            ) : null}

            {devChildren.length > 0 ? (
              <Paper withBorder p="md" radius="md">
                <Text size="sm" fw={600} mb="sm">
                  Задачи разработчику (дочерние)
                </Text>
                <Table.ScrollContainer minWidth={400}>
                  <Table striped highlightOnHover withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>№</Table.Th>
                        <Table.Th>Название</Table.Th>
                        <Table.Th>Статус</Table.Th>
                        <Table.Th>Исполнитель</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {devChildren.map((c) => (
                        <Table.Tr key={c.id}>
                          <Table.Td>
                            <Button
                              variant="subtle"
                              size="compact-xs"
                              component={Link}
                              to={`/tasks/${c.id}`}
                            >
                              {c.ticket_number ?? c.id}
                            </Button>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" lineClamp={2}>
                              {c.title}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge size="xs" color={statusColor(c.status)} variant="light">
                              {TASK_STATUS_LABELS[c.status]}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs">{c.assignee?.full_name ?? '—'}</Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Paper>
            ) : null}

            {otherChildren.length > 0 ? (
              <Paper withBorder p="md" radius="md">
                <Text size="sm" fw={600} mb="sm">
                  Связанные задачи (дочерние)
                </Text>
                <Table.ScrollContainer minWidth={400}>
                  <Table striped highlightOnHover withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>№</Table.Th>
                        <Table.Th>Название</Table.Th>
                        <Table.Th>Статус</Table.Th>
                        <Table.Th>Исполнитель</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {otherChildren.map((c) => (
                        <Table.Tr key={c.id}>
                          <Table.Td>
                            <Button
                              variant="subtle"
                              size="compact-xs"
                              component={Link}
                              to={`/tasks/${c.id}`}
                            >
                              {c.ticket_number ?? c.id}
                            </Button>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" lineClamp={2}>
                              {c.title}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge size="xs" color={statusColor(c.status)} variant="light">
                              {TASK_STATUS_LABELS[c.status]}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs">{c.assignee?.full_name ?? '—'}</Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Paper>
            ) : null}

            <Tabs defaultValue="comments">
              <Tabs.List>
                <Tabs.Tab value="comments" leftSection={<IconMessage size={16} />}>
                  Комментарии
                </Tabs.Tab>
                <Tabs.Tab value="history" leftSection={<IconHistory size={16} />}>
                  История
                </Tabs.Tab>
                <Tabs.Tab value="files" leftSection={<IconPaperclip size={16} />}>
                  Вложения
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="comments" pt="md">
                <TaskCommentsSection taskId={taskId} />
              </Tabs.Panel>

              <Tabs.Panel value="history" pt="md">
                <TaskHistorySection taskId={taskId} />
              </Tabs.Panel>

              <Tabs.Panel value="files" pt="md">
                <Paper withBorder p="lg" radius="md">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap">
                      <IconFileDescription size={24} />
                      <div>
                        <Text fw={600}>Вложения</Text>
                        <Text size="sm" c="dimmed">
                          Пока нет добавленных файлов.
                        </Text>
                      </div>
                    </Group>
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconPlus size={14} />}
                      onClick={() =>
                        notifications.show({
                          color: 'blue',
                          title: 'Вложения',
                          message: 'Скоро будет доступно.',
                        })
                      }
                    >
                      Добавить
                    </Button>
                  </Group>
                </Paper>
              </Tabs.Panel>
            </Tabs>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Paper withBorder p="md" radius="md" pos="sticky" top={72}>
            <Stack gap="sm">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                Метаданные
              </Text>
              <Meta label="Создатель" value={task.creator?.full_name ?? '—'} />
              <Meta label="Исполнитель" value={task.assignee?.full_name ?? '—'} />
              <Meta
                label="Категория"
                value={
                  task.category
                    ? `${task.category.name} (${SEVERITY_LABEL[task.category.severity]})`
                    : '—'
                }
              />
              <Meta label="Тип задачи" value={task.task_type?.name ?? '—'} />
              <Group gap="xs">
                <Text size="sm" c="dimmed" w={110}>
                  Приоритет
                </Text>
                <Badge color={priorityColor(task.priority)} variant="light">
                  {TASK_PRIORITY_LABELS[task.priority]}
                </Badge>
              </Group>
              <Meta label="Сложность" value={String(task.complexity)} />
              <Meta label="Срок" value={formatTaskDateTime(task.due_date)} />
              <div>
                <Text size="sm" c="dimmed" mb={4}>
                  Теги
                </Text>
                <Group gap={4}>
                  {tags.length === 0 ? (
                    <Text size="sm">—</Text>
                  ) : (
                    tags.map((t) => (
                      <Badge
                        key={t.id}
                        size="sm"
                        variant="light"
                        style={
                          t.color
                            ? { backgroundColor: `${t.color}22`, color: t.color }
                            : undefined
                        }
                      >
                        {t.name}
                      </Badge>
                    ))
                  )}
                </Group>
              </div>
              <Meta label="Создана" value={formatTaskDateTime(task.created_at)} />
              <Meta label="Обновлена" value={formatTaskDateTime(task.updated_at)} />

              <Text size="xs" tt="uppercase" fw={700} c="dimmed" mt="md">
                Действия
              </Text>
              {canEdit ? (
                <Button
                  variant="light"
                  fullWidth
                  leftSection={<IconPencil size={16} />}
                  onClick={() => setEditModalOpen(true)}
                >
                  Редактировать
                </Button>
              ) : null}
              {showTransitionButtons ? (
                <Stack gap="xs">
                  {transitionButtonStatuses.map((s) => (
                    <Button
                      key={s}
                      variant="light"
                      fullWidth
                      onClick={() => applyTransition(s)}
                      loading={updateMut.isPending || helpRequestMut.isPending}
                    >
                      {task.status === 'new' && s === 'in_progress'
                        ? 'Взять в работу / В работе'
                        : s === 'needs_help'
                          ? '→ Запросить помощь'
                          : `→ ${TASK_STATUS_LABELS[s]}`}
                    </Button>
                  ))}
                </Stack>
              ) : (
                <Text size="xs" c="dimmed">
                  Нет доступных переходов для вашей роли или статуса задачи.
                </Text>
              )}

              {canReject ? (
                <Button
                  variant="light"
                  color="orange"
                  fullWidth
                  leftSection={<IconUserX size={16} />}
                  onClick={() => setRejectModalOpen(true)}
                >
                  Отклонить задачу
                </Button>
              ) : null}

              <Button
                variant="outline"
                fullWidth
                component={Link}
                to={`/tasks/new?parent=${task.id}`}
              >
                Создать связанную задачу
              </Button>

              {canDevChild ? (
                <Button
                  variant="light"
                  fullWidth
                  leftSection={<IconCode size={16} />}
                  component={Link}
                  to={`/tasks/new?parent=${task.id}&dev=1`}
                >
                  Создать задачу разработчику
                </Button>
              ) : null}

              <Button
                variant="default"
                fullWidth
                onClick={() => {
                  setTemplateName(task.title);
                  setTemplateDesc(task.description ?? '');
                  setTemplatePublic(false);
                  setTemplateModalOpen(true);
                }}
              >
                Сохранить как шаблон
              </Button>

              {canCancel ? (
                <Button
                  variant="light"
                  color="gray"
                  fullWidth
                  leftSection={<IconBan size={16} />}
                  onClick={() => setCancelModalOpen(true)}
                >
                  Отменить задачу
                </Button>
              ) : null}

              {canDelete ? (
                <Button color="red" variant="light" fullWidth onClick={openDeleteModal}>
                  Удалить задачу
                </Button>
              ) : null}
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>

      {user?.id && detailQuery.data ? (
        <EditTaskModal
          opened={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          bundle={detailQuery.data}
          userId={user.id}
          onSaved={invalidateTask}
        />
      ) : null}

      <Modal
        opened={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false);
          setCancelReasonDraft('');
        }}
        title="Отменить задачу"
        centered
      >
        <Text size="sm" mb="sm">
          Укажите причину отмены (не короче 5 символов). Задача перейдёт в статус «Отменена».
        </Text>
        <Textarea
          minRows={4}
          value={cancelReasonDraft}
          onChange={(e) => setCancelReasonDraft(e.currentTarget.value)}
          placeholder="Причина отмены…"
        />
        <Group justify="flex-end" mt="md">
          <Button
            variant="default"
            onClick={() => {
              setCancelModalOpen(false);
              setCancelReasonDraft('');
            }}
          >
            Закрыть
          </Button>
          <Button color="gray" onClick={confirmCancel} loading={cancelMut.isPending}>
            Отменить задачу
          </Button>
        </Group>
      </Modal>

      <Modal
        opened={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
          setRejectReasonDraft('');
        }}
        title="Отклонить задачу"
        centered
      >
        <Text size="sm" mb="sm">
          Укажите причину (не короче 10 символов). Задача вернётся в статус «Новая» без исполнителя;
          создатель получит уведомление.
        </Text>
        <Textarea
          minRows={4}
          value={rejectReasonDraft}
          onChange={(e) => setRejectReasonDraft(e.currentTarget.value)}
          placeholder="Причина отклонения…"
        />
        <Group justify="flex-end" mt="md">
          <Button
            variant="default"
            onClick={() => {
              setRejectModalOpen(false);
              setRejectReasonDraft('');
            }}
          >
            Отмена
          </Button>
          <Button color="orange" onClick={confirmReject} loading={rejectMut.isPending}>
            Отклонить
          </Button>
        </Group>
      </Modal>

      <Modal
        opened={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title="Сохранить как шаблон"
        centered
        size="md"
      >
        <Text size="sm" mb="sm">
          Будут сохранены название и описание (можно отредактировать), категория, тип, приоритет,
          сложность и теги текущей задачи.
        </Text>
        <TextInput
          label="Название шаблона"
          required
          mb="sm"
          value={templateName}
          onChange={(e) => setTemplateName(e.currentTarget.value)}
        />
        <Textarea
          label="Описание в шаблоне"
          minRows={4}
          mb="sm"
          value={templateDesc}
          onChange={(e) => setTemplateDesc(e.currentTarget.value)}
          placeholder="Текст для новых задач из этого шаблона…"
        />
        {role === 'manager' || role === 'admin' ? (
          <Checkbox
            label="Общий шаблон (виден всем сотрудникам)"
            checked={templatePublic}
            onChange={(e) => setTemplatePublic(e.currentTarget.checked)}
            mb="md"
          />
        ) : null}
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setTemplateModalOpen(false)}>
            Отмена
          </Button>
          <Button
            loading={saveTemplateMut.isPending}
            onClick={() =>
              saveTemplateMut.mutate({
                name: templateName,
                description_template: templateDesc.trim() ? templateDesc : null,
                is_public: templatePublic,
              })
            }
          >
            Сохранить шаблон
          </Button>
        </Group>
      </Modal>

      <Modal
        opened={helpModalOpen}
        onClose={() => {
          setHelpModalOpen(false);
          setHelpHelperIds([]);
        }}
        title="Запрос помощи"
        centered
      >
        <Text size="sm" mb="sm">
          Опишите проблему и выберите хотя бы одного коллегу — ему уйдёт уведомление (ТЗ §4.5).
        </Text>
        <Textarea
          minRows={4}
          value={helpDraft}
          onChange={(e) => setHelpDraft(e.currentTarget.value)}
          placeholder="Чем нужна помощь…"
          mb="sm"
        />
        <MultiSelect
          label="Помощники"
          placeholder={helpUsersQuery.isLoading ? 'Загрузка…' : 'Выберите пользователей'}
          data={
            helpUsersQuery.data
              ?.filter((u) => u.id !== uid)
              .map((u) => ({
                value: u.id,
                label: `${u.full_name} (${u.login})`,
              })) ?? []
          }
          value={helpHelperIds}
          onChange={setHelpHelperIds}
          searchable
          nothingFoundMessage="Нет пользователей"
        />
        <Group justify="flex-end" mt="md">
          <Button
            variant="default"
            onClick={() => {
              setHelpModalOpen(false);
              setHelpHelperIds([]);
            }}
          >
            Отмена
          </Button>
          <Button onClick={submitHelpRequest} loading={helpRequestMut.isPending}>
            Перевести в «Нужна помощь»
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <Group gap="xs" align="flex-start" wrap="nowrap">
      <Text size="sm" c="dimmed" w={110} style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Text size="sm" style={{ flex: 1 }}>
        {value}
      </Text>
    </Group>
  );
}
