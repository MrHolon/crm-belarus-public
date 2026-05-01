# PLAN.md — Implementation plan for AI agents

Этот файл — **дорожная карта для ИИ-агентов** (и для меня в новых сессиях).
Здесь описано, что уже сделано, и что осталось до готового MVP, с привязкой
к файлам `ТЗ/`, миграциям и скиллам из `skills/`. Работаем сверху вниз.

> Правила взаимодействия с этим документом:
>
> 1. Перед началом новой задачи — открыть этот файл, найти нужный пункт
>    по его ID (`A1`, `B3`, …), пройти его целиком, отметить как выполненный
>    (заменить `[ ]` → `[x]` в том же коммите, где идёт фича).
> 2. **Источник правды — папка `ТЗ/`.** Этот план — лишь декомпозиция,
>    он не заменяет спецификацию. Если план и `ТЗ/` расходятся — спросить пользователя.
> 3. Порядок фаз (A → H) важен: каждая фаза опирается на предыдущие.
>    Внутри фазы задачи обычно можно делать параллельно.
> 4. Каждая задача проходит [`skills/10-new-feature-checklist.md`](./skills/10-new-feature-checklist.md).
> 5. **Обязательные шаги** после любой задачи (повторяются в каждом пункте):
>    - миграция в `supabase/migrations/` + применить через MCP `apply_migration`;
>    - regenerate `app/src/types/database.ts` через MCP `generate_typescript_types`;
>    - `npm run typecheck`, `npm run lint`, `npm run test` — зелёные;
>    - `get_advisors` (security + performance) — без новых WARN;
>    - обновить `ТЗ/` если поведение отличается от описанного;
>    - git commit (conventional commits, см. `skills/12-git-workflow.md`).

---

## 0. Текущий статус (что уже готово)

### Инфраструктура
- [x] `docker-compose.yml` (root) + `supabase/docker-compose.yml` (project: `supabase-crm`).
- [x] Все сервисы Supabase подняты локально, Kong открыт для MCP.
- [x] Supabase MCP подключён в Cursor (`.cursor/mcp.json`), агент-скиллы установлены в `.agents/skills/`.
- [x] Git репозиторий, `.gitignore`, `.gitattributes`, conventional commits.
- [x] Vite + React 19 + TS + Mantine v7 scaffolding, темы светлая/тёмная/auto с persist.

### База данных
- [x] Схема (миграция `20260418000000_init.sql`): enums, таблицы, функции,
      триггеры `set_updated_at`, `log_task_changes`, `dispatch_webhooks`,
      view `v_tasks` (с `is_overdue`), сиды справочников.
- [x] RLS (миграция `20260418000100_rls.sql`).
- [x] Harden `search_path` (миграция `20260418000150_harden_function_search_path.sql`).
- [x] Индексы FK + `InitPlan`-оптимизация + консолидация permissive policies
      (миграции `20260418000200_perf_optimize_rls.sql`, `20260418000300_fix_task_history_policies.sql`).
- [x] Триггеры sync с `auth.users` (миграция `20260418001000_auth_sync.sql`).
- [x] `supabase_realtime` publication для `notifications`, `tasks`, `task_comments`, `task_history` (миграция `20260418002000_realtime_publication.sql`).
- [x] `app/src/types/database.ts` сгенерирован из актуальной схемы.

### Приложение
- [x] Типизированный `supabase` клиент (`app/src/lib/supabase.ts`).
- [x] `AuthProvider` + хуки (`app/src/lib/auth.tsx`, `app/src/lib/auth-context.ts`).
- [x] Страница `/login` с табами «Вход / Регистрация» (Mantine form).
- [x] `AppLayout` (Mantine AppShell) с role-aware навбаром, переключателем темы, меню пользователя.
- [x] `NotificationsBell` с подпиской на Realtime и mark-as-read.
- [x] TanStack Router: публичный `/login` + `_protected` с session-guard, `DashboardPage` + списки задач `/tasks`, `/all-tasks`, карточка `/tasks/$id`, заглушки остальных разделов.
- [x] Раздел `/references` — вкладки справочников (категории, типы, приоритеты, статусы, теги), см. A1.
- [x] Раздел `/users` — список пользователей для админа (роль, активность, приглашение), см. A2.
- [x] Раздел `/settings` — профиль, тема, смена пароля, `preferred_view`, заготовка `notification_prefs`, см. A3.
- [x] Раздел `/tasks/new` — форма создания задачи (B1).
- [x] Карточка задачи `/tasks/$id` — просмотр, метаданные, вкладки, переходы по статусам (B3).
- [x] Комментарии — @mentions, Realtime по `task_comments`, уведомления в БД (B5).
- [x] История изменений задачи с расшифровкой полей и имён (B6).
- [x] Дашборд — виджеты «В работе у меня», «Просроченные», «Нужна помощь», «Критические категории» по ролям (H3).
- [x] Вкладка «Вложения» в карточке — кнопка «Добавить» с toast «Скоро будет доступно» (H1).

