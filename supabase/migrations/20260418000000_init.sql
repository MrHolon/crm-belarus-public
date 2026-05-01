-- =============================================================================
-- 20260418000000_init.sql
-- Initial schema for CRM Belarus.
-- Source of truth: ТЗ/03-сущности-и-база-данных.md and ТЗ/06-уведомления-и-интеграции.md
-- Notes:
--   * `tasks.is_overdue` from the spec is implemented as a computed column
--     in the view `public.v_tasks` — generated columns cannot use `now()`.
--   * Helper function is `public.current_user_role()` (spec named it
--     `auth.user_role()`; we keep it in `public` to avoid touching the
--     `auth` schema from application migrations).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm  with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.user_role as enum (
  'specialist',
  'duty_officer',
  'developer',
  'accountant',
  'manager',
  'admin'
);

create type public.task_status as enum (
  'new',
  'in_progress',
  'needs_help',
  'on_review',
  'done',
  'cancelled'
);

create type public.category_severity as enum (
  'normal',
  'important',
  'critical'
);

create type public.task_priority as enum (
  'low',
  'medium',
  'high',
  'critical'
);

create type public.notification_type as enum (
  'assigned',
  'status_changed',
  'help_requested',
  'help_added',
  'comment_added',
  'mention',
  'task_rejected',
  'due_soon',
  'overdue',
  'developer_task_created'
);

-- -----------------------------------------------------------------------------
-- Shared utility functions
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Users
-- -----------------------------------------------------------------------------
create table public.users (
  id               uuid primary key default gen_random_uuid(),
  full_name        text not null,
  login            text not null unique,
  email            text unique,
  phone            text,
  role             public.user_role not null,
  is_active        boolean not null default true,
  telegram_chat_id text,
  prefers_kanban   boolean not null default true,
  timezone         text not null default 'Europe/Minsk',
  created_at       timestamptz not null default now(),
  last_login_at    timestamptz
);

comment on table public.users is
  'Учётные записи всех ролей. id совпадает с auth.users.id (Supabase Auth).';

create index users_role_active_idx
  on public.users (role)
  where is_active;

-- Current user's role, used inside RLS policies.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text
  from public.users
  where id = auth.uid()
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

-- Convenience helper for admins / managers / duty
create or replace function public.is_staff()
returns boolean
language sql
stable
as $$
  select public.current_user_role() in ('admin', 'manager', 'duty_officer')
$$;

grant execute on function public.is_staff() to authenticated;

