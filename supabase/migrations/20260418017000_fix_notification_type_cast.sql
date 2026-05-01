-- Fix: `INSERT ... SELECT` into `public.notifications` sent bare text literals
-- like 'status_changed' / 'comment_added' / 'due_soon' / 'overdue'. In the
-- SELECT form, Postgres does NOT implicitly cast text -> enum, so every
-- trigger that used that shape raised
--   column "type" is of type notification_type but expression is of type text
-- and broke any UPDATE on public.tasks (status transitions), comment inserts
-- and the due_soon/overdue cron jobs.
--
-- Fix: explicit ::public.notification_type cast on every literal in the
-- SELECT projections below. VALUES-form inserts in the same triggers are
-- unaffected (unknown -> enum coercion works there) so we leave them alone.

begin;

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
    'status_changed'::public.notification_type,
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
    'due_soon'::public.notification_type,
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
    'overdue'::public.notification_type,
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

create or replace function public.notify_on_task_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tk record;
  m uuid;
  mention_ids uuid[];
begin
  mention_ids := coalesce(new.mentions, '{}');

  select t.ticket_number, t.title, t.creator_id, t.assignee_id
  into tk
  from public.tasks t
  where t.id = new.task_id;

  if not found then
    return new;
  end if;

  foreach m in array mention_ids
  loop
    if m is distinct from new.user_id then
      insert into public.notifications (user_id, task_id, type, title, body)
      values (
        m,
        new.task_id,
        'mention',
        'Упоминание в ' || coalesce(tk.ticket_number, 'задаче'),
        left(new.comment_text, 600)
      );
    end if;
  end loop;

  insert into public.notifications (user_id, task_id, type, title, body)
  select
    q.uid,
    new.task_id,
    'comment_added'::public.notification_type,
    'Новый комментарий к ' || coalesce(tk.ticket_number, 'задаче'),
    left(new.comment_text, 600)
  from (
    select distinct x.uid
    from (
      select tk.creator_id as uid
      union all
      select tk.assignee_id
      union all
      select h.user_id
      from public.task_helpers h
      where h.task_id = new.task_id
        and h.is_active
    ) x
    where x.uid is not null
  ) q
  where q.uid is distinct from new.user_id
    and not (q.uid = any (mention_ids));

  return new;
end;
$$;

commit;
