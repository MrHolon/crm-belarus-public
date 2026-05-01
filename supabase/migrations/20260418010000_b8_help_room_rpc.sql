-- B8: Help request (≥1 helper), help-room self-join, RLS for helpers, notifications.

begin;

-- ---------------------------------------------------------------------------
-- SELECT: developer sees «needs_help» pool (ТЗ §4.5 + PLAN B8).
-- ---------------------------------------------------------------------------
drop policy if exists tasks_select on public.tasks;

create policy tasks_select on public.tasks for select to authenticated
  using (
    (select public.is_staff())
    or creator_id = (select auth.uid())
    or assignee_id = (select auth.uid())
    or (
      (select public.current_user_role()) = 'specialist'
      and status = 'needs_help'
    )
    or (
      (select public.current_user_role()) = 'developer'
      and status = 'needs_help'
    )
    or exists (
      select 1 from public.task_helpers h
      where h.task_id = tasks.id
        and h.user_id = (select auth.uid())
        and h.is_active
    )
  );

-- ---------------------------------------------------------------------------
-- UPDATE: active helper may change row (status transitions; trigger limits fields).
-- ---------------------------------------------------------------------------
drop policy if exists tasks_update on public.tasks;

create policy tasks_update on public.tasks for update to authenticated
  using (
    (select public.is_staff())
    or assignee_id = (select auth.uid())
    or creator_id = (select auth.uid())
    or exists (
      select 1 from public.task_helpers h
      where h.task_id = tasks.id
        and h.user_id = (select auth.uid())
        and h.is_active
    )
  )
  with check (
    (select public.is_staff())
    or assignee_id = (select auth.uid())
    or creator_id = (select auth.uid())
    or exists (
      select 1 from public.task_helpers h
      where h.task_id = tasks.id
        and h.user_id = (select auth.uid())
        and h.is_active
    )
  );

-- ---------------------------------------------------------------------------
-- INSERT task_helpers: join from help-room (self-add on needs_help tasks).
-- ---------------------------------------------------------------------------
drop policy if exists task_helpers_insert on public.task_helpers;

