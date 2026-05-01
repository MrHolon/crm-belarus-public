export type TestRole =
  | 'specialist'
  | 'duty_officer'
  | 'developer'
  | 'accountant'
  | 'manager'
  | 'admin';

export interface TestUser {
  role: TestRole;
  login: string;
  email: string;
  roleLabel: string;
  /** Navbar items each role MUST see (by label). */
  expectedNavItems: string[];
  /** Navbar items each role MUST NOT see. */
  forbiddenNavItems: string[];
}

export const TEST_USERS: Record<TestRole, TestUser> = {
  specialist: {
    role: 'specialist',
    login: 'specialist',
    email: 'specialist@crm.local',
    roleLabel: 'Специалист',
    expectedNavItems: [
      'Дашборд',
      'Мои задачи',
      'Новая задача',
      'Нужна помощь',
      'Шаблоны',
      'База знаний',
      'Справочники',
      'Настройки',
    ],
    forbiddenNavItems: ['Все задачи', 'Пользователи', 'Webhook-и', 'Аналитика'],
  },
  duty_officer: {
    role: 'duty_officer',
    login: 'duty',
    email: 'duty@crm.local',
    roleLabel: 'Дежурный',
    expectedNavItems: [
      'Дашборд',
      'Мои задачи',
      'Все задачи',
      'Нужна помощь',
      'Справочники',
    ],
    forbiddenNavItems: ['Пользователи', 'Webhook-и', 'Аналитика'],
  },
  developer: {
    role: 'developer',
    login: 'developer',
    email: 'developer@crm.local',
    roleLabel: 'Разработчик',
    expectedNavItems: [
      'Дашборд',
      'Мои задачи',
      'Все задачи',
      'Нужна помощь',
      'Справочники',
    ],
    forbiddenNavItems: ['Пользователи', 'Webhook-и', 'Аналитика'],
  },
  accountant: {
    role: 'accountant',
    login: 'accountant',
    email: 'accountant@crm.local',
    roleLabel: 'Бухгалтер',
    expectedNavItems: [
      'Дашборд',
      'Мои задачи',
      'Все задачи',
      'Справочники',
    ],
    forbiddenNavItems: [
      'Нужна помощь',
      'Пользователи',
      'Webhook-и',
      'Аналитика',
    ],
  },
  manager: {
    role: 'manager',
    login: 'manager',
    email: 'manager@crm.local',
    roleLabel: 'Руководитель',
    expectedNavItems: [
      'Дашборд',
      'Мои задачи',
      'Все задачи',
      'Нужна помощь',
      'Справочники',
      'Аналитика',
    ],
    forbiddenNavItems: ['Пользователи', 'Webhook-и'],
  },
  admin: {
    role: 'admin',
    login: 'admin',
    email: 'admin@crm.local',
    roleLabel: 'Администратор',
    expectedNavItems: [
      'Дашборд',
      'Мои задачи',
      'Все задачи',
      'Нужна помощь',
      'Справочники',
      'Аналитика',
      'Пользователи',
      'Webhook-и',
    ],
    forbiddenNavItems: [],
  },
};

export const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'LocalCRM_Dev_2026!';
