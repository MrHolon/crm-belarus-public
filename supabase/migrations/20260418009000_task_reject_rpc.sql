-- 20260418009000_task_reject_rpc.sql
-- B7: Reject task as assignee (RPC + transition rules + clear rejection on reassign + history fields).

begin;

-- Log rejection-related columns in task_history.
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
    'rejected_by_id'
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

-- Clear active rejection UI when a new assignee is set.
create or replace function public.tasks_clear_rejection_on_reassign()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.assignee_id is not null
     and new.assignee_id is distinct from old.assignee_id
     and (
       old.rejection_reason is not null
       or old.rejected_at is not null
       or old.rejected_by_id is not null
     )
  then
    new.rejection_reason := null;
    new.rejected_at := null;
    new.rejected_by_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_clear_rejection_on_reassign on public.tasks;

create trigger tasks_clear_rejection_on_reassign
  before update on public.tasks
  for each row
  execute function public.tasks_clear_rejection_on_reassign();

-- Allow in_progress → new when assignee rejects (reason + audit columns set in same update).
create or replace function public.enforce_task_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  r text;
  is_assignee boolean;
  is_creator boolean;
  is_helper boolean;
  is_staff boolean;
  can_cancel boolean;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if uid is null then
    raise exception 'invalid_status_transition: not authenticated';
  end if;

  select u.role::text into r from public.users u where u.id = uid;
  if r is null then
    raise exception 'invalid_status_transition: user profile missing';
  end if;

  is_assignee := old.assignee_id is not distinct from uid;
  is_creator := old.creator_id is not distinct from uid;
  select exists (
    select 1
    from public.task_helpers h
    where h.task_id = old.id
      and h.user_id = uid
      and h.is_active
  ) into is_helper;

  is_staff := r in ('duty_officer', 'manager', 'admin');
  can_cancel := is_creator or r in ('duty_officer', 'manager', 'admin');

  case old.status
    when 'new' then
      if new.status = 'in_progress' then
        if new.assignee_id is null then
          raise exception 'invalid_status_transition: in_progress requires assignee';
        end if;
        if is_staff then
          return new;
        end if;
        if old.assignee_id is not distinct from uid then
          return new;
        end if;
        if old.assignee_id is null and new.assignee_id is not distinct from uid then
          return new;
        end if;
        raise exception 'invalid_status_transition';
      elsif new.status = 'cancelled' then
        if can_cancel then
          return new;
        end if;
        raise exception 'invalid_status_transition';
      else
        raise exception 'invalid_status_transition';
      end if;

    when 'in_progress' then
      if new.status = 'new' then
        if is_assignee
           and new.assignee_id is null
           and length(trim(coalesce(new.rejection_reason, ''))) >= 10
           and new.rejected_by_id is not distinct from uid
        then
          return new;
        end if;
        raise exception 'invalid_status_transition';
      elsif new.status = 'needs_help' then
        if not is_assignee then
          raise exception 'invalid_status_transition';
        end if;
        if coalesce(trim(new.help_comment), '') = '' then
          raise exception 'invalid_status_transition: needs_help requires help_comment';
        end if;
        return new;
      elsif new.status = 'on_review' then
        if is_assignee then
          return new;
        end if;
        raise exception 'invalid_status_transition';
      elsif new.status = 'done' then
        if is_assignee or is_creator then
          return new;
        end if;
        raise exception 'invalid_status_transition';
      elsif new.status = 'cancelled' then
        if can_cancel then
          return new;
        end if;
        raise exception 'invalid_status_transition';
      else
        raise exception 'invalid_status_transition';
      end if;

    when 'needs_help' then
      if new.status = 'in_progress' then
        if is_assignee or is_helper then
          return new;
        end if;
        raise exception 'invalid_status_transition';
      elsif new.status = 'on_review' then
        if is_assignee or is_helper then
          return new;
        end if;
        raise exception 'invalid_status_transition';
      elsif new.status = 'done' then
        if is_assignee or is_helper or is_creator then
          return new;
        end if;
        raise exception 'invalid_status_transition';
      elsif new.status = 'cancelled' then
        if can_cancel then
          return new;
        end if;
        raise exception 'invalid_status_transition';
      else
        raise exception 'invalid_status_transition';
      end if;

    when 'on_review' then
      if new.status = 'in_progress' then
        if is_creator or r in ('duty_officer', 'manager', 'admin') then
          return new;
        end if;
        raise exception 'invalid_status_transition';
      elsif new.status = 'done' then
        if is_creator or r in ('duty_officer', 'manager', 'admin') then
          return new;
        end if;
        raise exception 'invalid_status_transition';
      elsif new.status = 'cancelled' then
        if can_cancel then
          return new;
        end if;
        raise exception 'invalid_status_transition';
      else
        raise exception 'invalid_status_transition';
      end if;

    when 'done' then
      if new.status = 'in_progress' then
        if is_creator then
          return new;
        end if;
        raise exception 'invalid_status_transition';
      else
        raise exception 'invalid_status_transition';
      end if;

    when 'cancelled' then
      raise exception 'invalid_status_transition: cancelled is terminal';

    else
      raise exception 'invalid_status_transition';
  end case;
end;
$$;

create or replace function public.reject_task(p_task_id bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tasks%rowtype;
  uid uuid := auth.uid();
  r text;
begin
  if uid is null then
    raise exception 'reject_task: not authenticated';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'reject_task: reason must be at least 10 characters';
  end if;

  select * into strict t from public.tasks where id = p_task_id;

  if t.assignee_id is distinct from uid then
    raise exception 'reject_task: only assignee can reject';
  end if;

  if t.status not in ('new', 'in_progress') then
    raise exception 'reject_task: invalid status';
  end if;

  update public.tasks
  set
    assignee_id = null,
    status = 'new',
    rejection_reason = trim(p_reason),
    rejected_at = now(),
    rejected_by_id = uid
  where id = p_task_id;

  if t.creator_id is not null and t.creator_id is distinct from uid then
    insert into public.notifications (user_id, task_id, type, title, body)
    values (
      t.creator_id,
      p_task_id,
      'task_rejected',
      'Задача ' || coalesce(t.ticket_number, '#' || p_task_id::text) || ' отклонена исполнителем',
      left(trim(p_reason), 600)
    );
  end if;
end;
$$;

grant execute on function public.reject_task(bigint, text) to authenticated;

commit;