---

## A. Справочники и администрирование (foundation)

> Цель: прежде чем пилить задачи, нужен полноценный каркас справочников и
> управление пользователями. Задача без категории / приоритета / типа
> создана быть не может, поэтому `A1` — блокер для `B1`.

### A1 — Справочники (категории, типы, приоритеты, статусы, теги)
Привязка: [`ТЗ/03-сущности-и-база-данных.md`](./ТЗ/03-сущности-и-база-данных.md) §3.2–3.5, [`ТЗ/04-бизнес-процессы.md`](./ТЗ/04-бизнес-процессы.md) §4.5.
Доступно: все роли читают, пишут `manager` / `admin`.

- [x] Роут `/references` (уже stub) заменить на вкладки: **Категории**, **Типы**, **Приоритеты**, **Статусы**, **Теги**.
- [x] `features/references/api/` — thin-функции: `listCategories`, `upsertCategory`, `toggleCategoryActive`, то же для остальных справочников.
- [x] Модалки Mantine для create/edit. Поля категории: `name`, `description`, `severity`, `default_priority_id`, `is_active`.
- [x] Soft-delete через `is_active = false` (без физического удаления — сохранение истории в задачах).
- [x] Теги: отдельная вкладка, редактирование цвета (`color` column, добавить если нет).
- [x] RLS: read — все authenticated; write — `manager` / `admin` (уже так, проверить).
- [x] Миграция, если добавляется цвет тегов или дополнительные поля.

### A2 — Управление пользователями (admin)
Привязка: [`ТЗ/02-роли-и-права-доступа.md`](./ТЗ/02-роли-и-права-доступа.md) §2.4, §2.7.

- [x] Роут `/users` заменить stub на список пользователей (Mantine DataTable / Table).
- [x] Колонки: ФИО, логин, email, телефон, роль, активен, создан, последний вход.
- [x] Действия: изменить роль, активировать/деактивировать, пригласить нового
      (Supabase Admin API или ручной signup + роль через UPDATE).
- [x] «Деактивация» = `is_active = false`, исключается из всех списков исполнителей,
      но существующие задачи сохраняются (см. ТЗ 2.4).
- [x] RLS: admin — полный доступ; staff — read; другие — read self only.
- [x] Показывать «входит в систему» (`last_seen_at`) — добавить колонку + триггер
      или обновлять из клиента при `onAuthStateChange('SIGNED_IN')`.

### A3 — Профиль пользователя и настройки
Привязка: [`ТЗ/05-интерфейс.md`](./ТЗ/05-интерфейс.md) §5.7, [`ТЗ/07-нефункциональные-требования.md`](./ТЗ/07-нефункциональные-требования.md) §7.3.

- [x] Роут `/settings` — форма редактирования профиля (ФИО, телефон, preferred_view).
- [x] Поле `preferred_view` в `public.users` (`list` | `kanban`) — добавить миграцией.
- [x] Кнопка «Сменить пароль» (Supabase Auth `updateUser`).
- [x] Предпочтения уведомлений (пока только in-app; зарезервировать JSONB `notification_prefs`).

---

## B. Ядро задач

> Сердце системы. Делается строго после A1. Каждая подфича — отдельный коммит
> и отдельная PR-single-concern, если работаем через ветки.

### B1 — Форма создания задачи
Привязка: [`ТЗ/04-бизнес-процессы.md`](./ТЗ/04-бизнес-процессы.md) §4.1, [`ТЗ/05-интерфейс.md`](./ТЗ/05-интерфейс.md) §5.6.