-- -----------------------------------------------------------------------------
-- Reference tables
-- -----------------------------------------------------------------------------
create table public.problem_categories (
  id          bigserial primary key,
  name        text not null unique,
  description text,
  severity    public.category_severity not null default 'normal',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.task_types (
  id          bigserial primary key,
  code        text not null unique,
  name        text not null,
  is_active   boolean not null default true,
  order_index int not null default 0
);

create table public.priorities (
  id          bigserial primary key,
  code        text not null unique,
  name        text not null,
  is_active   boolean not null default true,
  order_index int not null default 0
);

create table public.statuses (
  id          bigserial primary key,
  code        text not null unique,
  name        text not null,
  is_active   boolean not null default true,
  order_index int not null default 0
);

-- -----------------------------------------------------------------------------
-- Tags
-- -----------------------------------------------------------------------------
create table public.tags (
  id         bigserial primary key,
  name       text not null unique,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Tasks
-- -----------------------------------------------------------------------------
create table public.tasks (
  id                 bigserial primary key,
  ticket_number      text generated always as (
                       'TASK-' || lpad(id::text, 5, '0')
                     ) stored unique,
  title              text not null,
  description        text,
  creator_id         uuid not null references public.users(id),
  assignee_id        uuid references public.users(id),
  category_id        bigint not null references public.problem_categories(id),
  task_type_id       bigint not null references public.task_types(id),
  complexity         smallint not null check (complexity between 1 and 5),
  priority           public.task_priority not null default 'medium',
  status             public.task_status not null default 'new',
  due_date           timestamptz,
  started_at         timestamptz,
  completed_at       timestamptz,
  parent_task_id     bigint references public.tasks(id),
  rejection_reason   text,
  rejected_at        timestamptz,
  rejected_by_id     uuid references public.users(id),
  help_comment       text,
  help_requested_at  timestamptz,
  search_tsv         tsvector generated always as (
                       setweight(to_tsvector('russian', coalesce(title, '')), 'A') ||
                       setweight(to_tsvector('russian', coalesce(description, '')), 'B')
                     ) stored,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index tasks_assignee_idx  on public.tasks (assignee_id) where status <> 'cancelled';
create index tasks_creator_idx   on public.tasks (creator_id);
create index tasks_status_idx    on public.tasks (status);
create index tasks_category_idx  on public.tasks (category_id);
create index tasks_help_idx      on public.tasks (status) where status = 'needs_help';
create index tasks_search_idx    on public.tasks using gin (search_tsv);
create index tasks_due_idx       on public.tasks (due_date)
  where due_date is not null and status not in ('done', 'cancelled');

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- View exposing is_overdue (spec 3.3.2)
create or replace view public.v_tasks
with (security_invoker = on) as
select
  t.*,
  (t.due_date is not null
    and t.status not in ('done', 'cancelled')
    and now() > t.due_date) as is_overdue
from public.tasks t;

comment on view public.v_tasks is
  'Задачи с вычисляемым флагом is_overdue. security_invoker = on гарантирует, что RLS таблицы tasks применяется к читателям view.';

-- -----------------------------------------------------------------------------
-- Task history (audit trail for a tight set of fields)
-- -----------------------------------------------------------------------------
create table public.task_history (
  id          bigserial primary key,
  task_id     bigint not null references public.tasks(id) on delete cascade,
  user_id     uuid references public.users(id),
  field_name  text not null,
  old_value   jsonb,
  new_value   jsonb,
  changed_at  timestamptz not null default now()
);

create index task_history_task_idx
  on public.task_history (task_id, changed_at desc);

create or replace function public.log_task_changes()
returns trigger
language plpgsql
as $$
declare
  fields text[] := array[
    'assignee_id',
    'status',
    'priority',
    'complexity',
    'due_date',
    'category_id'
  ];
  field  text;
  old_j  jsonb := to_jsonb(old);
  new_j  jsonb := to_jsonb(new);
  old_v  jsonb;
  new_v  jsonb;
begin
  foreach field in array fields loop
    old_v := old_j -> field;
    new_v := new_j -> field;
    if old_v is distinct from new_v then
      insert into public.task_history (task_id, user_id, field_name, old_value, new_value)
      values (new.id, auth.uid(), field, old_v, new_v);
    end if;
  end loop;
  return new;
end;
$$;

create trigger tasks_log_changes
  after update on public.tasks
  for each row execute function public.log_task_changes();

-- -----------------------------------------------------------------------------
-- Task comments
-- -----------------------------------------------------------------------------
create table public.task_comments (
  id           bigserial primary key,
  task_id      bigint not null references public.tasks(id) on delete cascade,
  user_id      uuid not null references public.users(id),
  comment_text text not null,
  mentions     uuid[] not null default '{}',
  created_at   timestamptz not null default now()
);

create index task_comments_task_idx
  on public.task_comments (task_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Task helpers
-- -----------------------------------------------------------------------------
create table public.task_helpers (
  id               bigserial primary key,
  task_id          bigint not null references public.tasks(id) on delete cascade,
  user_id          uuid not null references public.users(id),
  added_by_user_id uuid not null references public.users(id),
  helper_comment   text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (task_id, user_id)
);

create index task_helpers_user_idx
  on public.task_helpers (user_id)
  where is_active;

-- -----------------------------------------------------------------------------
-- Task <-> Tag M2M
-- -----------------------------------------------------------------------------
create table public.task_tags (
  task_id bigint not null references public.tasks(id) on delete cascade,
  tag_id  bigint not null references public.tags(id)  on delete cascade,
  primary key (task_id, tag_id)
);

create index task_tags_tag_idx on public.task_tags (tag_id);

-- -----------------------------------------------------------------------------
-- Task templates
-- -----------------------------------------------------------------------------
create table public.task_templates (
  id                   bigserial primary key,
  name                 text not null,
  created_by           uuid not null references public.users(id),
  is_public            boolean not null default false,
  title_template       text,
  description_template text,
  category_id          bigint references public.problem_categories(id),
  task_type_id         bigint references public.task_types(id),
  complexity           smallint check (complexity between 1 and 5),
  priority             public.task_priority,
  default_tags         text[] not null default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index task_templates_owner_idx on public.task_templates (created_by);
create index task_templates_public_idx on public.task_templates (is_public) where is_public;

create trigger task_templates_set_updated_at
  before update on public.task_templates
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Task files (MVP stub — table exists, UI shows "coming soon")
-- -----------------------------------------------------------------------------
create table public.task_files (
  id                  bigserial primary key,
  task_id             bigint not null references public.tasks(id) on delete cascade,
  file_name           text not null,
  storage_path        text not null,
  content_type        text,
  size_bytes          bigint,
  uploaded_by_user_id uuid not null references public.users(id),
  uploaded_at         timestamptz not null default now()
);

create index task_files_task_idx on public.task_files (task_id);

-- -----------------------------------------------------------------------------
-- Knowledge base (MVP stub)
-- -----------------------------------------------------------------------------
create table public.kb_articles (
  id              bigserial primary key,
  title           text not null,
  body_md         text,
  category_id     bigint references public.problem_categories(id),
  related_task_id bigint references public.tasks(id),
  author_id       uuid references public.users(id),
  is_published    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index kb_articles_published_idx
  on public.kb_articles (is_published, created_at desc);

create trigger kb_articles_set_updated_at
  before update on public.kb_articles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Notifications
-- -----------------------------------------------------------------------------
create table public.notifications (
  id         bigserial primary key,
  user_id    uuid not null references public.users(id) on delete cascade,
  task_id    bigint references public.tasks(id) on delete cascade,
  type       public.notification_type not null,
  title      text not null,
  body       text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where not is_read;

-- -----------------------------------------------------------------------------
-- Outgoing webhooks (stub for future n8n integration)
-- -----------------------------------------------------------------------------
create table public.outgoing_webhooks (
  id          bigserial primary key,
  name        text not null,
  url         text not null,
  secret      text,
  event_types public.notification_type[] not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Dispatcher: fires an async HTTP POST for each matching webhook on new notification.
-- Uses extensions.pg_net (bundled with Supabase).
create or replace function public.dispatch_webhooks()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  hook record;
  payload jsonb;
begin
  payload := jsonb_build_object(
    'event',       new.type,
    'user_id',     new.user_id,
    'task_id',     new.task_id,
    'title',       new.title,
    'body',        new.body,
    'occurred_at', new.created_at
  );

  for hook in
    select * from public.outgoing_webhooks
    where is_active and new.type = any(event_types)
  loop
    perform net.http_post(
      url     := hook.url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := payload
    );
  end loop;

  return new;
end;
$$;

create trigger notifications_dispatch_webhooks
  after insert on public.notifications
  for each row execute function public.dispatch_webhooks();

-- -----------------------------------------------------------------------------
-- Seed: reference dictionaries
-- -----------------------------------------------------------------------------
insert into public.task_types (code, name, order_index) values
  ('regular',        'Обычная задача',        10),
  ('consultation',   'Консультация',          20),
  ('bug',            'Ошибка / баг',          30),
  ('improvement',    'Доработка',             40),
  ('developer_task', 'Задача разработчику',   50);

insert into public.priorities (code, name, order_index) values
  ('low',      'Низкий',       10),
  ('medium',   'Средний',      20),
  ('high',     'Высокий',      30),
  ('critical', 'Критический',  40);

insert into public.statuses (code, name, order_index) values
  ('new',         'Новая',        10),
  ('in_progress', 'В работе',     20),
  ('needs_help',  'Нужна помощь', 30),
  ('on_review',   'На проверке',  40),
  ('done',        'Выполнена',    50),
  ('cancelled',   'Отменена',     60);

insert into public.problem_categories (name, description, severity) values
  ('Общие вопросы',       'Прочие обращения без конкретной категории', 'normal'),
  ('Договор',             'Вопросы по договорам и документам',         'normal'),
  ('Долг клиента',        'Задолженности и счета',                      'important'),
  ('Бухгалтерия',         'Налоги, отчётность, расчёты',                'important'),
  ('Техническая ошибка',  'Баги и сбои ПО',                             'important'),
  ('Критический инцидент','Нарушение работы ключевых процессов',        'critical');
