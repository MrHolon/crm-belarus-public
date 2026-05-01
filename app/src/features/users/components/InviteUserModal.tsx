import { Button, CopyButton, Modal, Stack, Text } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

interface Props {
  opened: boolean;
  onClose: () => void;
}

export function InviteUserModal({ opened, onClose }: Props) {
  const registrationUrl = `${window.location.origin}/login`;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Добавить сотрудника"
      size="md"
    >
      <Stack gap="sm">
        <Text size="sm">
          Новый пользователь регистрируется сам на странице входа (вкладка
          «Регистрация»). После этого вы увидите его в таблице и сможете
          назначить роль.
        </Text>
        <Text size="sm" c="dimmed">
          Прямое создание учётной записи из интерфейса без сервера с Admin API
          недоступно — используется самостоятельная регистрация.
        </Text>
        <CopyButton value={registrationUrl} timeout={2000}>
          {({ copied, copy }) => (
            <Button
              color={copied ? 'teal' : undefined}
              leftSection={
                copied ? <IconCheck size={16} /> : undefined
              }
              onClick={copy}
              variant="light"
            >
              {copied ? 'Ссылка скопирована' : 'Скопировать ссылку на вход'}
            </Button>
          )}
        </CopyButton>
        <Text size="xs" ff="monospace" c="dimmed">
          {registrationUrl}
        </Text>
      </Stack>
    </Modal>
  );
}
