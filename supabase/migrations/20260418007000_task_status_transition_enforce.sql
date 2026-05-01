-- 20260418007000_task_status_transition_enforce.sql
-- B4: Reject invalid task status transitions at the database layer (ТЗ §4.1).
-- Client uses lib/transitions.ts; this trigger is the source of truth for writes.

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
      if new.status = 'needs_help' then
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

drop trigger if exists tasks_enforce_status_transition on public.tasks;

create trigger tasks_enforce_status_transition
  before update on public.tasks
  for each row
  execute function public.enforce_task_status_transition();

commit;
