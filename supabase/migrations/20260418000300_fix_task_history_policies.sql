-- =============================================================================
-- 20260418000300_fix_task_history_policies.sql
-- Split the admin "FOR ALL" policy on task_history into per-action policies so
-- the SELECT policy isn't shadowed, removing the last multiple_permissive_
-- policies WARN from the Supabase performance advisor.
-- =============================================================================

drop policy if exists task_history_admin_write on public.task_history;

create policy task_history_insert_admin on public.task_history for insert to authenticated
  with check ((select public.current_user_role()) = 'admin');

create policy task_history_update_admin on public.task_history for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

create policy task_history_delete_admin on public.task_history for delete to authenticated
  using ((select public.current_user_role()) = 'admin');
