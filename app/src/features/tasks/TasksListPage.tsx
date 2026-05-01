import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Drawer,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Pagination,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDebouncedValue } from '@mantine/hooks';
import {
  IconFilter,
  IconLayoutKanban,
  IconLayoutList,
  IconSearch,
  IconBaselineDensityMedium,
  IconBaselineDensitySmall,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useNavigate } from '@tanstack/react-router';
import type { Database, TablesUpdate } from '@/types/database';
import { useAuth, type UserRole } from '@/lib/auth-context';
import { cancelTask } from './api/cancelTask';
import { deleteTask } from './api/deleteTask';
import {
  defaultTaskListFilters,
  fetchActiveHelperTaskIdsForUser,
  fetchHelperTaskIds,
  fetchTagsForTasks,
  listTasksKanban,
  listTasksPage,
  type TaskListFilters,
  type TaskListRow,
} from './api/listTasks';
import { updateTask } from './api/updateTask';
import { fetchTaskFormReferences } from './api/referenceQueries';
import { KanbanBoard, type KanbanDensity } from './components/KanbanBoard';
import { useTaskListView } from './hooks/useTaskListView';
import { formatTaskDateTime } from './lib/formatTaskDate';
import { formatTaskUpdateError } from './lib/formatTaskUpdateError';
import {
  priorityColor,
  statusColor,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from './lib/labels';
import { canCancelTask, canDeleteTask } from './lib/taskActions';
import {
  buildStatusUpdatePatch,
  canTransition,
} from './lib/transitions';
import { taskCancelReasonSchema } from './schemas';

type TaskStatus = Database['public']['Enums']['task_status'];
type TaskPriority = Database['public']['Enums']['task_priority'];

const PAGE_SIZE = 25;

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = (
  Object.keys(TASK_STATUS_LABELS) as TaskStatus[]
).map((value) => ({
  value,
  label: TASK_STATUS_LABELS[value],
}));

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = (
  Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]
).map((value) => ({
  value,
  label: TASK_PRIORITY_LABELS[value],
}));

export interface TasksListPageProps {
  variant: 'my' | 'all';
}

