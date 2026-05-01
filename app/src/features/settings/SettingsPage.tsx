import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Divider,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
  useMantineColorScheme,
  type MantineColorScheme,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Database } from '@/types/database';
import { updateMyProfile } from './api/profile';
import { ChangePasswordModal } from './components/ChangePasswordModal';

type UserTaskView = Database['public']['Enums']['user_task_view'];

const TIMEZONES = [
  { value: 'Europe/Minsk', label: 'Минск (Europe/Minsk)' },
  { value: 'Europe/Moscow', label: 'Москва (Europe/Moscow)' },
  { value: 'Europe/Kaliningrad', label: 'Калининград (Europe/Kaliningrad)' },
  { value: 'UTC', label: 'UTC' },
] as const;

const APP_SETTINGS_KEY = ['app_settings'] as const;

function useAppSettings() {
  return useQuery({
    queryKey: APP_SETTINGS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });
}

export function SettingsPage() {
  const { user, profile, profileError, isProfileLoading, refreshProfile } =
    useAuth();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const [pwdOpen, setPwdOpen] = useState(false);
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === 'admin';
  const appSettings = useAppSettings();

  const toggleRegistration = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('app_settings')
        .update({ registration_enabled: enabled })
        .eq('id', true);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APP_SETTINGS_KEY });
      notifications.show({
        title: 'Сохранено',
        message: 'Настройка регистрации обновлена',
        color: 'green',
      });
    },
    onError: (e: Error) => {
      notifications.show({
        title: 'Ошибка',
        message: e.message || 'Не удалось обновить настройку',
        color: 'red',
      });
    },
  });

  const form = useForm({
    initialValues: {
      full_name: '',
      email: '',
      phone: '',
      timezone: 'Europe/Minsk',
      preferred_view: 'kanban' as UserTaskView,
      telegram_chat_id: '',
    },
    validate: {
      full_name: (v) => (v.trim().length >= 2 ? null : 'Минимум 2 символа'),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v.trim()) ? null : 'Некорректный email'),
    },
  });

  useEffect(() => {
    if (!profile) return;
    form.setValues({
      full_name: profile.full_name,
      email: profile.email ?? user?.email ?? '',
      phone: profile.phone ?? '',
      timezone: profile.timezone || 'Europe/Minsk',
      preferred_view: profile.preferred_view,
      telegram_chat_id: profile.telegram_chat_id ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from server when these fields change
  }, [
    profile?.id,
    profile?.full_name,
    profile?.email,
    profile?.phone,
    profile?.timezone,
    profile?.preferred_view,
    profile?.telegram_chat_id,
    user?.email,
  ]);

  const timezoneSelectData = useMemo(() => {
    const tz = profile?.timezone;
    const rows = [...TIMEZONES];
    if (tz && !rows.some((r) => r.value === tz)) {
      return [{ value: tz, label: tz }, ...rows];
    }
    return rows;
  }, [profile?.timezone]);

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form.values) => {
      if (!user?.id) throw new Error('Нет пользователя');
      const emailTrim = values.email.trim();
      const prevEmail = (profile?.email ?? user?.email ?? '').trim();
      if (emailTrim !== prevEmail) {
        const { error } = await supabase.auth.updateUser({ email: emailTrim });
        if (error) throw error;
      }
      await updateMyProfile(user.id, {
        full_name: values.full_name.trim(),
        phone: values.phone.trim() || null,
        timezone: values.timezone,
        preferred_view: values.preferred_view,
        telegram_chat_id: values.telegram_chat_id.trim() || null,
      });
    },
    onSuccess: async () => {
      await refreshProfile();
      notifications.show({
        title: 'Сохранено',
        message: 'Настройки профиля обновлены',
        color: 'green',
      });
    },
    onError: (e: Error) => {
      notifications.show({
        title: 'Ошибка',
        message: e.message || 'Не удалось сохранить',
        color: 'red',
      });
    },
  });

  if (isProfileLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader />
      </Stack>
    );
  }

  if (profileError || !profile) {
    return (
      <Alert color="red" title="Профиль недоступен">
        {profileError?.message ?? 'Не удалось загрузить данные пользователя.'}
      </Alert>
    );
  }

  const authEmail = user?.email ?? profile.email ?? '';

  return (
    <Stack gap="lg" maw={640}>
      <div>
        <Title order={2}>Профиль и настройки</Title>
        <Text c="dimmed" size="sm" mt={4}>
          Контакты, представление задач, тема оформления и пароль.
        </Text>
      </div>

      <Paper withBorder p="md" radius="md">
        <form onSubmit={form.onSubmit((v) => saveMutation.mutate(v))}>
          <Stack gap="md">
            <Title order={4}>Профиль</Title>
            <TextInput
              label="ФИО"
              required
              {...form.getInputProps('full_name')}
            />
            <TextInput
              label="Логин"
              value={profile.login}
              disabled
              description="Используется в @упоминаниях; смена по запросу к администратору"
            />
            <TextInput
              label="Email"
              required
              type="email"
              {...form.getInputProps('email')}
            />
            <TextInput label="Телефон" {...form.getInputProps('phone')} />
            <Select
              label="Часовой пояс"
              data={timezoneSelectData}
              searchable
              {...form.getInputProps('timezone')}
            />
            <TextInput
              label="Telegram chat_id"
              description="Для будущих уведомлений через бота: начните диалог с ботом и вставьте числовой id сюда"
              {...form.getInputProps('telegram_chat_id')}
            />

            <Divider />

            <Title order={5}>Задачи по умолчанию</Title>
            <Text size="sm" c="dimmed">
              Какой вид использовать на списке задач (переключатель на экране
              задач появится в следующей версии).
            </Text>
            <SegmentedControl
              fullWidth
              data={[
                { label: 'Список', value: 'list' },
                { label: 'Канбан', value: 'kanban' },
              ]}
              {...form.getInputProps('preferred_view')}
            />

            <Group justify="flex-end">
              <Button type="submit" loading={saveMutation.isPending}>
                Сохранить
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Title order={4}>Оформление</Title>
          <Text size="sm" c="dimmed">
            Совпадает с переключателем темы в шапке; хранится в браузере.
          </Text>
          <SegmentedControl
            fullWidth
            data={[
              { label: 'Светлая', value: 'light' },
              { label: 'Тёмная', value: 'dark' },
              { label: 'Как в системе', value: 'auto' },
            ]}
            value={colorScheme}
            onChange={(v) => setColorScheme(v as MantineColorScheme)}
          />
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Title order={4}>Безопасность</Title>
          <Button
            variant="light"
            onClick={() => setPwdOpen(true)}
            disabled={!authEmail}
          >
            Сменить пароль
          </Button>
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Title order={4}>Уведомления</Title>
          <Alert color="gray" title="In-app уведомления">
            Каналы e-mail и Telegram будут настраиваться позже. Сейчас
            используются только уведомления внутри приложения (колокольчик).
          </Alert>
        </Stack>
      </Paper>

      {isAdmin && (
        <Paper withBorder p="md" radius="md">
          <Stack gap="sm">
            <Title order={4}>Администрирование</Title>
            <Group justify="space-between" align="center">
              <div>
                <Text size="sm" fw={500}>
                  Регистрация новых пользователей
                </Text>
                <Text size="xs" c="dimmed">
                  Если выключено, форма регистрации скрыта, а попытка
                  зарегистрироваться через API будет заблокирована на уровне БД.
                </Text>
              </div>
              <Switch
                checked={appSettings.data?.registration_enabled ?? true}
                onChange={(e) =>
                  toggleRegistration.mutate(e.currentTarget.checked)
                }
                disabled={
                  appSettings.isPending || toggleRegistration.isPending
                }
                size="md"
              />
            </Group>
          </Stack>
        </Paper>
      )}

      <ChangePasswordModal
        opened={pwdOpen}
        onClose={() => setPwdOpen(false)}
        userEmail={authEmail}
      />
    </Stack>
  );
}
