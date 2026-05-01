-- Fix infinite recursion in RLS policies on `tasks` ↔ `task_helpers` etc.
--
-- Root cause
-- ----------
-- `tasks_select` contained `EXISTS (SELECT 1 FROM task_helpers ...)`. When the
-- planner evaluated that subquery, Postgres applied `task_helpers_select`,
-- which itself did `EXISTS (SELECT 1 FROM tasks t ...)`. That triggered
-- `tasks_select` again — infinite recursion.
--
-- Fix
-- ---
-- Encapsulate the cross-table lookups in SECURITY DEFINER helper functions,
-- which bypass RLS on the inner tables. The policies then call those helpers
-- instead of embedding cross-table EXISTS queries. Semantics are preserved.

-- -----------------------------------------------------------------------------
-- 1. Helper functions (SECURITY DEFINER, STABLE, search_path=public)
-- -----------------------------------------------------------------------------

create or replace function public.is_active_helper_on_task(
  p_task_id bigint,
  p_user_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.task_helpers h
     where h.task_id = p_task_id
       and h.user_id = p_user_id
       and h.is_active
  );
$$;

comment on function public.is_active_helper_on_task(bigint, uuid) is
  'Returns true when user is an active helper on the task. SECURITY DEFINER to avoid RLS recursion with tasks <-> task_helpers.';

create or replace function public.can_access_task(p_task_id bigint)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.tasks t
     where t.id = p_task_id
       and (
         public.is_staff()
         or t.creator_id = (select auth.uid())
         or t.assignee_id = (select auth.uid())
         or (
           public.current_user_role() in ('specialist', 'developer')
           and t.status = 'needs_help'
         )
         or exists (
           select 1
             from public.task_helpers h
            where h.task_id = t.id
              and h.user_id = (select auth.uid())
              and h.is_active
         )
       )
  );
$$;

comment on function public.can_access_task(bigint) is
  'Returns true when the current user is allowed to SELECT the task per tasks_select rules. SECURITY DEFINER — mirrors tasks_select visibility without triggering RLS recursion from child tables.';

create or replace function public.is_task_stakeholder(
  p_task_id bigint,
  p_user_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.tasks t
     where t.id = p_task_id
       and (t.creator_id = p_user_id or t.assignee_id = p_user_id)
  );
$$;

comment on function public.is_task_stakeholder(bigint, uuid) is
  'Returns true when user is creator or assignee of the task. SECURITY DEFINER to avoid RLS recursion on task_tags_delete etc.';

grant execute on function public.is_active_helper_on_task(bigint, uuid) to authenticated;
grant execute on function public.can_access_task(bigint)                 to authenticated;
grant execute on function public.is_task_stakeholder(bigint, uuid)       to authenticated;

-- -----------------------------------------------------------------------------
-- 2. tasks — rewrite SELECT / UPDATE to use is_active_helper_on_task()
-- -----------------------------------------------------------------------------

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select
  using (
    (select public.is_staff())
    or creator_id = (select auth.uid())
    or assignee_id = (select auth.uid())
    or ((select public.current_user_role()) = 'specialist' and status = 'needs_help')
    or ((select public.current_user_role()) = 'developer'  and status = 'needs_help')
    or public.is_active_helper_on_task(id, (select auth.uid()))
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update
  using (
    (select public.is_staff())
    or assignee_id = (select auth.uid())
    or creator_id  = (select auth.uid())
    or public.is_active_helper_on_task(id, (select auth.uid()))
  )
  with check (
    (select public.is_staff())
    or assignee_id = (select auth.uid())
    or creator_id  = (select auth.uid())
    or public.is_active_helper_on_task(id, (select auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- 3. task_helpers — child-side visibility via can_access_task()
-- -----------------------------------------------------------------------------

drop policy if exists task_helpers_select on public.task_helpers;
create policy task_helpers_select on public.task_helpers
  for select
  using (public.can_access_task(task_id));

-- -----------------------------------------------------------------------------
-- 4. task_comments — same substitution
-- -----------------------------------------------------------------------------

drop policy if exists task_comments_select on public.task_comments;
create policy task_comments_select on public.task_comments
  for select
  using (public.can_access_task(task_id));

-- -----------------------------------------------------------------------------
-- 5. task_history
-- -----------------------------------------------------------------------------

drop policy if exists task_history_select on public.task_history;
create policy task_history_select on public.task_history
  for select
  using (
    (select public.current_user_role()) = 'admin'
    or public.can_access_task(task_id)
  );

-- -----------------------------------------------------------------------------
-- 6. task_tags — SELECT and DELETE
-- -----------------------------------------------------------------------------

drop policy if exists task_tags_select on public.task_tags;
create policy task_tags_select on public.task_tags
  for select
  using (public.can_access_task(task_id));

drop policy if exists task_tags_delete on public.task_tags;
create policy task_tags_delete on public.task_tags
  for delete
  using (
    (select public.is_staff())
    or public.is_task_stakeholder(task_id, (select auth.uid()))
  );
