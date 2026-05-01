-- E1/E2: Realtime-friendly replica identity + in-app notifications for assign / status.
-- ТЗ/06 §6.2: assigned → new assignee; status_changed → creator + assignee (except actor).

begin;

-- Helps Realtime deliver filtered postgres_changes when RLS hides most columns.
alter table public.notifications replica identity full;

-- Human-readable status labels for notification body (Russian UI copy).
create or replace function public.task_status_label_ru(st public.task_status)
returns text
language sql
immutable
set search_path = public
as $$
  select case st
    when 'new' then 'Новая'
    when 'in_progress' then 'В работе'
    when 'needs_help' then 'Нужна помощь'
    when 'on_review' then 'На проверке'
    when 'done' then 'Выполнена'
    when 'cancelled' then 'Отменена'
  end;
$$;

create or replace function public.notify_task_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  tt text;
begin
  if tg_op = 'INSERT' then
    if new.assignee_id is null then
      return new;
    end if;
    if new.assignee_id is not distinct from actor then
      return new;
    end if;
    select t.code into tt from public.task_types t where t.id = new.task_type_id;
    if tt = 'developer_task' then
      return new;
    end if;
    insert into public.notifications (user_id, task_id, type, title, body)
    values (
      new.assignee_id,
      new.id,
      'assigned',
      'Вам назначена задача ' || coalesce(new.ticket_number, '#' || new.id::text),
      left(coalesce(new.title, ''), 600)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.assignee_id is not distinct from old.assignee_id then
      return new;
    end if;
    if new.assignee_id is null then
      return new;
    end if;
    if new.assignee_id is not distinct from actor then
      return new;
    end if;
    insert into public.notifications (user_id, task_id, type, title, body)
    values (
      new.assignee_id,
      new.id,
      'assigned',
      'Вам назначена задача ' || coalesce(new.ticket_number, '#' || new.id::text),
      left(coalesce(new.title, ''), 600)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_notify_assigned_insert on public.tasks;
drop trigger if exists tasks_notify_assigned_update on public.tasks;

create trigger tasks_notify_assigned_insert
  after insert on public.tasks
  for each row
  execute function public.notify_task_assigned();

create trigger tasks_notify_assigned_update
  after update of assignee_id on public.tasks
  for each row
  execute function public.notify_task_assigned();

create or replace function public.notify_task_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  lbl_old text;
  lbl_new text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  lbl_old := public.task_status_label_ru(old.status);
  lbl_new := public.task_status_label_ru(new.status);

  insert into public.notifications (user_id, task_id, type, title, body)
  select distinct u.uid,
    new.id,
    'status_changed',
    'Статус: ' || coalesce(new.ticket_number, '#' || new.id::text),
    coalesce(lbl_old, old.status::text) || ' → ' || coalesce(lbl_new, new.status::text)
  from (
    select new.creator_id as uid
    union
    select new.assignee_id
  ) u
  where u.uid is not null
    and (actor is null or u.uid is distinct from actor);

  return new;
end;
$$;

drop trigger if exists tasks_notify_status on public.tasks;

create trigger tasks_notify_status
  after update of status on public.tasks
  for each row
  execute function public.notify_task_status_changed();

-- E3 (scheduled): due soon / overdue — called from pg_cron (next migration).
create or replace function public.notify_due_soon()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, task_id, type, title, body)
  select t.assignee_id,
    t.id,
    'due_soon',
    'Срок по задаче ' || coalesce(t.ticket_number, '#' || t.id::text) || ' скоро',
    left(coalesce(t.title, ''), 600)
  from public.tasks t
  where t.status not in ('done', 'cancelled')
    and t.assignee_id is not null
    and t.due_date is not null
    and t.due_date > now()
    and t.due_date <= now() + interval '2 hours'
    and not exists (
      select 1
      from public.notifications n
      where n.task_id = t.id
        and n.type = 'due_soon'
        and n.created_at > now() - interval '24 hours'
    );
end;
$$;

create or replace function public.notify_overdue()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, task_id, type, title, body)
  select distinct r.uid,
    t.id,
    'overdue',
    'Просрочена задача ' || coalesce(t.ticket_number, '#' || t.id::text),
    left(coalesce(t.title, ''), 600)
  from public.tasks t
  cross join lateral (
    select distinct x.uid
    from (
      select t.assignee_id as uid
      union
      select t.creator_id
      union
      select u.id
      from public.users u
      where u.role = 'duty_officer'
        and u.is_active
    ) x
    where x.uid is not null
  ) r
  where t.status not in ('done', 'cancelled')
    and t.due_date is not null
    and t.due_date < now()
    and not exists (
      select 1
      from public.notifications n
      where n.task_id = t.id
        and n.type = 'overdue'
        and n.created_at > now() - interval '24 hours'
    );
end;
$$;

commit;
