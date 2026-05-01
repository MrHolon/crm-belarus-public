-- =============================================================================
-- 20260418000150_harden_function_search_path.sql
-- Pin search_path on trigger/helper functions so they cannot be hijacked by
-- a role-local search_path. Resolves Supabase security advisor lint 0011.
-- =============================================================================

alter function public.set_updated_at()   set search_path = public;
alter function public.log_task_changes() set search_path = public;
alter function public.is_staff()         set search_path = public;
