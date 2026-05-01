import { Alert, Stack, Tabs, Text, Title } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useAuth } from '@/lib/auth-context';
import { canManageReferences } from './lib/canManageReferences';
import { CategoriesTab } from './components/CategoriesTab';
import { PrioritiesTab } from './components/PrioritiesTab';
import { StatusesTab } from './components/StatusesTab';
import { TagsTab } from './components/TagsTab';
import { TaskTypesTab } from './components/TaskTypesTab';

export function ReferencesPage() {
  const { role } = useAuth();
  const manage = canManageReferences(role);

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Справочники</Title>
        <Text c="dimmed" size="sm" mt={4}>
          Категории проблем, типы и приоритеты задач, статусы и теги. Просмотр
          доступен всем авторизованным пользователям; изменение —{' '}
          {manage
            ? 'вам разрешено.'
            : 'только руководителю и администратору.'}
        </Text>
      </div>

      {!manage && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="gray"
          title="Только просмотр"
        >
          Для редактирования справочников нужна роль «Руководитель» или
          «Администратор».
        </Alert>
      )}

      <Tabs defaultValue="categories" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="categories">Категории</Tabs.Tab>
          <Tabs.Tab value="types">Типы</Tabs.Tab>
          <Tabs.Tab value="priorities">Приоритеты</Tabs.Tab>
          <Tabs.Tab value="statuses">Статусы</Tabs.Tab>
          <Tabs.Tab value="tags">Теги</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="categories" pt="md">
          <CategoriesTab role={role} />
        </Tabs.Panel>
        <Tabs.Panel value="types" pt="md">
          <TaskTypesTab role={role} />
        </Tabs.Panel>
        <Tabs.Panel value="priorities" pt="md">
          <PrioritiesTab role={role} />
        </Tabs.Panel>
        <Tabs.Panel value="statuses" pt="md">
          <StatusesTab role={role} />
        </Tabs.Panel>
        <Tabs.Panel value="tags" pt="md">
          <TagsTab role={role} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
