-- 20260418008000_task_comment_notifications.sql
-- B5: In-app notifications on new task comments (mentions + participants).

begin;

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
    'comment_added',
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

drop trigger if exists task_comments_notify on public.task_comments;

create trigger task_comments_notify
  after insert on public.task_comments
  for each row
  execute function public.notify_on_task_comment();

commit;