- [x] Роут `/tasks/new` — заменить stub на форму.
- [x] Поля: `title`, `description` (RichText / TextArea), `category_id` (обязательно),
      `task_type_id` (обязательно), `priority_id` (авто-подставляется по `category.severity`, можно менять),
      `assigned_to_user_id` (self по умолчанию), `due_at`, `tags[]`, `complexity`.
- [x] zod-схема в `features/tasks/schemas.ts`.
- [x] При выборе категории — клиент подставляет `default_priority_id` этой категории.
- [x] Автосохранение черновика в `localStorage` (дебаунс 500мс), ключ `draft:task-new`.
- [x] Кнопка «Использовать шаблон» — модалка списка шаблонов (D2).
- [x] Права создания (см. ТЗ 2.3): specialist → self / specialist / developer; duty_officer → любому;
      accountant → duty_officer / specialist; manager/admin → любому; developer → specialist / self.
- [x] Select исполнителей фильтруется по роли на клиенте **и** защищён RLS на сервере.

### B2 — Список задач и фильтры
Привязка: [`ТЗ/05-интерфейс.md`](./ТЗ/05-интерфейс.md) §5.3.

- [x] Роут `/tasks` — «мои задачи» (создатель либо исполнитель либо помощник).
- [x] Роут `/all-tasks` — для staff — все задачи, видимые через RLS; не-staff редирект на `/tasks`.
- [x] Таблица Mantine: номер, заголовок, статус (цветной badge), приоритет, категория, исполнитель, срок, теги, обновлено.
- [x] Фильтры (Drawer): статус, категория, приоритет, теги (multi), исполнитель, срок (range), просроченные.
- [x] Пагинация по страницам (offset + `range`; keyset по `created_at desc, id desc` — при росте объёма / C3).
- [x] Поиск по заголовку/описанию — см. C3 (`TasksListPage`, `search_tsv`).

### B3 — Карточка задачи
Привязка: [`ТЗ/05-интерфейс.md`](./ТЗ/05-интерфейс.md) §5.5.

- [x] Роут `/tasks/$id`.
- [x] Левая колонка: заголовок, статус (переходы), приоритет, категория (severity), теги, описание.
- [x] Правая колонка: создатель, исполнитель, тип, приоритет, сложность, срок, теги, даты; блок помощи и связанные parent/child.
- [x] Вкладки: «Комментарии» (добавление без @), «История» (`task_history`), «Вложения» (stub).
- [x] Кнопки перехода статуса по правилам ТЗ §4.1 (`lib/transitions.ts`); серверная валидация переходов — в B4. «Отклонить» / полный UX отклонения — B7.

### B4 — Смена статуса (переходы)
Привязка: [`ТЗ/04-бизнес-процессы.md`](./ТЗ/04-бизнес-процессы.md) §4.1, §4.2.

- [x] Функция `canTransition(from, to, ctx)` и `allowedNextStatuses` в `features/tasks/lib/transitions.ts` (контекст: роль, исполнитель, создатель, помощник, наличие исполнителя).
- [x] Разрешённые переходы по ТЗ §4.1 (таблица в коде и в миграции).
- [x] Кнопки на карточке задачи через `allowedNextStatuses` (как в B3).
- [x] Миграция `20260418007000_task_status_transition_enforce.sql`: триггер `before update on tasks` → `enforce_task_status_transition()` (сообщения `invalid_status_transition: …`).
- [x] Toast на ошибке обновления: `formatTaskUpdateError` + unit-тесты для `canTransition` / форматтера.

### B5 — Комментарии + @mentions
Привязка: [`ТЗ/04-бизнес-процессы.md`](./ТЗ/04-бизнес-процессы.md) §4.4, [`ТЗ/06-уведомления-и-интеграции.md`](./ТЗ/06-уведомления-и-интеграции.md).

