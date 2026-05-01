export const referenceKeys = {
  all: ['references'] as const,
  categories: () => [...referenceKeys.all, 'categories'] as const,
  taskTypes: () => [...referenceKeys.all, 'task_types'] as const,
  priorities: () => [...referenceKeys.all, 'priorities'] as const,
  statuses: () => [...referenceKeys.all, 'statuses'] as const,
  tags: () => [...referenceKeys.all, 'tags'] as const,
};
