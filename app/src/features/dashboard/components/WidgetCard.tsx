import type { ReactNode } from 'react';
import { Card, Group, Stack, Text, ThemeIcon } from '@mantine/core';

interface Props {
  title: string;
  icon: ReactNode;
  color: string;
  /** Правый верхний уголок — обычно ссылка «Все». */
  action?: ReactNode;
  /** Содержимое виджета (строки задач / список категорий / пустое состояние). */
  children: ReactNode;
}

export function WidgetCard({ title, icon, color, action, children }: Props) {
  return (
    <Card withBorder radius="md" padding="md" h="100%">
      <Stack gap="xs" h="100%">
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <ThemeIcon size="md" variant="light" color={color} radius="md">
              {icon}
            </ThemeIcon>
            <Text fw={600}>{title}</Text>
          </Group>
          {action}
        </Group>
        {children}
      </Stack>
    </Card>
  );
}

export function WidgetEmpty({ text }: { text: string }) {
  return (
    <Text size="sm" c="dimmed">
      {text}
    </Text>
  );
}

export function WidgetError({ text }: { text: string }) {
  return (
    <Text size="sm" c="red">
      {text}
    </Text>
  );
}

export function WidgetSkeletonText() {
  return (
    <Text size="sm" c="dimmed">
      Загрузка…
    </Text>
  );
}