- [x] Лента комментариев (Mantine `Timeline`) + подсветка `@login` в тексте (`CommentBody`).
- [x] Ввод: `@` открывает `Popover` со списком активных пользователей (RLS `users`), выбор вставляет `@login `.
- [x] При отправке — парсинг `@login` → `mentions uuid[]` в `task_comments` (колонка уже в `init.sql`).
- [x] Подписка Realtime `INSERT` на `task_comments` с `filter=task_id` (`TaskCommentsSection`).
- [x] Миграция `20260418008000_task_comment_notifications.sql`: триггер `notify_on_task_comment` → `mention` и `comment_added` (создатель, исполнитель, помощники; без автора; упомянутые не дублируются в `comment_added`).

### B6 — История изменений
Привязка: [`ТЗ/03-сущности-и-база-данных.md`](./ТЗ/03-сущности-и-база-данных.md) (таблица `task_history`).

- [x] Вкладка «История» в карточке задачи (`TaskHistorySection`).
- [x] Расшифровка полей логгера (`status`, `priority`, `assignee_id`, `category_id`, `complexity`, `due_date`) — русские подписи и значения.
- [x] Маппинг исполнителя и категории: батч `users` + `problem_categories` после чтения истории; автор строки — join `users` по `task_history.user_id`.

### B7 — Отклонение задачи
Привязка: [`ТЗ/04-бизнес-процессы.md`](./ТЗ/04-бизнес-процессы.md) §4.2.

- [x] Модалка «Отклонить» с обязательным `reason` (textarea, мин. 10 символов).
- [x] API: `rejectTask` → RPC `reject_task` (`status=new`, `assignee_id=null`, `rejection_reason`, `rejected_at`, `rejected_by_id`).
- [x] У исполнителя задача исчезает (через RLS — не виден без assignment).
- [x] У создателя на карточке — блок **«Отклонена исполнителем»** + причина + кем (`TaskDetailPage` + `fetchTaskDetail`).
- [x] Notification type=`task_rejected` → создателю (миграция `20260418009000_task_reject_rpc.sql`).
- [x] При повторном назначении поля `rejected_*` очищаются (`tasks_clear_rejection_on_reassign`).

### B8 — Запрос помощи и помощники
Привязка: [`ТЗ/04-бизнес-процессы.md`](./ТЗ/04-бизнес-процессы.md) §4.5 (запрос помощи).

- [x] Кнопка «Запросить помощь» в карточке (исполнитель в «В работе») → модалка: комментарий + ≥1 помощник (`TaskDetailPage`).
- [x] RPC `request_task_help` + триггер: при `in_progress` → `needs_help` нужен ≥1 активный `task_helpers` (миграция `20260418010000_b8_help_room_rpc.sql`).
- [x] Помощник присоединяется из `/help-room`: RPC `join_task_as_helper`, RLS на `task_helpers` (self-insert при `needs_help`).
- [x] Раздел `/help-room`: пул `needs_help` для specialist / duty_officer / developer / manager / admin; бухгалтер — без пункта меню и редирект с URL.
- [x] Помощник: RLS `tasks_update` + триггер `enforce_helper_task_updates` (только смена `status`); комментарии как у всех с доступом к задаче.
- [x] Уведомления: `help_requested` выбранным помощникам, `help_added` исполнителю при присоединении из пула.

### B9 — Задача разработчику (parent → child)
Привязка: [`ТЗ/04-бизнес-процессы.md`](./ТЗ/04-бизнес-процессы.md) §4.6.

- [x] Кнопка «Создать задачу разработчику» в карточке (`TaskDetailPage` → `/tasks/new?parent=<id>&dev=1`).
- [x] Переход на `/tasks/new?parent=<id>&dev=1` — тип `developer_task`, префикс `DEV:`, описание из родителя + комментарии, исполнители только `developer`, `parent_task_id`.
- [x] На карточке родителя — блок «Задачи разработчику» и блок прочих дочерних задач.
- [x] Notification type=`developer_task_created` → исполнителю дочерней задачи (миграция `20260418011100_b9_b10_enforce_notify.sql`).

### B10 — Удаление / отмена
Привязка: [`ТЗ/04-бизнес-процессы.md`](./ТЗ/04-бизнес-процессы.md) §4.10.

- [x] В карточке и в списке — «Удалить» / «Отменить» по правилам ТЗ (`taskActions`, `TaskDetailPage`, `TasksListPage`).
- [x] «Отменить» → `cancelled` + обязательная причина (≥5 символов, БД + `cancelTask` / `taskCancelReasonSchema`).
- [x] Физическое удаление — `deleteTask` + существующая RLS `delete`.
- [x] История до отмены пишется триггером; при физическом удалении строка задачи исчезает вместе с историей (ожидаемо).

