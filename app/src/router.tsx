import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { supabase } from '@/lib/supabase';
import { isStaffRole } from '@/lib/auth-context';
import { AppLayout } from '@/components/AppLayout';
import { StubPage } from '@/components/StubPage';
import { ReferencesPage } from '@/features/references';
import { SettingsPage } from '@/features/settings';
import { NewTaskPage } from '@/features/tasks';
import { HelpRoomPage } from '@/features/tasks/HelpRoomPage';
import { TaskDetailPage } from '@/features/tasks/TaskDetailPage';
import { TasksListPage } from '@/features/tasks/TasksListPage';
import { TemplatesPage } from '@/features/tasks/TemplatesPage';
import { UsersPage } from '@/features/users';
import { AnalyticsPage } from '@/features/analytics';
import { DashboardPage } from '@/pages/DashboardPage';
import { LoginPage } from '@/pages/LoginPage';

async function hasSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

// -----------------------------------------------------------------------------
// Public routes
// -----------------------------------------------------------------------------

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: async () => {
    if (await hasSession()) {
      throw redirect({ to: '/' });
    }
  },
  component: LoginPage,
});

// -----------------------------------------------------------------------------
// Protected layout (session required) — renders the AppShell with navbar
// -----------------------------------------------------------------------------

const protectedLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_protected',
  beforeLoad: async () => {
    if (!(await hasSession())) {
      throw redirect({ to: '/login' });
    }
  },
  component: AppLayout,
});

const dashboardRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/',
  component: DashboardPage,
});

const tasksRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/tasks',
  component: () => <TasksListPage variant="my" />,
});

const taskNewRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/tasks/new',
  component: NewTaskPage,
});

const taskDetailRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/tasks/$taskId',
  beforeLoad: ({ params }) => {
    if (params.taskId === 'new') {
      throw redirect({ to: '/tasks/new' });
    }
  },
  component: TaskDetailPage,
});

const allTasksRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/all-tasks',
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: '/login' });
    }
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();
    if (!isStaffRole(profile?.role)) {
      throw redirect({ to: '/tasks' });
    }
  },
  component: () => <TasksListPage variant="all" />,
});

const helpRoomRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/help-room',
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: '/login' });
    }
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();
    if (profile?.role === 'accountant') {
      throw redirect({ to: '/tasks' });
    }
  },
  component: HelpRoomPage,
});

const templatesRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/templates',
  component: TemplatesPage,
});

const knowledgeBaseRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/knowledge-base',
  component: () => (
    <StubPage
      title="База знаний"
      description="Статьи по типовым проблемам. В MVP — заглушка, наполнение позже."
    />
  ),
});

const referencesRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/references',
  component: ReferencesPage,
});

const analyticsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/analytics',
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: '/login' });
    }
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();
    if (profile?.role !== 'manager' && profile?.role !== 'admin') {
      throw redirect({ to: '/' });
    }
  },
  component: AnalyticsPage,
});

const usersRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/users',
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: '/login' });
    }
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();
    if (profile?.role !== 'admin') {
      throw redirect({ to: '/' });
    }
  },
  component: UsersPage,
});

const webhooksRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/webhooks',
  component: () => (
    <StubPage
      title="Webhook-и"
      description="Очередь исходящих webhook-событий (n8n будет подключён позже)."
    />
  ),
});

const settingsRoute = createRoute({
  getParentRoute: () => protectedLayoutRoute,
  path: '/settings',
  component: SettingsPage,
});

// -----------------------------------------------------------------------------
// Route tree
// -----------------------------------------------------------------------------

const routeTree = rootRoute.addChildren([
  loginRoute,
  protectedLayoutRoute.addChildren([
    dashboardRoute,
    tasksRoute,
    taskNewRoute,
    taskDetailRoute,
    allTasksRoute,
    helpRoomRoute,
    templatesRoute,
    knowledgeBaseRoute,
    referencesRoute,
    analyticsRoute,
    usersRoute,
    webhooksRoute,
    settingsRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