export function TasksListPage({ variant }: TasksListPageProps) {
  const { user, role } = useAuth();
  const { view, setView } = useTaskListView();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<TaskListFilters>(defaultTaskListFilters);
  const [draftFilters, setDraftFilters] = useState<TaskListFilters>(
    defaultTaskListFilters,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [cancelTaskId, setCancelTaskId] = useState<number | null>(null);
  const [cancelDraft, setCancelDraft] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchInput, 300);
  const prevDebouncedSearch = useRef<string | undefined>(undefined);
  const [kanbanDensity, setKanbanDensity] = useState<KanbanDensity>(() => {
    try {
      const v = localStorage.getItem('crm:tasks:kanban_density');
      return v === 'compact' ? 'compact' : 'comfortable';
    } catch {
      return 'comfortable';
    }
  });
  const changeKanbanDensity = (next: KanbanDensity) => {
    setKanbanDensity(next);
    try {
      localStorage.setItem('crm:tasks:kanban_density', next);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const next = debouncedSearch.trim();
    if (prevDebouncedSearch.current === next) return;
    prevDebouncedSearch.current = next;
    setFilters((f) => ({ ...f, search: next }));
    setPage(0);
  }, [debouncedSearch]);

  // Global realtime subscription on `tasks` lives in `AppLayout`; this page
  // just needs a local helper to flush the same caches after mutations.
  const invalidateList = () => {
    void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    void queryClient.invalidateQueries({ queryKey: ['task', 'detail'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const deleteMut = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      invalidateList();
      notifications.show({ title: 'Задача удалена', message: '', color: 'green' });
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
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      cancelTask(id, reason),
    onSuccess: () => {
      invalidateList();
      setCancelTaskId(null);
      setCancelDraft('');
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

  const openDeleteModal = (row: TaskListRow) => {
    if (!user?.id) return;
    const isAdminFullDelete = role === 'admin' && row.status !== 'new';
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
      onConfirm: () => deleteMut.mutate(row.id),
    });
  };

  const refsQuery = useQuery({
    queryKey: ['tasks', 'list-refs'],
    queryFn: fetchTaskFormReferences,
  });

  const helperIdsQuery = useQuery({
    queryKey: ['tasks', 'helper-ids', user?.id],
    queryFn: () => fetchHelperTaskIds(user!.id),
    enabled: !!user?.id && variant === 'my',
  });

  const listQuery = useQuery({
    queryKey: [
      'tasks',
      'list',
      variant,
      user?.id,
      helperIdsQuery.data,
      filters,
      page,
    ],
    queryFn: async () => {
      if (!user?.id) throw new Error('Нет пользователя');
      return listTasksPage({
        mode: variant,
        userId: user.id,
        helperTaskIds: helperIdsQuery.data ?? [],
        filters,
        page,
        pageSize: PAGE_SIZE,
      });
    },
    enabled:
      !!user?.id &&
      (variant === 'all' || helperIdsQuery.isSuccess) &&
      view === 'list',
  });

  const kanbanQuery = useQuery({
    queryKey: [
      'tasks',
      'kanban',
      variant,
      user?.id,
      helperIdsQuery.data,
      filters,
    ],
    queryFn: async () => {
      if (!user?.id) throw new Error('Нет пользователя');
      return listTasksKanban({
        mode: variant,
        userId: user.id,
        helperTaskIds: helperIdsQuery.data ?? [],
        filters,
      });
    },
    enabled:
      !!user?.id &&
      (variant === 'all' || helperIdsQuery.isSuccess) &&
      view === 'kanban',
  });

  const kanbanTaskIds = useMemo(
    () => kanbanQuery.data?.map((t) => t.id) ?? [],
    [kanbanQuery.data],
  );

  const kanbanHelpersQuery = useQuery({
    queryKey: ['tasks', 'kanban-helpers', user?.id, kanbanTaskIds],
    queryFn: () => fetchActiveHelperTaskIdsForUser(user!.id, kanbanTaskIds),
    enabled: !!user?.id && view === 'kanban' && kanbanTaskIds.length > 0,
  });

  const kanbanTagsQuery = useQuery({
    queryKey: ['tasks', 'kanban-tags', kanbanTaskIds],
    queryFn: () => fetchTagsForTasks(kanbanTaskIds),
    enabled: view === 'kanban' && kanbanTaskIds.length > 0,
  });

  const taskIds = useMemo(() => {
    if (view !== 'list') return [];
    return listQuery.data?.rows.map((r) => r.id) ?? [];
  }, [view, listQuery.data?.rows]);

  const tagsQuery = useQuery({
    queryKey: ['tasks', 'list-tags', taskIds],
    queryFn: () => fetchTagsForTasks(taskIds),
    enabled: view === 'list' && taskIds.length > 0,
  });

  const statusDragMut = useMutation({
    mutationFn: async ({
      taskId,
      patch,
    }: {
      taskId: number;
      patch: TablesUpdate<'tasks'>;
    }) => {
      await updateTask(taskId, patch);
    },
    onSuccess: () => {
      invalidateList();
      notifications.show({
        title: 'Статус обновлён',
        message: 'Карточка перемещена.',
        color: 'green',
      });
    },
    onError: (e: Error) => {
      notifications.show({
        title: 'Не удалось переместить',
        message: formatTaskUpdateError(e) || e.message,
        color: 'red',
      });
    },
  });

  const helperSetForKanban = useMemo(
    () => kanbanHelpersQuery.data ?? new Set<number>(),
    [kanbanHelpersQuery.data],
  );

  function onKanbanStatusChange(task: TaskListRow, nextStatus: TaskStatus) {
    if (!user?.id || !role) return;
    if (task.status === nextStatus) return;
    if (nextStatus === 'cancelled') {
      notifications.show({
        title: 'Отмена',
        message: 'Используйте действие «Отменить» в списке или карточке.',
        color: 'orange',
      });
      return;
    }
    if (nextStatus === 'needs_help' && task.status !== 'needs_help') {
      notifications.show({
        title: 'Нужна помощь',
        message: 'Перевод через «Запросить помощь» в карточке задачи.',
        color: 'orange',
      });
      return;
    }
    const ctx = {
      role,
      isAssignee: task.assignee_id === user.id,
      isCreator: task.creator_id === user.id,
      isHelper: helperSetForKanban.has(task.id),
      hasAssignee: !!task.assignee_id,
    };
    if (!canTransition(task.status, nextStatus, ctx)) {
      notifications.show({
        title: 'Переход недоступен',
        message: 'Недостаточно прав для этого статуса.',
        color: 'orange',
      });
      return;
    }
    const patch = buildStatusUpdatePatch({
      task: {
        id: task.id,
        status: task.status,
        assignee_id: task.assignee_id,
      },
      nextStatus,
      currentUserId: user.id,
      role,
    });
    statusDragMut.mutate({ taskId: task.id, patch });
  }

  const applyDraftFilters = () => {
    setFilters({ ...draftFilters });
    setSearchInput(draftFilters.search);
    setPage(0);
    setDrawerOpen(false);
  };

  const resetFilters = () => {
    const empty = defaultTaskListFilters();
    setDraftFilters(empty);
    setFilters(empty);
    setSearchInput('');
    setPage(0);
  };

  const rows = view === 'list' ? (listQuery.data?.rows ?? []) : [];
  const total = view === 'list' ? (listQuery.data?.total ?? 0) : 0;
  const tagMap = tagsQuery.data ?? new Map();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const listError = view === 'list' && listQuery.isError;
  const kanbanError = view === 'kanban' && kanbanQuery.isError;
  const queryError = listError ? listQuery.error : kanbanError ? kanbanQuery.error : null;

  const isListLoading =
    view === 'list' &&
    (listQuery.isPending || (variant === 'my' && helperIdsQuery.isPending));
  const isKanbanLoading =
    view === 'kanban' &&
    (kanbanQuery.isPending || (variant === 'my' && helperIdsQuery.isPending));

  const title =
    variant === 'my' ? 'Мои задачи' : 'Все задачи';

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Title order={2}>{title}</Title>
          <Text size="sm" c="dimmed" mt={4}>
            {variant === 'my'
              ? 'Задачи, где вы автор, исполнитель или помощник.'
              : 'Все задачи, доступные вашей роли (RLS).'}
          </Text>
        </div>
        <Group>
          <SegmentedControl
            value={view}
            onChange={(v) => void setView(v as 'list' | 'kanban')}
            data={[
              {
                value: 'list',
                label: (
                  <Group gap={6} wrap="nowrap">
                    <IconLayoutList size={16} />
                    <span>Список</span>
                  </Group>
                ),
              },
              {
                value: 'kanban',
                label: (
                  <Group gap={6} wrap="nowrap">
                    <IconLayoutKanban size={16} />
                    <span>Канбан</span>
                  </Group>
                ),
              },
            ]}
          />
          {view === 'kanban' ? (
            <SegmentedControl
              value={kanbanDensity}
              onChange={(v) => changeKanbanDensity(v as KanbanDensity)}
              aria-label="Плотность карточек канбана"
              data={[
                {
                  value: 'comfortable',
                  label: (
                    <Tooltip label="Просторный" withArrow>
                      <Group gap={4} wrap="nowrap">
                        <IconBaselineDensityMedium size={14} />
                      </Group>
                    </Tooltip>
                  ),
                },
                {
                  value: 'compact',
                  label: (
                    <Tooltip label="Компактный" withArrow>
                      <Group gap={4} wrap="nowrap">
                        <IconBaselineDensitySmall size={14} />
                      </Group>
                    </Tooltip>
                  ),
                },
              ]}
            />
          ) : null}
          <Button
            leftSection={<IconFilter size={18} />}
            variant="light"
            onClick={() => {
              setDraftFilters({ ...filters });
              setDrawerOpen(true);
            }}
          >
            Фильтры
          </Button>
          <Button onClick={() => void navigate({ to: '/tasks/new' })}>
            Новая задача
          </Button>
        </Group>
      </Group>

      <TextInput
        placeholder="Поиск по названию, описанию, номеру…"
        leftSection={<IconSearch size={16} />}
        value={searchInput}
        onChange={(e) => setSearchInput(e.currentTarget.value)}
        style={{ maxWidth: 520 }}
      />

      {queryError ? (
        <Text c="red">
          {(queryError as Error).message || 'Не удалось загрузить задачи'}
        </Text>
      ) : isListLoading || isKanbanLoading ? (
        <Loader />
      ) : (
        <>
          {view === 'list' ? (
            <>
              <Table.ScrollContainer minWidth={900}>
                <Table striped highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>№</Table.Th>
                      <Table.Th>Название</Table.Th>
                      <Table.Th>Статус</Table.Th>
                      <Table.Th>Приоритет</Table.Th>
                      <Table.Th>Категория</Table.Th>
                      <Table.Th>Исполнитель</Table.Th>
                      <Table.Th>Срок</Table.Th>
                      <Table.Th>Теги</Table.Th>
                      <Table.Th>Обновлено</Table.Th>
                      <Table.Th style={{ width: 180 }}>Действия</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {rows.map((row) => (
                      <TaskRow
                        key={row.id}
                        row={row}
                        tags={tagMap.get(row.id) ?? []}
                        onOpen={() => void navigate({ to: `/tasks/${row.id}` })}
                        userId={user?.id ?? ''}
                        role={role}
                        onDelete={() => openDeleteModal(row)}
                        onCancel={() => {
                          setCancelTaskId(row.id);
                          setCancelDraft('');
                        }}
                      />
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>

              {rows.length === 0 ? (
                <Text c="dimmed" size="sm">
                  Нет задач по текущим фильтрам.
                </Text>
              ) : null}

              {totalPages > 1 ? (
                <Group justify="center">
                  <Pagination
                    total={totalPages}
                    value={page + 1}
                    onChange={(p) => setPage(p - 1)}
                    withEdges
                  />
                </Group>
              ) : null}
            </>
          ) : (
            <>
              <KanbanBoard
                tasks={kanbanQuery.data ?? []}
                tagMap={kanbanTagsQuery.data ?? new Map()}
                density={kanbanDensity}
                disabled={statusDragMut.isPending}
                onTaskOpen={(taskId) => void navigate({ to: `/tasks/${taskId}` })}
                onDragToStatus={onKanbanStatusChange}
              />
              {(kanbanQuery.data?.length ?? 0) >= 500 ? (
                <Text size="xs" c="dimmed">
                  Показаны не более 500 задач по фильтру. Сузьте фильтры или
                  откройте список.
                </Text>
              ) : null}
              {(kanbanQuery.data?.length ?? 0) === 0 ? (
                <Text c="dimmed" size="sm">
                  Нет задач по текущим фильтрам (колонка «Отменена» на доске не
                  показывается — используйте список).
                </Text>
              ) : null}
            </>
          )}
        </>
      )}

      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Фильтры"
        position="right"
        size="md"
      >
        <Stack gap="md">
          <MultiSelect
            label="Статус"
            data={STATUS_OPTIONS}
            value={draftFilters.status}
            onChange={(v) =>
              setDraftFilters((f) => ({
                ...f,
                status: v as TaskStatus[],
              }))
            }
            clearable
          />
          <MultiSelect
            label="Категория"
            data={(refsQuery.data?.categories ?? []).map((c) => ({
              value: String(c.id),
              label: c.name,
            }))}
            value={draftFilters.categoryIds.map(String)}
            onChange={(v) =>
              setDraftFilters((f) => ({
                ...f,
                categoryIds: v.map(Number),
              }))
            }
            clearable
            searchable
          />
          <MultiSelect
            label="Приоритет"
            data={PRIORITY_OPTIONS}
            value={draftFilters.priorities}
            onChange={(v) =>
              setDraftFilters((f) => ({
                ...f,
                priorities: v as TaskPriority[],
              }))
            }
            clearable
          />
          <MultiSelect
            label="Теги"
            data={(refsQuery.data?.tags ?? []).map((t) => ({
              value: String(t.id),
              label: t.name,
            }))}
            value={draftFilters.tagIds.map(String)}
            onChange={(v) =>
              setDraftFilters((f) => ({
                ...f,
                tagIds: v.map(Number),
              }))
            }
            clearable
            searchable
          />
          <Select
            label="Исполнитель"
            placeholder="Любой"
            clearable
            data={(refsQuery.data?.users ?? []).map((u) => ({
              value: u.id,
              label: `${u.full_name} (${u.login})`,
            }))}
            value={draftFilters.assigneeId}
            onChange={(v) =>
              setDraftFilters((f) => ({ ...f, assigneeId: v }))
            }
            searchable
          />
          <DatePickerInput
            type="range"
            label="Срок (диапазон)"
            placeholder="От — до"
            value={
              draftFilters.dueFrom && draftFilters.dueTo
                ? [new Date(draftFilters.dueFrom), new Date(draftFilters.dueTo)]
                : undefined
            }
            onChange={(range) => {
              if (!range || !range[0]) {
                setDraftFilters((f) => ({
                  ...f,
                  dueFrom: null,
                  dueTo: null,
                }));
                return;
              }
              const [from, to] = range;
              setDraftFilters((f) => ({
                ...f,
                dueFrom: from ? from.toISOString() : null,
                dueTo: to ? to.toISOString() : from ? from.toISOString() : null,
              }));
            }}
            locale="ru"
          />
          <Switch
            label="Только просроченные"
            checked={draftFilters.overdueOnly}
            onChange={(e) =>
              setDraftFilters((f) => ({
                ...f,
                overdueOnly: e.currentTarget.checked,
              }))
            }
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={resetFilters}>
              Сбросить
            </Button>
            <Button onClick={applyDraftFilters}>Применить</Button>
          </Group>
        </Stack>
      </Drawer>

      <Modal
        opened={cancelTaskId !== null}
        onClose={() => {
          setCancelTaskId(null);
          setCancelDraft('');
        }}
        title="Отменить задачу"
        centered
      >
        <Text size="sm" mb="sm">
          Укажите причину отмены (не короче 5 символов).
        </Text>
        <Textarea
          minRows={4}
          value={cancelDraft}
          onChange={(e) => setCancelDraft(e.currentTarget.value)}
          placeholder="Причина отмены…"
        />
        <Group justify="flex-end" mt="md">
          <Button
            variant="default"
            onClick={() => {
              setCancelTaskId(null);
              setCancelDraft('');
            }}
          >
            Закрыть
          </Button>
          <Button
            color="gray"
            loading={cancelMut.isPending}
            onClick={() => {
              if (cancelTaskId === null) return;
              const parsed = taskCancelReasonSchema.safeParse({ reason: cancelDraft });
              if (!parsed.success) {
                const msg =
                  parsed.error.flatten().fieldErrors.reason?.[0] ??
                  'Укажите причину не короче 5 символов';
                notifications.show({
                  title: 'Проверьте форму',
                  message: msg,
                  color: 'orange',
                });
                return;
              }
              cancelMut.mutate({ id: cancelTaskId, reason: parsed.data.reason });
            }}
          >
            Отменить задачу
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}

function TaskRow({
  row,
  tags,
  onOpen,
  userId,
  role,
  onDelete,
  onCancel,
}: {
  row: TaskListRow;
  tags: { id: number; name: string; color: string | null }[];
  onOpen: () => void;
  userId: string;
  role: UserRole | null | undefined;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const canDel = canDeleteTask({
    status: row.status,
    creatorId: row.creator_id ?? '',
    userId,
    role,
  });
  const canC = canCancelTask({
    status: row.status,
    creatorId: row.creator_id ?? '',
    userId,
    role,
  });

  return (
    <Table.Tr style={{ cursor: 'pointer' }} onClick={onOpen}>
      <Table.Td>
        <Text size="sm" ff="monospace">
          {row.ticket_number ?? row.id}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" lineClamp={2}>
          {row.title}
        </Text>
      </Table.Td>
      <Table.Td>
        <Badge size="sm" color={statusColor(row.status)} variant="light">
          {TASK_STATUS_LABELS[row.status]}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Badge size="sm" color={priorityColor(row.priority)} variant="light">
          {TASK_PRIORITY_LABELS[row.priority]}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Text size="xs">{row.category?.name ?? '—'}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="xs">
          {row.assignee ? row.assignee.full_name : '—'}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="xs">{formatTaskDateTime(row.due_date)}</Text>
        {row.is_overdue ? (
          <Badge size="xs" color="red" variant="outline" mt={4}>
            Просрочено
          </Badge>
        ) : null}
      </Table.Td>
      <Table.Td>
        <Group gap={4} wrap="wrap">
          {tags.slice(0, 4).map((t) => (
            <Badge
              key={t.id}
              size="xs"
              variant="light"
              style={
                t.color
                  ? { backgroundColor: `${t.color}22`, color: t.color }
                  : undefined
              }
            >
              {t.name}
            </Badge>
          ))}
          {tags.length > 4 ? (
            <Text size="xs" c="dimmed">
              +{tags.length - 4}
            </Text>
          ) : null}
        </Group>
      </Table.Td>
      <Table.Td>
        <Text size="xs">{formatTaskDateTime(row.updated_at)}</Text>
      </Table.Td>
      <Table.Td onClick={(e) => e.stopPropagation()}>
        <Group gap={6} wrap="nowrap">
          {canC ? (
            <Button size="compact-xs" variant="light" color="gray" onClick={onCancel}>
              Отменить
            </Button>
          ) : null}
          {canDel ? (
            <Button size="compact-xs" variant="light" color="red" onClick={onDelete}>
              Удалить
            </Button>
          ) : null}
          {!canC && !canDel ? (
            <Text size="xs" c="dimmed">
              —
            </Text>
          ) : null}
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}
