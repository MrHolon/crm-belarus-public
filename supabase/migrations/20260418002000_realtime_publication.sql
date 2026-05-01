-- =============================================================================
-- 20260418002000_realtime_publication.sql
-- Add domain tables to the supabase_realtime publication so the client can
-- subscribe to INSERT/UPDATE/DELETE events. Tables not listed here will
-- silently produce no realtime messages.
-- =============================================================================

alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.task_comments;
alter publication supabase_realtime add table public.task_history;
