-- F1: Analytics RPCs for manager/admin (ТЗ/08 §8.1.7). SECURITY DEFINER bypasses RLS for aggregates.

begin;

create or replace function public.report_open_by_assignee(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  assignee_id uuid,
  full_name text,
  login text,
  open_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if (select public.current_user_role()) not in ('manager', 'admin') then
    raise exception 'analytics_forbidden';
  end if;

  return query
  select
    t.assignee_id,
    u.full_name,
    u.login,
    count(*)::bigint
  from public.tasks t
  inner join public.users u on u.id = t.assignee_id
  where t.status not in ('done', 'cancelled')
    and t.created_at >= p_from
    and t.created_at <= p_to
  group by t.assignee_id, u.full_name, u.login
  order by open_count desc, u.full_name;
end;
$$;

create or replace function public.report_overdue(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  task_id bigint,
  ticket_number text,
  title text,
  category_name text,
  assignee_name text,
  due_date timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if (select public.current_user_role()) not in ('manager', 'admin') then
    raise exception 'analytics_forbidden';
  end if;

  return query
  select
    t.id,
    t.ticket_number,
    t.title,
    c.name,
    coalesce(a.full_name, '—'),
    t.due_date
  from public.tasks t
  inner join public.problem_categories c on c.id = t.category_id
  left join public.users a on a.id = t.assignee_id
  where t.status not in ('done', 'cancelled')
    and t.due_date is not null
    and t.due_date < now()
    and t.due_date >= p_from
    and t.due_date <= p_to
  order by t.due_date asc;
end;
$$;

create or replace function public.report_avg_resolution(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  category_id bigint,
  category_name text,
  assignee_id uuid,
  assignee_name text,
  tasks_done bigint,
  avg_resolution_hours double precision
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if (select public.current_user_role()) not in ('manager', 'admin') then
    raise exception 'analytics_forbidden';
  end if;

  return query
  select
    c.id,
    c.name,
    u.id,
    u.full_name,
    count(*)::bigint,
    avg(extract(epoch from (t.completed_at - t.created_at)) / 3600.0)::double precision
  from public.tasks t
  inner join public.problem_categories c on c.id = t.category_id
  inner join public.users u on u.id = t.assignee_id
  where t.status = 'done'
    and t.completed_at is not null
    and t.completed_at >= p_from
    and t.completed_at <= p_to
  group by c.id, c.name, u.id, u.full_name
  having count(*) > 0
  order by avg_resolution_hours desc;
end;
$$;

create or replace function public.report_top_categories(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  category_id bigint,
  category_name text,
  task_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if (select public.current_user_role()) not in ('manager', 'admin') then
    raise exception 'analytics_forbidden';
  end if;

  return query
  select
    c.id,
    c.name,
    count(*)::bigint
  from public.tasks t
  inner join public.problem_categories c on c.id = t.category_id
  where t.created_at >= p_from
    and t.created_at <= p_to
  group by c.id, c.name
  order by task_count desc, c.name
  limit 50;
end;
$$;

create or replace function public.report_help_stats(
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  task_id bigint,
  ticket_number text,
  title text,
  assignee_name text,
  help_requested_at timestamptz,
  hours_in_needs_help double precision,
  active_helpers bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if (select public.current_user_role()) not in ('manager', 'admin') then
    raise exception 'analytics_forbidden';
  end if;

  return query
  select
    t.id,
    t.ticket_number,
    t.title,
    coalesce(a.full_name, '—'),
    t.help_requested_at,
    extract(
      epoch from (now() - t.help_requested_at)
    ) / 3600.0,
    (
      select count(*)::bigint
      from public.task_helpers h
      where h.task_id = t.id
        and h.is_active
    )
  from public.tasks t
  left join public.users a on a.id = t.assignee_id
  where t.status = 'needs_help'
    and t.help_requested_at is not null
    and t.help_requested_at >= p_from
    and t.help_requested_at <= p_to
  order by t.help_requested_at desc;
end;
$$;

revoke all on function public.report_open_by_assignee(timestamptz, timestamptz) from public;
revoke all on function public.report_overdue(timestamptz, timestamptz) from public;
revoke all on function public.report_avg_resolution(timestamptz, timestamptz) from public;
revoke all on function public.report_top_categories(timestamptz, timestamptz) from public;
revoke all on function public.report_help_stats(timestamptz, timestamptz) from public;

grant execute on function public.report_open_by_assignee(timestamptz, timestamptz) to authenticated;
grant execute on function public.report_overdue(timestamptz, timestamptz) to authenticated;
grant execute on function public.report_avg_resolution(timestamptz, timestamptz) to authenticated;
grant execute on function public.report_top_categories(timestamptz, timestamptz) to authenticated;
grant execute on function public.report_help_stats(timestamptz, timestamptz) to authenticated;

commit;