---

## C. Представления и поиск

### C1 — Канбан-доска
Привязка: [`ТЗ/05-интерфейс.md`](./ТЗ/05-интерфейс.md) §5.4.

- [x] `features/tasks/components/KanbanBoard.tsx` на `@dnd-kit/core` (draggable карточки, droppable колонки).
- [x] Колонки по статусам без «Отменена»; отменённые только через фильтр в списке (`listTasksKanban` + `neq cancelled`, если в фильтре не выбрана «Отменена»).
- [x] Компактная карточка: полоска приоритета, теги, исполнитель, кнопка открытия карточки.
- [x] DnD → `updateTask` + `buildStatusUpdatePatch` / `canTransition` (как B4); «Нужна помощь» и «Отменена» без переноса — подсказки в UI.

### C2 — Переключатель «список / канбан»
- [x] `SegmentedControl` в шапке `TasksListPage` (и «Мои», и «Все» задачи).
- [x] Сохранение в `users.preferred_view` через `updateMyProfile` (`hooks/useTaskListView.ts`).
- [x] Дублирование в `localStorage` (`crm:tasks:preferred_view`).

### C3 — Полнотекстовый поиск
Привязка: [`ТЗ/05-интерфейс.md`](./ТЗ/05-интерфейс.md) §5.3.2.

- [x] Колонка `search_tsv` в `public.tasks` (title + description + номер `TASK-xxxxx`); пересоздание `v_tasks` в миграции `20260418013000_tasks_search_tsv_ticket_number.sql`.
- [x] GIN на `search_tsv` (`tasks_search_idx`).
- [x] `v_tasks` + `textSearch('search_tsv', …, { type: 'websearch', config: 'russian' })` в `applyFilters` (`listTasks.ts`).
- [x] Поле поиска на `TasksListPage`, debounce 300мс (`useDebouncedValue`), поле `search` в `TaskListFilters`.

---

## D. Шаблоны задач

### D1 — Сохранить задачу как шаблон
Привязка: [`ТЗ/04-бизнес-процессы.md`](./ТЗ/04-бизнес-процессы.md) §4.8.

- [x] В карточке задачи — кнопка «Сохранить как шаблон».
- [x] Модалка: имя, описание шаблона, `is_public` (checkbox — manager/admin).
- [x] Snapshot в `task_templates` (title, description, category_id, task_type_id, priority, complexity, теги в `default_tags`).
- [x] RLS уже в миграциях: владелец; публичные — manager/admin.

### D2 — Создать из шаблона
- [x] На форме `/tasks/new` — кнопка «Использовать шаблон» → модалка списка шаблонов (в dev-режиме — только шаблоны с типом «Задача разработчику»).
- [x] Выбор → prefill формы; при наличии черновика в `localStorage` — подтверждение «отбросить черновик».

### D3 — Раздел `/templates`
- [x] Список шаблонов (свои + публичные по RLS).
- [x] Редактирование, удаление (свои или публичные у manager/admin); публикация — checkbox для manager/admin.

---

## E. Уведомления — сделать по-настоящему push

### E1 — Починить Realtime WebSocket
**Статус на сегодня:** publication настроена, подписка на клиенте есть (`NotificationsBell`).

- [ ] Оператор проверяет `supabase/.env`: `JWT_SECRET`, `REALTIME_DB_ENC_KEY` (локальный стенд).
- [ ] При сбоях — логи `crm-supabase-realtime` при вставке в `notifications`.
- [x] `REPLICA IDENTITY FULL` на `public.notifications` — миграция `20260418014000_notifications_realtime_and_task_events.sql` (Realtime + RLS).
- [ ] Smoke-тест вручную: вставка уведомления для пользователя X → колокольчик без F5.

### E2 — Триггеры создания уведомлений
Привязка: [`ТЗ/06-уведомления-и-интеграции.md`](./ТЗ/06-уведомления-и-интеграции.md) §6.2.