create policy task_helpers_insert on public.task_helpers for insert to authenticated
  with check (
    (select public.is_staff())
    or (
      added_by_user_id = (select auth.uid())
      and exists (
        select 1 from public.tasks t
        where t.id = task_helpers.task_id
          and (t.creator_id = (select auth.uid()) or t.assignee_id = (select auth.uid()))
      )
    )
    or (
      user_id = (select auth.uid())
      and added_by_user_id = (select auth.uid())
      and exists (
        select 1 from public.tasks t
        where t.id = task_helpers.task_id
          and t.status = 'needs_help'
      )
      and (select public.current_user_role()) in (
        'specialist', 'duty_officer', 'developer', 'manager', 'admin'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- BEFORE UPDATE: helper (not assignee/creator/staff) may only change status.
-- ---------------------------------------------------------------------------
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
    old.created_at
  ) then
    raise exception 'invalid_status_transition: helper may only change status';
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_enforce_helper_updates on public.tasks;

create trigger tasks_enforce_helper_updates
  before update on public.tasks
  for each row
  execute function public.enforce_helper_task_updates();

-- ---------------------------------------------------------------------------
-- AFTER UPDATE: in_progress → needs_help requires ≥1 active helper (ТЗ §4.5).
-- ---------------------------------------------------------------------------
create or replace function public.tasks_assert_helpers_when_needs_help()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'needs_help'
     and old.status is distinct from new.status
     and old.status = 'in_progress'
  then
    if (
      select count(*)::int
      from public.task_helpers h
      where h.task_id = new.id
        and h.is_active
    ) < 1 then
      raise exception 'invalid_status_transition: needs_help requires at least one active helper';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_assert_helpers_when_needs_help on public.tasks;

create trigger tasks_assert_helpers_when_needs_help
  after update on public.tasks
  for each row
  execute function public.tasks_assert_helpers_when_needs_help();

-- ---------------------------------------------------------------------------
-- RPC: assignee requests help (insert helpers + transition).
-- ---------------------------------------------------------------------------
create or replace function public.request_task_help(
  p_task_id bigint,
  p_help_comment text,
  p_helper_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t public.tasks%rowtype;
  v_comment text := trim(coalesce(p_help_comment, ''));
  hid uuid;
  n int := 0;
begin
  if uid is null then
    raise exception 'request_task_help: not authenticated';
  end if;

  if v_comment = '' then
    raise exception 'request_task_help: comment required';
  end if;

  if p_helper_ids is null or cardinality(p_helper_ids) < 1 then
    raise exception 'request_task_help: at least one helper required';
  end if;

  select * into strict t from public.tasks where id = p_task_id for update;

  if t.assignee_id is distinct from uid then
    raise exception 'request_task_help: only assignee';
  end if;

  if t.status <> 'in_progress' then
    raise exception 'request_task_help: invalid status';
  end if;

  for hid in
    select distinct x
    from unnest(p_helper_ids) as x
    where x is not null
      and x is distinct from uid
  loop
    if not exists (
      select 1 from public.users u where u.id = hid and u.is_active
    ) then
      raise exception 'request_task_help: invalid helper user';
    end if;

    insert into public.task_helpers (task_id, user_id, added_by_user_id, is_active)
    values (p_task_id, hid, uid, true)
    on conflict (task_id, user_id) do update
      set is_active = true,
          added_by_user_id = excluded.added_by_user_id;

    insert into public.notifications (user_id, task_id, type, title, body)
    values (
      hid,
      p_task_id,
      'help_requested',
      'Нужна помощь: ' || coalesce(t.ticket_number, '#' || p_task_id::text),
      left(v_comment, 600)
    );

    n := n + 1;
  end loop;

  if n < 1 then
    raise exception 'request_task_help: at least one helper required';
  end if;

  update public.tasks
  set
    status = 'needs_help',
    help_comment = v_comment,
    help_requested_at = now()
  where id = p_task_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: join as helper from help-room.
-- ---------------------------------------------------------------------------
create or replace function public.join_task_as_helper(
  p_task_id bigint,
  p_helper_comment text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t public.tasks%rowtype;
  r public.user_role;
  v_comment text := nullif(trim(coalesce(p_helper_comment, '')), '');
begin
  if uid is null then
    raise exception 'join_task_as_helper: not authenticated';
  end if;

  select * into strict t from public.tasks where id = p_task_id for update;

  if t.status <> 'needs_help' then
    raise exception 'join_task_as_helper: task not in needs_help';
  end if;

  if t.assignee_id is not distinct from uid then
    raise exception 'join_task_as_helper: assignee cannot join as helper';
  end if;

  select u.role into r from public.users u where u.id = uid;
  if r is null then
    raise exception 'join_task_as_helper: user profile missing';
  end if;

  if r not in (
    'specialist', 'duty_officer', 'developer', 'manager', 'admin'
  ) then
    raise exception 'join_task_as_helper: role not allowed';
  end if;

  if exists (
    select 1
    from public.task_helpers h
    where h.task_id = p_task_id
      and h.user_id = uid
      and h.is_active
  ) then
    raise exception 'join_task_as_helper: already a helper';
  end if;

  insert into public.task_helpers (task_id, user_id, added_by_user_id, helper_comment, is_active)
  values (p_task_id, uid, uid, v_comment, true);

  if t.assignee_id is not null then
    insert into public.notifications (user_id, task_id, type, title, body)
    values (
      t.assignee_id,
      p_task_id,
      'help_added',
      'Помощник присоединился к ' || coalesce(t.ticket_number, '#' || p_task_id::text),
      left(coalesce(v_comment, 'Пользователь предложил помощь по задаче.'), 600)
    );
  end if;
end;
$$;

grant execute on function public.request_task_help(bigint, text, uuid[]) to authenticated;
grant execute on function public.join_task_as_helper(bigint, text) to authenticated;

commit;
