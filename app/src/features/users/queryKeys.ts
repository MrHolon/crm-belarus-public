export const usersAdminKeys = {
  all: ['admin', 'users'] as const,
  list: () => [...usersAdminKeys.all, 'list'] as const,
};