- [x] События задач — отдельные функции/триггеры (не одна `create_notifications_for_task_event()`).
- [x] `task_comments` → `comment_added` + `mention` (миграция `20260418008000_task_comment_notifications.sql`).
- [x] `tasks` → `assigned` при создании/смене исполнителя; `status_changed` создателю и исполнителю (кроме `auth.uid()`); тип `developer_task` при INSERT не дублирует `assigned` (есть `developer_task_created`).
- [x] `task_rejected`, помощь, `developer_task_created` — см. миграции B7–B9.
- [x] Исключение актора: комментарии, смена статуса/назначения — через `auth.uid()` / `new.user_id`.

### E3 — Cron: due_soon / overdue
Привязка: [`ТЗ/06-уведомления-и-интеграции.md`](./ТЗ/06-уведомления-и-интеграции.md) §6.3.

- [x] `pg_cron` — миграция `20260418014100_pg_cron_due_overdue.sql` (если расширение недоступно — задания не создаются, см. NOTICE).
- [x] `public.notify_due_soon()` — срок в ближайшие **2 часа** (как в ТЗ §6.4), исполнителю.
- [x] `public.notify_overdue()` — просрочка; получатели: исполнитель, создатель, активные `duty_officer`.
- [x] Расписание: ежечасно (`due_soon` на :00, `overdue` на :05).
- [x] Дедуп: нет повторов того же `type` по задаче за 24ч (проверка в `NOT EXISTS` по `notifications`).

---

## F. Аналитика и экспорт

Привязка: [`ТЗ/08-mvp-и-план-работ.md`](./ТЗ/08-mvp-и-план-работ.md) §8.1.7.
Доступно: `manager`, `admin`.

- [x] F1 — RPC в миграции `20260418015000_analytics_reports.sql`:
      `report_open_by_assignee`, `report_overdue`, `report_avg_resolution`,
      `report_top_categories`, `report_help_stats` (`SECURITY DEFINER`, только manager/admin).
- [x] F2 — страница `/analytics` (`features/analytics/AnalyticsPage.tsx`): вкладки, `BarChart` (`@mantine/charts` + Recharts), таблица под графиком.
- [x] F3 — «Экспорт в CSV» на каждой вкладке (`papaparse`, BOM для Excel).
- [x] Period picker: 7 / 30 / 90 дней и произвольный диапазон (`DatePickerInput` type range).

---

## G. Качество, тесты, документация

### G1 — RLS smoke-tests
- [ ] Папка `supabase/rls-tests/` с `.sql` файлами: для каждой таблицы — positive + negative кейс на роль.
- [ ] Скрипт `scripts/run-rls-tests.sh` (pgTAP или простой `psql` со сравнением).
- [ ] Интегрировать в CI.

### G2 — Unit-тесты (Vitest)
- [x] `features/tasks/lib/transitions.test.ts` — матрица переходов.
- [x] `features/references/lib/defaultPriorityForSeverity.test.ts`.
- [x] Прочие helper-тесты: `formatTaskUpdateError`, `formatTaskHistory`, `parseCommentMentions`, `assigneeRules`.
- [ ] Хуки, которые содержат нетривиальную логику (не «просто useQuery») — по мере появления.

### G3 — E2E (Playwright)
- [ ] Сценарий `specialist`: логин → создать задачу → увидеть её в «Мои задачи» → комментировать → перевести в «На проверке».
- [ ] Сценарий `duty_officer`: назначить задачу specialist → тот отклоняет → видит «Отклонена».
- [ ] Сценарий `developer`: получить задачу от specialist → выполнить.
- [ ] Сценарий `admin`: создать пользователя → дать роль → удалить задачу из БД.

### G4 — Роль-гиды пользователям
- [ ] По одному `.md` файлу на роль в `docs/user-guides/`: «Как работать специалисту», «Дежурному», «Руководителю»…
- [ ] В футере приложения — ссылка на соответствующий гид.

### G5 — Бэкапы
- [ ] Скрипт `scripts/backup.sh` — `pg_dump` в `backups/YYYY-MM-DD.sql.gz`.
- [ ] README: «Как восстановиться» (pg_restore).
- [ ] Cron / Task Scheduler на локальной машине — опционально.

### G6 — Webhook-и (admin)
Привязка: [`ТЗ/06-уведомления-и-интеграции.md`](./ТЗ/06-уведомления-и-интеграции.md) §6.4.

