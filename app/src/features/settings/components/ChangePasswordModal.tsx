import { Button, Group, Modal, PasswordInput, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { supabase } from '@/lib/supabase';

interface Props {
  opened: boolean;
  onClose: () => void;
  userEmail: string;
}

export function ChangePasswordModal({ opened, onClose, userEmail }: Props) {
  const form = useForm({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validate: {
      currentPassword: (v) => (v.length >= 1 ? null : 'Введите текущий пароль'),
      newPassword: (v) =>
        v.length >= 6 ? null : 'Новый пароль: минимум 6 символов',
      confirmPassword: (v, values) =>
        v === values.newPassword ? null : 'Пароли не совпадают',
    },
  });

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Сменить пароль">
      <form
        onSubmit={form.onSubmit(async (values) => {
          const { error: signError } = await supabase.auth.signInWithPassword({
            email: userEmail,
            password: values.currentPassword,
          });
          if (signError) {
            notifications.show({
              title: 'Ошибка',
              message: 'Неверный текущий пароль',
              color: 'red',
            });
            return;
          }
          const { error: updError } = await supabase.auth.updateUser({
            password: values.newPassword,
          });
          if (updError) {
            notifications.show({
              title: 'Ошибка',
              message: updError.message,
              color: 'red',
            });
            return;
          }
          notifications.show({
            title: 'Пароль обновлён',
            message: 'Используйте новый пароль при следующем входе.',
            color: 'green',
          });
          handleClose();
        })}
      >
        <Stack>
          <PasswordInput
            label="Текущий пароль"
            required
            {...form.getInputProps('currentPassword')}
          />
          <PasswordInput
            label="Новый пароль"
            required
            {...form.getInputProps('newPassword')}
          />
          <PasswordInput
            label="Повторите новый пароль"
            required
            {...form.getInputProps('confirmPassword')}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={handleClose}>
              Отмена
            </Button>
            <Button type="submit">Сохранить</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
