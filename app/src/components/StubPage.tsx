import { Badge, Card, Container, Stack, Text, Title } from '@mantine/core';
import { IconTools } from '@tabler/icons-react';
import type { ReactNode } from 'react';

interface StubPageProps {
  title: string;
  description?: ReactNode;
  phase?: string;
}

export function StubPage({
  title,
  description,
  phase = 'В разработке',
}: StubPageProps) {
  return (
    <Container size="md" py="xl">
      <Stack gap="md">
        <Stack gap={4}>
          <Badge
            variant="light"
            color="yellow"
            leftSection={<IconTools size={12} />}
            w="fit-content"
          >
            {phase}
          </Badge>
          <Title order={2}>{title}</Title>
        </Stack>

        <Card withBorder radius="md" padding="lg">
          <Text c="dimmed" size="sm">
            {description ??
              'Этот раздел будет реализован в следующих итерациях MVP. Следите за обновлениями.'}
          </Text>
        </Card>
      </Stack>
    </Container>
  );
}