- [ ] Роут `/webhooks` — CRUD `outgoing_webhooks` (url, secret, event_types[], is_active).
- [ ] Страница — список + форма.
- [ ] Проверка доставки: таблица `webhook_deliveries` (new) с логом попыток.
- [ ] Кнопка «Отправить тестовое событие».

---

## H. Заглушки → MVP

### H1 — Вложения (UI-заглушка)
- [x] В карточке задачи — вкладка «Вложения» с кнопкой «+», по клику — toast «Скоро будет доступно».
- [x] Таблица `task_files` уже есть; оставляем без UI загрузки.

### H2 — База знаний (list / detail stub)
- [ ] `/knowledge-base` — список статей (из `kb_articles`, изначально пусто).
- [ ] Карточка статьи — read-only.
- [ ] Создание статей — во 2-й очереди.

### H3 — Dashboard: довести виджеты
Привязка: [`ТЗ/05-интерфейс.md`](./ТЗ/05-интерфейс.md) §5.2.

- [x] Виджет «В работе у меня» (`features/dashboard/components/MyInProgressWidget.tsx`).
- [x] Виджет «Просроченные» (`OverdueWidget.tsx`, «моя зона видимости» — creator/assignee/helper).
- [x] Виджет «Нужна помощь» (`NeedsHelpWidget.tsx`; показывается specialist/duty_officer/manager/admin, скрыт у developer/accountant).
- [x] Виджет «Критические категории» (последние 30 дней, `CriticalCategoriesWidget.tsx`; только duty_officer/manager/admin).
- [x] Виджет «Последние уведомления» — закрыт колокольчиком в шапке, дублировать не стали.

---

## Cross-cutting (после каждой задачи)

1. **Migration + TypeScript types**
   - Новая миграция? → `apply_migration` → `generate_typescript_types` → `app/src/types/database.ts`.
   - Пересборка типов коммитится вместе с фичей.
2. **Advisors**
   - `get_advisors` (security + performance) — зелёно или только `INFO`.
   - Новые WARN — чинить до коммита.
3. **ТЗ**
   - Поменялось поведение — обновить соответствующий файл `ТЗ/`.
4. **Skills**
   - Появился новый паттерн (например, шаблон формы или RLS-хелпер) → дополнить `skills/`.
5. **Git**
   - Conventional commits: `feat(tasks): …`, `fix(rls): …`, `chore(db): …`, `docs(тз): …`.
   - Мелкие коммиты, один логический шаг — один коммит.
6. **Тесты**
   - Перед коммитом: `npm run typecheck`, `npm run lint`, `npm run test`.
7. **Документация в PR**
   - В теле PR — ссылки на пункты этого плана (например, `closes B4, B7`).

---

## Примерный порядок спринтов (после текущего состояния)

| Спринт | Содержимое | Оценка |
|---|---|---|
| 1 | A1 + A2 + A3 (справочники + админка + профиль) | ~3–4 дня |
| 2 | B1 + B2 + B3 (создание / список / карточка) | ~4–5 дней |
| 3 | B4 + B5 + B6 (статусы + комментарии + история) | ~3 дня |
| 4 | B7 + B8 + B9 + B10 (отклонение, помощь, разработка, удаление) | ~3 дня |
| 5 | C1 + C2 + C3 (канбан, toggle, поиск) | ~3 дня |
| 6 | D1–D3 (шаблоны) | ~2 дня |
| 7 | E1 + E2 + E3 (realtime + триггеры + cron) | ~2 дня |
| 8 | F1–F3 (аналитика + CSV) | ~2 дня |
| 9 | G1 + G2 + G3 + G6 + H (тесты, webhooks, dashboard widgets) | ~3 дня |
| 10 | Полировка, UX-правки, баги, release-candidate | ~2 дня |

Итого ~25–30 рабочих дней с одним исполнителем.

---

## Критерии готовности MVP

Смотри [`ТЗ/08-mvp-и-план-работ.md`](./ТЗ/08-mvp-и-план-работ.md) §8.5.
Кратко: все 6 ролей проходят свой happy-path, RLS покрыты тестами, нет критических багов, бэкап восстанавливается, инструкции на каждую роль готовы.
