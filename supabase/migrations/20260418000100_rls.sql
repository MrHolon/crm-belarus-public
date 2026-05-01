-- =============================================================================
-- 20260418000100_rls.sql
-- Row Level Security policies for all domain tables.
-- Source of truth: ТЗ/02-роли-и-права-доступа.md
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enable RLS on every domain table
-- -----------------------------------------------------------------------------
alter table public.users              enable row level security;
alter table public.problem_categories enable row level security;
alter table public.task_types         enable row level security;
alter table public.priorities         enable row level security;
alter table public.statuses           enable row level security;
alter table public.tags               enable row level security;
alter table public.tasks              enable row level security;
alter table public.task_history       enable row level security;
alter table public.task_comments      enable row level security;
alter table public.task_helpers       enable row level security;
alter table public.task_tags          enable row level security;
alter table public.task_templates     enable row level security;
alter table public.task_files         enable row level security;
alter table public.kb_articles        enable row level security;
alter table public.notifications      enable row level security;
alter table public.outgoing_webhooks  enable row level security;

-- -----------------------------------------------------------------------------
-- users
-- Any authenticated user can see active colleagues (for dropdowns); admin can
-- see everybody and change everything; users can only edit their own profile.
-- -----------------------------------------------------------------------------
create policy users_select_self_or_active
  on public.users for select
  to authenticated
  using (is_active or id = auth.uid() or public.current_user_role() = 'admin');

create policy users_update_self
  on public.users for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy users_admin_all
  on public.users for all
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- -----------------------------------------------------------------------------
-- Reference tables: everyone reads, manager/admin manage
-- -----------------------------------------------------------------------------
create policy problem_categories_select_any
  on public.problem_categories for select to authenticated using (true);

create policy problem_categories_manage
  on public.problem_categories for all to authenticated
  using (public.current_user_role() in ('manager', 'admin'))
  with check (public.current_user_role() in ('manager', 'admin'));

create policy task_types_select_any
  on public.task_types for select to authenticated using (true);

create policy task_types_manage
  on public.task_types for all to authenticated
  using (public.current_user_role() in ('manager', 'admin'))
  with check (public.current_user_role() in ('manager', 'admin'));

create policy priorities_select_any
  on public.priorities for select to authenticated using (true);

create policy priorities_manage
  on public.priorities for all to authenticated
  using (public.current_user_role() in ('manager', 'admin'))
  with check (public.current_user_role() in ('manager', 'admin'));

create policy statuses_select_any
  on public.statuses for select to authenticated using (true);

create policy statuses_manage
  on public.statuses for all to authenticated
  using (public.current_user_role() in ('manager', 'admin'))
  with check (public.current_user_role() in ('manager', 'admin'));

-- -----------------------------------------------------------------------------
-- tags — anyone authenticated reads and creates; creator/admin can delete
-- -----------------------------------------------------------------------------
create policy tags_select_any
  on public.tags for select to authenticated using (true);

create policy tags_insert_any
  on public.tags for insert to authenticated
  with check (auth.uid() is not null and (created_by = auth.uid() or created_by is null));

create policy tags_delete_own_or_staff
  on public.tags for delete to authenticated
  using (created_by = auth.uid() or public.current_user_role() in ('manager', 'admin'));

-- -----------------------------------------------------------------------------
-- tasks
-- -----------------------------------------------------------------------------
-- SELECT
create policy tasks_select_staff
  on public.tasks for select to authenticated
  using (public.is_staff());

create policy tasks_select_specialist_own
  on public.tasks for select to authenticated
  using (
    public.current_user_role() = 'specialist'
    and (assignee_id = auth.uid() or creator_id = auth.uid())
  );

create policy tasks_select_specialist_help_room
  on public.tasks for select to authenticated
  using (
    public.current_user_role() = 'specialist'
    and status = 'needs_help'
  );

create policy tasks_select_developer_own
  on public.tasks for select to authenticated
  using (
    public.current_user_role() = 'developer'
    and (assignee_id = auth.uid() or creator_id = auth.uid())
  );

create policy tasks_select_accountant_own
  on public.tasks for select to authenticated
  using (
    public.current_user_role() = 'accountant'
    and (assignee_id = auth.uid() or creator_id = auth.uid())
  );

create policy tasks_select_helper
  on public.tasks for select to authenticated
  using (
    exists (
      select 1 from public.task_helpers h
      where h.task_id = tasks.id
        and h.user_id = auth.uid()
        and h.is_active
    )
  );

-- INSERT
create policy tasks_insert_any_authenticated
  on public.tasks for insert to authenticated
  with check (
    auth.uid() is not null
    and creator_id = auth.uid()
  );

-- UPDATE
create policy tasks_update_staff
  on public.tasks for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy tasks_update_assignee_or_creator
  on public.tasks for update to authenticated
  using (assignee_id = auth.uid() or creator_id = auth.uid())
  with check (assignee_id = auth.uid() or creator_id = auth.uid());

-- DELETE
create policy tasks_delete_admin
  on public.tasks for delete to authenticated
  using (public.current_user_role() = 'admin');

create policy tasks_delete_creator_new_only
  on public.tasks for delete to authenticated
  using (
    creator_id = auth.uid()
    and status = 'new'
  );

