import { useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Button,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { BarChart } from '@mantine/charts';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';

import {
  fetchReportAvgResolution,
  fetchReportHelpStats,
  fetchReportOpenByAssignee,
  fetchReportOverdue,
  fetchReportTopCategories,
} from './api';
import { downloadCsv } from './csv';

type Preset = '7' | '30' | '90' | 'custom';
type TabKey = 'open' | 'overdue' | 'avg' | 'categories' | 'help';

function usePeriod(preset: Preset, custom: [Date | null, Date | null]) {
  return useMemo(() => {
    const end = dayjs().endOf('day');
    if (preset === 'custom' && custom[0] && custom[1]) {
      const a = dayjs(custom[0]).startOf('day');
      const b = dayjs(custom[1]).endOf('day');
      return {
        pFrom: a.toISOString(),
        pTo: b.toISOString(),
        ready: true,
      };
    }
    if (preset === 'custom') {
      return { pFrom: end.subtract(30, 'day').startOf('day').toISOString(), pTo: end.toISOString(), ready: false };
    }
    const days = preset === '7' ? 7 : preset === '30' ? 30 : 90;
    return {
      pFrom: end.subtract(days, 'day').startOf('day').toISOString(),
      pTo: end.toISOString(),
      ready: true,
    };
  }, [preset, custom]);
}

function shortLabel(s: string, max = 24) {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

export function AnalyticsPage() {
  const [preset, setPreset] = useState<Preset>('30');
  const [customRange, setCustomRange] = useState<[Date | null, Date | null]>([
    null,
    null,
  ]);
  const [tab, setTab] = useState<TabKey>('open');

  const { pFrom, pTo, ready } = usePeriod(preset, customRange);
  const rangeOk = preset !== 'custom' || ready;

  const openQ = useQuery({
    queryKey: ['analytics', 'open', pFrom, pTo],
    queryFn: () => fetchReportOpenByAssignee(pFrom, pTo),
    enabled: rangeOk && tab === 'open',
  });
  const overdueQ = useQuery({
    queryKey: ['analytics', 'overdue', pFrom, pTo],
    queryFn: () => fetchReportOverdue(pFrom, pTo),
    enabled: rangeOk && tab === 'overdue',
  });
  const avgQ = useQuery({
    queryKey: ['analytics', 'avg', pFrom, pTo],
    queryFn: () => fetchReportAvgResolution(pFrom, pTo),
    enabled: rangeOk && tab === 'avg',
  });
  const catQ = useQuery({
    queryKey: ['analytics', 'categories', pFrom, pTo],
    queryFn: () => fetchReportTopCategories(pFrom, pTo),
    enabled: rangeOk && tab === 'categories',
  });
  const helpQ = useQuery({
    queryKey: ['analytics', 'help', pFrom, pTo],
    queryFn: () => fetchReportHelpStats(pFrom, pTo),
    enabled: rangeOk && tab === 'help',
  });

  const openChart = useMemo(() => {
    const rows = openQ.data ?? [];
    return rows.slice(0, 20).map((r) => ({
      label: shortLabel(r.full_name),
      count: Number(r.open_count),
    }));
  }, [openQ.data]);

  const avgChart = useMemo(() => {
    const rows = avgQ.data ?? [];
    const map = new Map<string, { sum: number; w: number }>();
    for (const r of rows) {
      const cur = map.get(r.category_name) ?? { sum: 0, w: 0 };
      cur.sum += r.avg_resolution_hours * r.tasks_done;
      cur.w += r.tasks_done;
      map.set(r.category_name, cur);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({
        label: shortLabel(name, 20),
        hours: v.w > 0 ? Math.round((v.sum / v.w) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 16);
  }, [avgQ.data]);

  const catChart = useMemo(() => {
    const rows = catQ.data ?? [];
    return rows.slice(0, 16).map((r) => ({
      label: shortLabel(r.category_name, 20),
      count: Number(r.task_count),
    }));
  }, [catQ.data]);

  const periodHint = `${dayjs(pFrom).format('DD.MM.YYYY')} — ${dayjs(pTo).format('DD.MM.YYYY')}`;

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Аналитика</Title>
        <Text c="dimmed" size="sm" mt={4}>
          Отчёты по задачам за выбранный период. Доступно руководителю и администратору.
        </Text>
      </div>

      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Group align="flex-end" wrap="wrap">
            <div>
              <Text size="sm" fw={500} mb={6}>
                Период
              </Text>
              <SegmentedControl
                value={preset}
                onChange={(v) => setPreset(v as Preset)}
                data={[
                  { label: '7 дней', value: '7' },
                  { label: '30 дней', value: '30' },
                  { label: '90 дней', value: '90' },
                  { label: 'Свой', value: 'custom' },
                ]}
              />
            </div>
            {preset === 'custom' ? (
              <DatePickerInput
                type="range"
                label="Диапазон дат"
                placeholder="С — по"
                value={customRange}
                onChange={(v) => setCustomRange(v as [Date | null, Date | null])}
                maxDate={new Date()}
              />
            ) : null}
          </Group>
          <Text size="xs" c="dimmed">
            {rangeOk ? periodHint : 'Выберите две даты для произвольного периода.'}
          </Text>
        </Stack>
      </Paper>

      {!rangeOk ? (
        <Alert color="gray" title="Период не выбран">
          Укажите начало и конец диапазона.
        </Alert>
      ) : (
        <Tabs value={tab} onChange={(v) => v && setTab(v as TabKey)}>
          <Tabs.List>
            <Tabs.Tab value="open">Открытые по исполнителю</Tabs.Tab>
            <Tabs.Tab value="overdue">Просрочки</Tabs.Tab>
            <Tabs.Tab value="avg">Среднее время выполнения</Tabs.Tab>
            <Tabs.Tab value="categories">Топ категорий</Tabs.Tab>
            <Tabs.Tab value="help">Нужна помощь</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="open" pt="md">
            <ReportPanel
              title="Открытые задачи по исполнителю"
              subtitle="Задачи, созданные в периоде и ещё не завершённые (не «Выполнена» / «Отменена»)."
              loading={openQ.isPending}
              error={openQ.error ?? null}
              empty={!(openQ.data?.length ?? 0)}
              chart={
                openChart.length > 0 ? (
                  <BarChart
                    h={300}
                    data={openChart}
                    dataKey="label"
                    series={[{ name: 'count', color: 'blue.6', label: 'Задач' }]}
                    tickLine="y"
                    withTooltip
                    withBarValueLabel
                  />
                ) : null
              }
              table={
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Исполнитель</Table.Th>
                      <Table.Th>Логин</Table.Th>
                      <Table.Th>Открытых</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(openQ.data ?? []).map((r) => (
                      <Table.Tr key={r.assignee_id}>
                        <Table.Td>{r.full_name}</Table.Td>
                        <Table.Td>{r.login}</Table.Td>
                        <Table.Td>{r.open_count}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              }
              onExport={() =>
                downloadCsv(
                  `open-by-assignee-${dayjs(pFrom).format('YYYYMMDD')}`,
                  (openQ.data ?? []).map((r) => ({
                    full_name: r.full_name,
                    login: r.login,
                    open_count: r.open_count,
                  })),
                )
              }
            />
          </Tabs.Panel>

          <Tabs.Panel value="overdue" pt="md">
            <ReportPanel
              title="Просроченные задачи"
              subtitle="Срок в периоде, дедлайн уже прошёл, задача ещё активна."
              loading={overdueQ.isPending}
              error={overdueQ.error}
              empty={!(overdueQ.data?.length ?? 0)}
              chart={
                overdueQ.data && overdueQ.data.length > 0 ? (
                  <BarChart
                    h={280}
                    data={overdueQ.data.slice(0, 15).map((r) => ({
                      label: shortLabel(r.ticket_number ?? `#${r.task_id}`, 16),
                      days: Math.max(
                        0,
                        dayjs().diff(dayjs(r.due_date), 'day', true),
                      ),
                    }))}
                    dataKey="label"
                    series={[{ name: 'days', color: 'red.6', label: 'Дней с дедлайна' }]}
                    tickLine="y"
                    withTooltip
                    valueFormatter={(v) => `${Math.round(v)} дн.`}
                  />
                ) : null
              }
              table={
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Номер</Table.Th>
                      <Table.Th>Заголовок</Table.Th>
                      <Table.Th>Категория</Table.Th>
                      <Table.Th>Исполнитель</Table.Th>
                      <Table.Th>Срок</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(overdueQ.data ?? []).map((r) => (
                      <Table.Tr key={r.task_id}>
                        <Table.Td>{r.ticket_number}</Table.Td>
                        <Table.Td>{r.title}</Table.Td>
                        <Table.Td>{r.category_name}</Table.Td>
                        <Table.Td>{r.assignee_name}</Table.Td>
                        <Table.Td>
                          {dayjs(r.due_date).format('DD.MM.YYYY HH:mm')}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              }
              onExport={() =>
                downloadCsv(
                  `overdue-${dayjs(pFrom).format('YYYYMMDD')}`,
                  (overdueQ.data ?? []).map((r) => ({
                    ticket_number: r.ticket_number,
                    title: r.title,
                    category: r.category_name,
                    assignee: r.assignee_name,
                    due_date: r.due_date,
                  })),
                )
              }
            />
          </Tabs.Panel>

          <Tabs.Panel value="avg" pt="md">
            <ReportPanel
              title="Среднее время выполнения"
              subtitle="По завершённым задачам (дата завершения в периоде), часы от создания до completed_at."
              loading={avgQ.isPending}
              error={avgQ.error}
              empty={!(avgQ.data?.length ?? 0)}
              chart={
                avgChart.length > 0 ? (
                  <BarChart
                    h={300}
                    data={avgChart}
                    dataKey="label"
                    series={[
                      { name: 'hours', color: 'teal.6', label: 'Часов (ср. по кат.)' },
                    ]}
                    tickLine="y"
                    withTooltip
                    valueFormatter={(v) => `${v} ч`}
                  />
                ) : null
              }
              table={
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Категория</Table.Th>
                      <Table.Th>Исполнитель</Table.Th>
                      <Table.Th>Закрыто</Table.Th>
                      <Table.Th>Ср. часов</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(avgQ.data ?? []).map((r, i) => (
                      <Table.Tr
                        key={`${r.category_id}-${r.assignee_id}-${i}`}
                      >
                        <Table.Td>{r.category_name}</Table.Td>
                        <Table.Td>{r.assignee_name}</Table.Td>
                        <Table.Td>{r.tasks_done}</Table.Td>
                        <Table.Td>
                          {Math.round(r.avg_resolution_hours * 10) / 10}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              }
              onExport={() =>
                downloadCsv(
                  `avg-resolution-${dayjs(pFrom).format('YYYYMMDD')}`,
                  (avgQ.data ?? []).map((r) => ({
                    category: r.category_name,
                    assignee: r.assignee_name,
                    tasks_done: r.tasks_done,
                    avg_resolution_hours: r.avg_resolution_hours,
                  })),
                )
              }
            />
          </Tabs.Panel>

          <Tabs.Panel value="categories" pt="md">
            <ReportPanel
              title="Топ категорий"
              subtitle="Количество созданных задач по категориям за период."
              loading={catQ.isPending}
              error={catQ.error}
              empty={!(catQ.data?.length ?? 0)}
              chart={
                catChart.length > 0 ? (
                  <BarChart
                    h={300}
                    data={catChart}
                    dataKey="label"
                    series={[{ name: 'count', color: 'violet.6', label: 'Задач' }]}
                    tickLine="y"
                    withTooltip
                    withBarValueLabel
                  />
                ) : null
              }
              table={
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Категория</Table.Th>
                      <Table.Th>Задач</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(catQ.data ?? []).map((r) => (
                      <Table.Tr key={r.category_id}>
                        <Table.Td>{r.category_name}</Table.Td>
                        <Table.Td>{r.task_count}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              }
              onExport={() =>
                downloadCsv(
                  `top-categories-${dayjs(pFrom).format('YYYYMMDD')}`,
                  (catQ.data ?? []).map((r) => ({
                    category: r.category_name,
                    task_count: r.task_count,
                  })),
                )
              }
            />
          </Tabs.Panel>

          <Tabs.Panel value="help" pt="md">
            <ReportPanel
              title="Запросы помощи"
              subtitle="Задачи в статусе «Нужна помощь», запрос в периоде."
              loading={helpQ.isPending}
              error={helpQ.error}
              empty={!(helpQ.data?.length ?? 0)}
              chart={
                helpQ.data && helpQ.data.length > 0 ? (
                  <BarChart
                    h={280}
                    data={helpQ.data.slice(0, 14).map((r) => ({
                      label: shortLabel(r.ticket_number ?? `#${r.task_id}`, 14),
                      hours: Math.round(r.hours_in_needs_help * 10) / 10,
                    }))}
                    dataKey="label"
                    series={[
                      {
                        name: 'hours',
                        color: 'orange.6',
                        label: 'Часов в статусе',
                      },
                    ]}
                    tickLine="y"
                    withTooltip
                    valueFormatter={(v) => `${v} ч`}
                  />
                ) : null
              }
              table={
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Номер</Table.Th>
                      <Table.Th>Заголовок</Table.Th>
                      <Table.Th>Исполнитель</Table.Th>
                      <Table.Th>Запрос помощи</Table.Th>
                      <Table.Th>Часов</Table.Th>
                      <Table.Th>Помощников</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(helpQ.data ?? []).map((r) => (
                      <Table.Tr key={r.task_id}>
                        <Table.Td>{r.ticket_number}</Table.Td>
                        <Table.Td>{r.title}</Table.Td>
                        <Table.Td>{r.assignee_name}</Table.Td>
                        <Table.Td>
                          {dayjs(r.help_requested_at).format('DD.MM.YYYY HH:mm')}
                        </Table.Td>
                        <Table.Td>
                          {Math.round(r.hours_in_needs_help * 10) / 10}
                        </Table.Td>
                        <Table.Td>{r.active_helpers}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              }
              onExport={() =>
                downloadCsv(
                  `help-stats-${dayjs(pFrom).format('YYYYMMDD')}`,
                  (helpQ.data ?? []).map((r) => ({
                    ticket_number: r.ticket_number,
                    title: r.title,
                    assignee: r.assignee_name,
                    help_requested_at: r.help_requested_at,
                    hours_in_needs_help: r.hours_in_needs_help,
                    active_helpers: r.active_helpers,
                  })),
                )
              }
            />
          </Tabs.Panel>
        </Tabs>
      )}
    </Stack>
  );
}

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e ?? 'Ошибка');
}

function ReportPanel(props: {
  title: string;
  subtitle: string;
  loading: boolean;
  error: unknown;
  empty: boolean;
  chart: ReactNode;
  table: ReactNode;
  onExport: () => void;
}) {
  const { title, subtitle, loading, error, empty, chart, table, onExport } =
    props;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Text fw={600}>{title}</Text>
          <Text size="sm" c="dimmed">
            {subtitle}
          </Text>
        </div>
        <Button variant="light" onClick={onExport} disabled={empty || loading}>
          Экспорт в CSV
        </Button>
      </Group>

      {loading ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : error ? (
        <Alert color="red" title="Ошибка">
          {errMessage(error)}
        </Alert>
      ) : empty ? (
        <Text c="dimmed" size="sm">
          Нет данных за выбранный период.
        </Text>
      ) : (
        <>
          {chart ? <Paper withBorder p="md" radius="md">{chart}</Paper> : null}
          <Paper withBorder p="md" radius="md">
            {table}
          </Paper>
        </>
      )}
    </Stack>
  );
}
