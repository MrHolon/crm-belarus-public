# Учётные записи для локального входа (шаблон)

Скопируйте этот файл в **`local-test-accounts.md`** и подставьте свои email и пароли.  
Файл **`local-test-accounts.md`** в `.gitignore` — не коммитьте его.

Готовый набор для локалки (все с одним паролем) можно вставить скриптом **`supabase/seed/local_test_users.sql`** (посмотрите пароль внутри файла). Иначе создайте пользователей в **Supabase Studio → Authentication → Users** или через регистрацию в приложении. Роль при регистрации по умолчанию — `specialist`; для других ролей задайте `raw_user_meta_data.role` при создании пользователя или обновите `public.users.role` в SQL.

| Роль (user_role) | Email (логин) | Пароль | Примечание |
|------------------|---------------|--------|------------|
| specialist | specialist@example.local | | |
| duty_officer | duty@example.local | | |
| developer | developer@example.local | | |
| accountant | accountant@example.local | | |
| manager | manager@example.local | | |
| admin | admin@example.local | | |

Пример смены роли после создания пользователя (выполнить в SQL Editor под сервисной ролью / postgres):

```sql
update public.users
set role = 'admin'::public.user_role
where email = 'admin@example.local';
```
