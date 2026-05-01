import { useEffect } from 'react';
import {
  Anchor,
  AppShell,
  Avatar,
  Badge,
  Burger,
  Divider,
  Group,
  Menu,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconChevronDown,
  IconLogout,
  IconUserCircle,
} from '@tabler/icons-react';
import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import {
  filterNavByRole,
  groupNavItems,
  NAV_GROUP_LABELS,
  ROLE_LABELS,
  type NavItem,
} from '@/lib/nav';
import { useTasksRealtime } from '@/features/tasks/hooks/useTasksRealtime';
import { ColorSchemeToggle } from './ColorSchemeToggle';
import { NotificationsBell } from './NotificationsBell';

function isItemActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.to;
  if (item.to === '/') return pathname === '/';
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '').concat(parts[1]?.[0] ?? '').toUpperCase() || '?';
}

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure(false);
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Global live-refresh: whenever any task row changes (admin assigns a task,
  // someone moves it through statuses, cron overdue-check, etc.) we invalidate
  // the caches that back task lists and dashboard widgets. The page that is
  // currently mounted re-fetches in the background; pages that are not
  // mounted stay stale-marked and refetch on next visit.
  const invalidateAllTaskViews = () => {
    void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    void queryClient.invalidateQueries({ queryKey: ['task'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };
  useTasksRealtime({ enabled: !!profile, onChange: invalidateAllTaskViews });

  // Safety-net polling: if the Realtime websocket is dropped (sleep, flaky
  // network, proxy idle-kill, etc.) we still refresh task caches every 10s.
  // `invalidateQueries` only triggers a refetch for mounted queries, so the
  // cost is a single SELECT per visible list.
  useEffect(() => {
    if (!profile) return;
    const INTERVAL_MS = 10_000;
    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      invalidateAllTaskViews();
    };
    const handle = setInterval(tick, INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) invalidateAllTaskViews();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(handle);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const navItems = filterNavByRole(role);
  const groups = groupNavItems(navItems);

  const handleSignOut = async () => {
    await signOut();
    await navigate({ to: '/login' });
  };

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{
        width: 260,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              aria-label="Меню"
            />
            <Anchor
              component={Link}
              to="/"
              underline="never"
              c="inherit"
              fw={700}
              size="lg"
            >
              CRM Belarus
            </Anchor>
            <Badge size="xs" variant="light" visibleFrom="sm">
              v0.1.0
            </Badge>
          </Group>

          <Group gap="xs" wrap="nowrap">
            <NotificationsBell />
            <ColorSchemeToggle />

            <Menu position="bottom-end" shadow="md" width={220} withArrow>
              <Menu.Target>
                <UnstyledButton>
                  <Group gap="xs" wrap="nowrap">
                    <Avatar radius="xl" size="sm" color="brand">
                      {initials(profile?.full_name)}
                    </Avatar>
                    <Stack gap={0} visibleFrom="sm">
                      <Text size="sm" fw={600} lh={1.2}>
                        {profile?.full_name ?? 'Без имени'}
                      </Text>
                      <Text size="xs" c="dimmed" lh={1.2}>
                        {role ? ROLE_LABELS[role] : '—'}
                      </Text>
                    </Stack>
                    <IconChevronDown size={14} />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>
                  {profile?.email ?? profile?.login ?? 'Аккаунт'}
                </Menu.Label>
                <Menu.Item
                  leftSection={<IconUserCircle size={16} />}
                  component={Link}
                  to="/settings"
                >
                  Профиль и настройки
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<IconLogout size={16} />}
                  onClick={handleSignOut}
                >
                  Выйти
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <AppShell.Section grow component={ScrollArea}>
          <Stack gap="xs">
            {groups.map(({ group, items }, index) => (
              <Stack key={group} gap={2}>
                {index > 0 && <Divider my={4} />}
                <Text
                  tt="uppercase"
                  fz={10}
                  fw={700}
                  c="dimmed"
                  pl="sm"
                  pt={index === 0 ? 4 : 0}
                >
                  {NAV_GROUP_LABELS[group]}
                </Text>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      component={Link}
                      to={item.to}
                      label={item.label}
                      leftSection={<Icon size={18} />}
                      active={isItemActive(location.pathname, item)}
                      onClick={close}
                      variant="light"
                    />
                  );
                })}
              </Stack>
            ))}
          </Stack>
        </AppShell.Section>

        <AppShell.Section>
          <Divider mb="xs" />
          <Text size="xs" c="dimmed" ta="center">
            Europe/Minsk
          </Text>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
