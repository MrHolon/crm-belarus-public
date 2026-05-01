import {
  IconBook2,
  IconBookmarks,
  IconChartBar,
  IconHelpCircle,
  IconHome,
  IconInbox,
  IconListCheck,
  IconPlus,
  IconSettings,
  IconTemplate,
  IconUsers,
  IconWebhook,
  type Icon,
} from '@tabler/icons-react';
import type { UserRole } from './auth-context';

export type NavGroup = 'main' | 'manage' | 'admin';

export interface NavItem {
  to: string;
  label: string;
  icon: Icon;
  group: NavGroup;
  /** If omitted, the item is visible to every authenticated role. */
  roles?: UserRole[];
  /** Mark the item as active for nested paths as well (prefix match). */
  exact?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Дашборд', icon: IconHome, group: 'main', exact: true },
  { to: '/tasks', label: 'Мои задачи', icon: IconListCheck, group: 'main' },
  { to: '/tasks/new', label: 'Новая задача', icon: IconPlus, group: 'main', exact: true },
  {
    to: '/all-tasks',
    label: 'Все задачи',
    icon: IconInbox,
    group: 'main',
    roles: ['duty_officer', 'manager', 'admin', 'accountant', 'developer'],
  },
  {
    to: '/help-room',
    label: 'Нужна помощь',
    icon: IconHelpCircle,
    group: 'main',
    roles: ['specialist', 'duty_officer', 'developer', 'manager', 'admin'],
  },
  { to: '/templates', label: 'Шаблоны', icon: IconTemplate, group: 'main' },
  { to: '/knowledge-base', label: 'База знаний', icon: IconBook2, group: 'main' },

  {
    to: '/references',
    label: 'Справочники',
    icon: IconBookmarks,
    group: 'manage',
  },
  {
    to: '/analytics',
    label: 'Аналитика',
    icon: IconChartBar,
    group: 'manage',
    roles: ['manager', 'admin'],
  },

  {
    to: '/users',
    label: 'Пользователи',
    icon: IconUsers,
    group: 'admin',
    roles: ['admin'],
  },
  {
    to: '/webhooks',
    label: 'Webhook-и',
    icon: IconWebhook,
    group: 'admin',
    roles: ['admin'],
  },

  { to: '/settings', label: 'Настройки', icon: IconSettings, group: 'main' },
];

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  main: 'Работа',
  manage: 'Управление',
  admin: 'Администрирование',
};

export function filterNavByRole(role: UserRole | null | undefined): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}

export function groupNavItems(
  items: NavItem[],
): Array<{ group: NavGroup; items: NavItem[] }> {
  const order: NavGroup[] = ['main', 'manage', 'admin'];
  return order
    .map((group) => ({ group, items: items.filter((i) => i.group === group) }))
    .filter((g) => g.items.length > 0);
}

export const ROLE_LABELS: Record<UserRole, string> = {
  specialist: 'Специалист',
  duty_officer: 'Дежурный',
  developer: 'Разработчик',
  accountant: 'Бухгалтер',
  manager: 'Руководитель',
  admin: 'Администратор',
};
