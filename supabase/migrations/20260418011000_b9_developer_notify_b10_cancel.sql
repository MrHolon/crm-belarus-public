-- B9/B10 part 1: cancel columns, task_history fields, cancelled_at trigger, helper guard columns.
-- Part 2: enforce_task_status_transition + notify_developer_task_created → 20260418011100_b9_b10_enforce_notify.sql

begin;

alter table public.tasks
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz;

create or replace function public.log_task_changes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  fields text[] := array[
    'assignee_id',
    'status',
    'priority',
    'complexity',
    'due_date',
    'category_id',
    'rejection_reason',
    'rejected_at',
    'rejected_by_id',
    'cancellation_reason',
    'cancelled_at'
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

create or replace function public.tasks_set_cancelled_metadata()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from new.status then
    new.cancelled_at := coalesce(new.cancelled_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_set_cancelled_metadata on public.tasks;

create trigger tasks_set_cancelled_metadata
  before update on public.tasks
  for each row
  execute function public.tasks_set_cancelled_metadata();

create or replace function public.enforce_helper_task_updates()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  is_helper_only boolean;
begin
  if uid is null then
    return new;
  end if;

  is_helper_only := exists (
    select 1
    from public.task_helpers h
    where h.task_id = old.id
      and h.user_id = uid
      and h.is_active
  )
  and old.assignee_id is distinct from uid
  and old.creator_id is distinct from uid
  and not (select public.is_staff());

  if not is_helper_only then
    return new;
  end if;

  if (
    new.title,
    new.description,
    new.creator_id,
    new.assignee_id,
    new.category_id,
    new.task_type_id,
    new.complexity,
    new.priority,
    new.due_date,
    new.started_at,
    new.completed_at,
    new.parent_task_id,
    new.rejection_reason,
    new.rejected_at,
    new.rejected_by_id,
    new.help_comment,
    new.help_requested_at,
    new.cancellation_reason,
    new.cancelled_at,
    new.created_at
  ) is distinct from (
    old.title,
    old.description,
    old.creator_id,
    old.assignee_id,
    old.category_id,
    old.task_type_id,
    old.complexity,
    old.priority,
    old.due_date,
    old.started_at,
    old.completed_at,
    old.parent_task_id,
    old.rejection_reason,
    old.rejected_at,
    old.rejected_by_id,
    old.help_comment,
    old.help_requested_at,
    old.cancellation_reason,
    old.cancelled_at,
    old.created_at
  ) then
    raise exception 'invalid_status_transition: helper may only change status';
  end if;

  return new;
end;
$$;

commit;
