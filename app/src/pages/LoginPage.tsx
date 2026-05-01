import { useEffect, useState } from 'react';
import {
  Alert,
  Anchor,
  Box,
  Button,
  Card,
  Center,
  Divider,
  Group,
  PasswordInput,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle, IconLogin2, IconUserPlus } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { ColorSchemeToggle } from '@/components/ColorSchemeToggle';

type Tab = 'signin' | 'signup';

export function LoginPage() {
  const [tab, setTab] = useState<Tab>('signin');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null);
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.rpc('is_registration_enabled').then(({ data }) => {
      setRegistrationEnabled(data ?? true);
    });
  }, []);

  const signInForm = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Укажите корректный email'),
      password: (v) => (v.length >= 6 ? null : 'Минимум 6 символов'),
    },
  });

  const signUpForm = useForm({
    initialValues: {
      fullName: '',
      login: '',
      email: '',
      password: '',
      passwordConfirm: '',
    },
    validate: {
      fullName: (v) => (v.trim().length >= 2 ? null : 'Укажите имя и фамилию'),
      login: (v) =>
        /^[a-zA-Z0-9_.-]{3,}$/.test(v)
          ? null
          : 'Логин: от 3 символов, латиница/цифры/._-',
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Укажите корректный email'),
      password: (v) => (v.length >= 6 ? null : 'Минимум 6 символов'),
      passwordConfirm: (v, values) =>
        v === values.password ? null : 'Пароли не совпадают',
    },
  });

  const handleSignIn = signInForm.onSubmit(async (values) => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      await auth.signIn(values.email.trim(), values.password);
      await navigate({ to: '/' });
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Не удалось войти',
      );
    } finally {
      setSubmitting(false);
    }
  });

  const handleSignUp = signUpForm.onSubmit(async (values) => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      await auth.signUp({
        email: values.email.trim(),
        password: values.password,
        fullName: values.fullName.trim(),
        login: values.login.trim(),
      });
      await navigate({ to: '/' });
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Не удалось зарегистрироваться',
      );
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Box
      mih="100vh"
      bg="var(--mantine-color-body)"
      style={{ position: 'relative' }}
    >
      <Group justify="flex-end" p="md" style={{ position: 'absolute', right: 0 }}>
        <ColorSchemeToggle />
      </Group>

      <Center mih="100vh" px="md">
        <Stack gap="lg" w="100%" maw={420}>
          <Stack gap={4} align="center">
            <Title order={2}>CRM Belarus</Title>
            <Text c="dimmed" size="sm">
              Вход в систему задач и обращений
            </Text>
          </Stack>

          <Card withBorder radius="md" padding="lg">
            {registrationEnabled === false ? (
              <>
                {submitError && (
                  <Alert
                    icon={<IconAlertCircle size={16} />}
                    color="red"
                    variant="light"
                    mb="sm"
                  >
                    {submitError}
                  </Alert>
                )}
                <form onSubmit={handleSignIn}>
                  <Stack gap="sm">
                    <TextInput
                      label="Email"
                      placeholder="you@company.ru"
                      autoComplete="email"
                      required
                      {...signInForm.getInputProps('email')}
                    />
                    <PasswordInput
                      label="Пароль"
                      autoComplete="current-password"
                      required
                      {...signInForm.getInputProps('password')}
                    />
                    <Button type="submit" loading={submitting} mt="xs">
                      Войти
                    </Button>
                  </Stack>
                </form>
              </>
            ) : (
              <Tabs
                value={tab}
                onChange={(next) => {
                  if (next === 'signin' || next === 'signup') {
                    setTab(next);
                    setSubmitError(null);
                  }
                }}
                variant="pills"
              >
                <Tabs.List grow>
                  <Tabs.Tab value="signin" leftSection={<IconLogin2 size={16} />}>
                    Вход
                  </Tabs.Tab>
                  <Tabs.Tab value="signup" leftSection={<IconUserPlus size={16} />}>
                    Регистрация
                  </Tabs.Tab>
                </Tabs.List>

                <Divider my="md" />

                {submitError && (
                  <Alert
                    icon={<IconAlertCircle size={16} />}
                    color="red"
                    variant="light"
                    mb="sm"
                  >
                    {submitError}
                  </Alert>
                )}

                <Tabs.Panel value="signin">
                  <form onSubmit={handleSignIn}>
                    <Stack gap="sm">
                      <TextInput
                        label="Email"
                        placeholder="you@company.ru"
                        autoComplete="email"
                        required
                        {...signInForm.getInputProps('email')}
                      />
                      <PasswordInput
                        label="Пароль"
                        autoComplete="current-password"
                        required
                        {...signInForm.getInputProps('password')}
                      />
                      <Button type="submit" loading={submitting} mt="xs">
                        Войти
                      </Button>
                      <Text size="xs" c="dimmed" ta="center">
                        Нет учётки?{' '}
                        <Anchor
                          size="xs"
                          component="button"
                          type="button"
                          onClick={() => setTab('signup')}
                        >
                          Зарегистрироваться
                        </Anchor>
                      </Text>
                    </Stack>
                  </form>
                </Tabs.Panel>

                <Tabs.Panel value="signup">
                  <form onSubmit={handleSignUp}>
                    <Stack gap="sm">
                      <TextInput
                        label="Имя и фамилия"
                        placeholder="Иван Иванов"
                        required
                        {...signUpForm.getInputProps('fullName')}
                      />
                      <TextInput
                        label="Логин"
                        placeholder="ivanov"
                        description="Латиница, цифры, . _ -"
                        required
                        {...signUpForm.getInputProps('login')}
                      />
                      <TextInput
                        label="Email"
                        placeholder="you@company.ru"
                        autoComplete="email"
                        required
                        {...signUpForm.getInputProps('email')}
                      />
                      <PasswordInput
                        label="Пароль"
                        autoComplete="new-password"
                        required
                        {...signUpForm.getInputProps('password')}
                      />
                      <PasswordInput
                        label="Повторите пароль"
                        autoComplete="new-password"
                        required
                        {...signUpForm.getInputProps('passwordConfirm')}
                      />
                      <Button type="submit" loading={submitting} mt="xs">
                        Создать аккаунт
                      </Button>
                      <Text size="xs" c="dimmed">
                        По умолчанию роль — <b>специалист</b>. Админ назначит другую
                        роль позже.
                      </Text>
                    </Stack>
                  </form>
                </Tabs.Panel>
              </Tabs>
            )}
          </Card>

          <Text size="xs" c="dimmed" ta="center">
            Europe/Minsk · Supabase self-hosted
          </Text>
        </Stack>
      </Center>
    </Box>
  );
}
