-- Локальные тестовые пользователи (email + пароль для входа через GoTrue).
-- Пароль для всех: LocalCRM_Dev_2026!
-- Идемпотентно: не вставляет повторно, если email уже есть в auth.users.
-- Выполнить в SQL Editor (роль postgres / service) или: psql -f supabase/seed/local_test_users.sql
--
-- Не использовать в production.

begin;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  is_sso_user,
  is_anonymous
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  v.email,
  crypt('LocalCRM_Dev_2026!', gen_salt('bf', 10)),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  v.user_meta,
  now(),
  now(),
  '',
  '',
  '',
  '',
  false,
  false
from (
  values
    ('specialist@crm.local', jsonb_build_object('role', 'specialist', 'full_name', 'Тест Специалист', 'login', 'specialist')),
    ('duty@crm.local', jsonb_build_object('role', 'duty_officer', 'full_name', 'Тест Дежурный', 'login', 'duty')),
    ('developer@crm.local', jsonb_build_object('role', 'developer', 'full_name', 'Тест Разработчик', 'login', 'developer')),
    ('accountant@crm.local', jsonb_build_object('role', 'accountant', 'full_name', 'Тест Бухгалтер', 'login', 'accountant')),
    ('manager@crm.local', jsonb_build_object('role', 'manager', 'full_name', 'Тест Менеджер', 'login', 'manager')),
    ('admin@crm.local', jsonb_build_object('role', 'admin', 'full_name', 'Тест Админ', 'login', 'admin'))
) as v(email, user_meta)
where not exists (
  select 1 from auth.users u where lower(u.email) = lower(v.email)
);

commit;
