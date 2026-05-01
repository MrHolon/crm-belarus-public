-- List vs kanban preference (PLAN A3, C2); replaces boolean prefers_kanban.
create type public.user_task_view as enum ('list', 'kanban');

alter table public.users
  add column preferred_view public.user_task_view;

alter table public.users
  add column notification_prefs jsonb not null default '{}'::jsonb;

update public.users
set preferred_view = case
  when prefers_kanban then 'kanban'::public.user_task_view
  else 'list'::public.user_task_view
end;

alter table public.users
  alter column preferred_view set not null;

alter table public.users
  alter column preferred_view set default 'kanban'::public.user_task_view;

alter table public.users
  drop column prefers_kanban;

comment on column public.users.preferred_view is
  'Preferred tasks presentation: list or kanban (toggle also mirrored in localStorage in C2).';

comment on column public.users.notification_prefs is
  'Reserved for per-channel notification preferences; MVP uses in-app notifications only.';
