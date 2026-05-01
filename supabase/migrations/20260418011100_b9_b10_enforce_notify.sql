-- Part 2: enforce cancellation reason + developer_task_created notification (apply after 20260418011000 first segment if split).
-- Full repo history: 20260418011000 contains complete chain for fresh installs.

begin;

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

  if new.status = 'cancelled' and old.status is distinct from new.status then
    if length(trim(coalesce(new.cancellation_reason, ''))) < 5 then
      raise exception 'invalid_status_transition: cancellation requires reason';
    end if;
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

create or replace function public.notify_developer_task_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tt text;
begin
  if new.assignee_id is null then
    return new;
  end if;
  select t.code into tt from public.task_types t where t.id = new.task_type_id;
  if tt = 'developer_task' and new.parent_task_id is not null then
    insert into public.notifications (user_id, task_id, type, title, body)
    values (
      new.assignee_id,
      new.id,
      'developer_task_created',
      'Задача разработчику: ' || coalesce(new.ticket_number, '#' || new.id::text),
      left(coalesce(new.title, ''), 600)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_notify_developer_child on public.tasks;

create trigger tasks_notify_developer_child
  after insert on public.tasks
  for each row
  execute function public.notify_developer_task_created();

commit;
