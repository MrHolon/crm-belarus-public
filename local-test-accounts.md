# Учётные записи для локального входа

Реальные пользователи, уже засиженные в БД через **`supabase/seed/local_test_users.sql`**
(идемпотентный скрипт, запускается повторно без дубликатов).
Бекап в `backups/` уже содержит этих пользователей — после `pg_restore` можно сразу логиниться.

**Пароль у всех один:** `LocalCRM_Dev_2026!`

UI: <http://localhost:8080>

| Роль (user_role) | Email (логин)         | Пароль               | Примечание                              |
|------------------|-----------------------|----------------------|-----------------------------------------|
| admin            | admin@crm.local       | LocalCRM_Dev_2026!   | Полный доступ ко всему функционалу      |
| manager          | manager@crm.local     | LocalCRM_Dev_2026!   | Менеджер                                |
| accountant       | accountant@crm.local  | LocalCRM_Dev_2026!   | Бухгалтер                               |
| developer        | developer@crm.local   | LocalCRM_Dev_2026!   | Разработчик                             |
| duty_officer     | duty@crm.local        | LocalCRM_Dev_2026!   | Дежурный                                |
| specialist       | specialist@crm.local  | LocalCRM_Dev_2026!   | Специалист (роль по умолчанию)          |

## Пересоздать пользователей с нуля

Если нужно пересоздать тестовых пользователей (например, после полного `supabase/reset.sh`):

```bash
docker exec -i crm-supabase-db psql -U postgres -d postgres < supabase/seed/local_test_users.sql
```

## Сменить пароль любого пользователя

Через SQL в контейнере БД (подставьте свой email и пароль):

```bash
docker exec -i crm-supabase-db psql -U postgres -d postgres -c "update auth.users set encrypted_password = crypt('NEW_PASSWORD_HERE', gen_salt('bf', 10)), updated_at = now() where email = 'admin@crm.local';"
```

## Сменить роль пользователя

В Supabase Studio (<http://localhost:8000> → SQL Editor) или через `psql`:

```sql
update public.users
set role = 'admin'::public.user_role
where email = 'admin@crm.local';
```

---

**Внимание:** эти учётки — только для локальной разработки. Никогда не используйте этот пароль нигде в реальной среде.