-- -----------------------------------------------------------------------------
-- task_history — read if task is visible; writes only via trigger/admin
-- -----------------------------------------------------------------------------
create policy task_history_select_visible
  on public.task_history for select to authenticated
  using (
    exists (
      select 1 from public.tasks t where t.id = task_history.task_id
    )
  );

create policy task_history_admin_all
  on public.task_history for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- -----------------------------------------------------------------------------
-- task_comments
-- -----------------------------------------------------------------------------
create policy task_comments_select_visible
  on public.task_comments for select to authenticated
  using (
    exists (select 1 from public.tasks t where t.id = task_comments.task_id)
  );

create policy task_comments_insert_visible
  on public.task_comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.tasks t where t.id = task_comments.task_id)
  );

create policy task_comments_update_own
  on public.task_comments for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy task_comments_delete_own_or_admin
  on public.task_comments for delete to authenticated
  using (user_id = auth.uid() or public.current_user_role() = 'admin');

-- -----------------------------------------------------------------------------
-- task_helpers
-- -----------------------------------------------------------------------------
create policy task_helpers_select_visible
  on public.task_helpers for select to authenticated
  using (
    exists (select 1 from public.tasks t where t.id = task_helpers.task_id)
  );

create policy task_helpers_manage_staff
  on public.task_helpers for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy task_helpers_insert_by_task_party
  on public.task_helpers for insert to authenticated
  with check (
    added_by_user_id = auth.uid()
    and exists (
      select 1 from public.tasks t
      where t.id = task_helpers.task_id
        and (t.creator_id = auth.uid() or t.assignee_id = auth.uid())
    )
  );

create policy task_helpers_update_self
  on public.task_helpers for update to authenticated
  using (user_id = auth.uid() or added_by_user_id = auth.uid())
  with check (user_id = auth.uid() or added_by_user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- task_tags
-- -----------------------------------------------------------------------------
create policy task_tags_select_visible
  on public.task_tags for select to authenticated
  using (
    exists (select 1 from public.tasks t where t.id = task_tags.task_id)
  );

create policy task_tags_write_task_party
  on public.task_tags for all to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.tasks t
      where t.id = task_tags.task_id
        and (t.creator_id = auth.uid() or t.assignee_id = auth.uid())
    )
  )
  with check (
    public.is_staff()
    or exists (
      select 1 from public.tasks t
      where t.id = task_tags.task_id
        and (t.creator_id = auth.uid() or t.assignee_id = auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- task_templates
--   own or public → readable; owner can modify; manager/admin can modify public.
-- -----------------------------------------------------------------------------
create policy task_templates_select_own_or_public
  on public.task_templates for select to authenticated
  using (created_by = auth.uid() or is_public);

create policy task_templates_insert_self
  on public.task_templates for insert to authenticated
  with check (
    created_by = auth.uid()
    and (not is_public or public.current_user_role() in ('manager', 'admin'))
  );

create policy task_templates_update_owner_or_staff
  on public.task_templates for update to authenticated
  using (
    created_by = auth.uid()
    or (is_public and public.current_user_role() in ('manager', 'admin'))
  )
  with check (
    created_by = auth.uid()
    or (is_public and public.current_user_role() in ('manager', 'admin'))
  );

create policy task_templates_delete_owner_or_staff
  on public.task_templates for delete to authenticated
  using (
    created_by = auth.uid()
    or (is_public and public.current_user_role() in ('manager', 'admin'))
  );

-- -----------------------------------------------------------------------------
-- task_files (stub — table exists, UI disabled in MVP)
-- -----------------------------------------------------------------------------
create policy task_files_select_visible
  on public.task_files for select to authenticated
  using (
    exists (select 1 from public.tasks t where t.id = task_files.task_id)
  );

create policy task_files_insert_task_party
  on public.task_files for insert to authenticated
  with check (
    uploaded_by_user_id = auth.uid()
    and exists (
      select 1 from public.tasks t
      where t.id = task_files.task_id
        and (t.creator_id = auth.uid() or t.assignee_id = auth.uid() or public.is_staff())
    )
  );

create policy task_files_delete_own_or_admin
  on public.task_files for delete to authenticated
  using (uploaded_by_user_id = auth.uid() or public.current_user_role() = 'admin');

-- -----------------------------------------------------------------------------
-- kb_articles (stub in MVP, but reader visibility ready)
-- -----------------------------------------------------------------------------
create policy kb_articles_select_published_or_own
  on public.kb_articles for select to authenticated
  using (is_published or author_id = auth.uid() or public.current_user_role() in ('manager', 'admin'));

create policy kb_articles_manage_staff
  on public.kb_articles for all to authenticated
  using (public.current_user_role() in ('manager', 'admin'))
  with check (public.current_user_role() in ('manager', 'admin'));

create policy kb_articles_update_own
  on public.kb_articles for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- -----------------------------------------------------------------------------
-- notifications — user sees and manages only own notifications
-- -----------------------------------------------------------------------------
create policy notifications_select_own
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy notifications_update_own
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notifications_delete_own
  on public.notifications for delete to authenticated
  using (user_id = auth.uid());

create policy notifications_admin_all
  on public.notifications for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');
-- INSERT is intentionally NOT granted — notifications are created by server-side
-- logic (triggers, cron) running under service_role / table owner.

-- -----------------------------------------------------------------------------
-- outgoing_webhooks — admin only
-- -----------------------------------------------------------------------------
create policy outgoing_webhooks_admin_all
  on public.outgoing_webhooks for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');
