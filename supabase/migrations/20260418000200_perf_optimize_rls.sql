-- =============================================================================
-- 20260418000200_perf_optimize_rls.sql
-- Resolve Supabase performance advisor warnings:
--   * unindexed_foreign_keys  (INFO)
--   * auth_rls_initplan       (WARN) — wrap auth.*() calls in (select ...)
--   * multiple_permissive_policies (WARN) — consolidate policies per action
-- No change in semantics; this migration is purely a performance pass.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Missing foreign key indexes
-- -----------------------------------------------------------------------------
create index kb_articles_author_idx        on public.kb_articles (author_id);
create index kb_articles_category_idx      on public.kb_articles (category_id);
create index kb_articles_related_task_idx  on public.kb_articles (related_task_id);

create index notifications_task_idx        on public.notifications (task_id);

create index tags_created_by_idx           on public.tags (created_by);

create index task_comments_user_idx        on public.task_comments (user_id);

create index task_files_user_idx           on public.task_files (uploaded_by_user_id);

create index task_helpers_added_by_idx     on public.task_helpers (added_by_user_id);

create index task_history_user_idx         on public.task_history (user_id);

create index task_templates_category_idx   on public.task_templates (category_id);
create index task_templates_type_idx       on public.task_templates (task_type_id);

create index tasks_parent_idx              on public.tasks (parent_task_id);
create index tasks_rejected_by_idx         on public.tasks (rejected_by_id);
create index tasks_task_type_idx           on public.tasks (task_type_id);

-- -----------------------------------------------------------------------------
-- 2. Consolidate and optimize RLS policies.
-- We drop every existing policy and recreate one policy per (table, action).
-- All auth.*() calls are wrapped in scalar sub-selects so Postgres caches
-- them per-statement (InitPlan).
-- -----------------------------------------------------------------------------

-- ---- users -------------------------------------------------------------------
drop policy if exists users_select_self_or_active on public.users;
drop policy if exists users_update_self           on public.users;
drop policy if exists users_admin_all             on public.users;

create policy users_select on public.users for select to authenticated
  using (
    is_active
    or id = (select auth.uid())
    or (select public.current_user_role()) = 'admin'
  );

create policy users_insert_admin on public.users for insert to authenticated
  with check ((select public.current_user_role()) = 'admin');

create policy users_update on public.users for update to authenticated
  using (
    id = (select auth.uid())
    or (select public.current_user_role()) = 'admin'
  )
  with check (
    id = (select auth.uid())
    or (select public.current_user_role()) = 'admin'
  );

create policy users_delete_admin on public.users for delete to authenticated
  using ((select public.current_user_role()) = 'admin');

-- ---- reference tables --------------------------------------------------------
-- SELECT is always "any authenticated"; manage is manager/admin.
-- Collapse into one policy per action.
drop policy if exists problem_categories_select_any on public.problem_categories;
drop policy if exists problem_categories_manage     on public.problem_categories;
create policy problem_categories_select on public.problem_categories for select to authenticated using (true);
create policy problem_categories_insert on public.problem_categories for insert to authenticated
  with check ((select public.current_user_role()) in ('manager', 'admin'));
create policy problem_categories_update on public.problem_categories for update to authenticated
  using ((select public.current_user_role()) in ('manager', 'admin'))
  with check ((select public.current_user_role()) in ('manager', 'admin'));
create policy problem_categories_delete on public.problem_categories for delete to authenticated
  using ((select public.current_user_role()) in ('manager', 'admin'));

drop policy if exists task_types_select_any on public.task_types;
drop policy if exists task_types_manage     on public.task_types;
create policy task_types_select on public.task_types for select to authenticated using (true);
create policy task_types_insert on public.task_types for insert to authenticated
  with check ((select public.current_user_role()) in ('manager', 'admin'));
create policy task_types_update on public.task_types for update to authenticated
  using ((select public.current_user_role()) in ('manager', 'admin'))
  with check ((select public.current_user_role()) in ('manager', 'admin'));
create policy task_types_delete on public.task_types for delete to authenticated
  using ((select public.current_user_role()) in ('manager', 'admin'));

drop policy if exists priorities_select_any on public.priorities;
drop policy if exists priorities_manage     on public.priorities;
create policy priorities_select on public.priorities for select to authenticated using (true);
create policy priorities_insert on public.priorities for insert to authenticated
  with check ((select public.current_user_role()) in ('manager', 'admin'));
create policy priorities_update on public.priorities for update to authenticated
  using ((select public.current_user_role()) in ('manager', 'admin'))
  with check ((select public.current_user_role()) in ('manager', 'admin'));
create policy priorities_delete on public.priorities for delete to authenticated
  using ((select public.current_user_role()) in ('manager', 'admin'));

drop policy if exists statuses_select_any on public.statuses;
drop policy if exists statuses_manage     on public.statuses;
create policy statuses_select on public.statuses for select to authenticated using (true);
create policy statuses_insert on public.statuses for insert to authenticated
  with check ((select public.current_user_role()) in ('manager', 'admin'));
create policy statuses_update on public.statuses for update to authenticated
  using ((select public.current_user_role()) in ('manager', 'admin'))
  with check ((select public.current_user_role()) in ('manager', 'admin'));
create policy statuses_delete on public.statuses for delete to authenticated
  using ((select public.current_user_role()) in ('manager', 'admin'));

-- ---- tags --------------------------------------------------------------------
drop policy if exists tags_select_any            on public.tags;
drop policy if exists tags_insert_any            on public.tags;
drop policy if exists tags_delete_own_or_staff   on public.tags;

create policy tags_select on public.tags for select to authenticated using (true);
create policy tags_insert on public.tags for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and (created_by = (select auth.uid()) or created_by is null)
  );
create policy tags_delete on public.tags for delete to authenticated
  using (
    created_by = (select auth.uid())
    or (select public.current_user_role()) in ('manager', 'admin')
  );

-- ---- tasks -------------------------------------------------------------------
-- Merge the six SELECT policies into one, the two UPDATE policies into one,
-- and the two DELETE policies into one.
drop policy if exists tasks_select_staff                on public.tasks;
drop policy if exists tasks_select_specialist_own       on public.tasks;
drop policy if exists tasks_select_specialist_help_room on public.tasks;
drop policy if exists tasks_select_developer_own        on public.tasks;
drop policy if exists tasks_select_accountant_own       on public.tasks;
drop policy if exists tasks_select_helper               on public.tasks;
drop policy if exists tasks_insert_any_authenticated    on public.tasks;
drop policy if exists tasks_update_staff                on public.tasks;
drop policy if exists tasks_update_assignee_or_creator  on public.tasks;
drop policy if exists tasks_delete_admin                on public.tasks;
drop policy if exists tasks_delete_creator_new_only     on public.tasks;

create policy tasks_select on public.tasks for select to authenticated
  using (
    (select public.is_staff())
    or creator_id = (select auth.uid())
    or assignee_id = (select auth.uid())
    or (
      (select public.current_user_role()) = 'specialist'
      and status = 'needs_help'
    )
    or exists (
      select 1 from public.task_helpers h
      where h.task_id = tasks.id
        and h.user_id = (select auth.uid())
        and h.is_active
    )
  );

create policy tasks_insert on public.tasks for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and creator_id = (select auth.uid())
  );

create policy tasks_update on public.tasks for update to authenticated
  using (
    (select public.is_staff())
    or assignee_id = (select auth.uid())
    or creator_id = (select auth.uid())
  )
  with check (
    (select public.is_staff())
    or assignee_id = (select auth.uid())
    or creator_id = (select auth.uid())
  );

create policy tasks_delete on public.tasks for delete to authenticated
  using (
    (select public.current_user_role()) = 'admin'
    or (creator_id = (select auth.uid()) and status = 'new')
  );

-- ---- task_history ------------------------------------------------------------
drop policy if exists task_history_select_visible on public.task_history;
drop policy if exists task_history_admin_all      on public.task_history;

create policy task_history_select on public.task_history for select to authenticated
  using (
    (select public.current_user_role()) = 'admin'
    or exists (select 1 from public.tasks t where t.id = task_history.task_id)
  );
create policy task_history_admin_write on public.task_history for all to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

-- ---- task_comments -----------------------------------------------------------
drop policy if exists task_comments_select_visible       on public.task_comments;
drop policy if exists task_comments_insert_visible       on public.task_comments;
drop policy if exists task_comments_update_own           on public.task_comments;
drop policy if exists task_comments_delete_own_or_admin  on public.task_comments;

create policy task_comments_select on public.task_comments for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_comments.task_id));

create policy task_comments_insert on public.task_comments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.tasks t where t.id = task_comments.task_id)
  );

create policy task_comments_update on public.task_comments for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy task_comments_delete on public.task_comments for delete to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.current_user_role()) = 'admin'
  );

-- ---- task_helpers ------------------------------------------------------------
drop policy if exists task_helpers_select_visible        on public.task_helpers;
drop policy if exists task_helpers_manage_staff          on public.task_helpers;
drop policy if exists task_helpers_insert_by_task_party  on public.task_helpers;
drop policy if exists task_helpers_update_self           on public.task_helpers;

create policy task_helpers_select on public.task_helpers for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_helpers.task_id));

create policy task_helpers_insert on public.task_helpers for insert to authenticated
  with check (
    (select public.is_staff())
    or (
      added_by_user_id = (select auth.uid())
      and exists (
        select 1 from public.tasks t
        where t.id = task_helpers.task_id
          and (t.creator_id = (select auth.uid()) or t.assignee_id = (select auth.uid()))
      )
    )
  );

create policy task_helpers_update on public.task_helpers for update to authenticated
  using (
    (select public.is_staff())
    or user_id = (select auth.uid())
    or added_by_user_id = (select auth.uid())
  )
  with check (
    (select public.is_staff())
    or user_id = (select auth.uid())
    or added_by_user_id = (select auth.uid())
  );

create policy task_helpers_delete on public.task_helpers for delete to authenticated
  using ((select public.is_staff()));

-- ---- task_tags ---------------------------------------------------------------
drop policy if exists task_tags_select_visible    on public.task_tags;
drop policy if exists task_tags_write_task_party  on public.task_tags;

create policy task_tags_select on public.task_tags for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_tags.task_id));

create policy task_tags_insert on public.task_tags for insert to authenticated
  with check (
    (select public.is_staff())
    or exists (
      select 1 from public.tasks t
      where t.id = task_tags.task_id
        and (t.creator_id = (select auth.uid()) or t.assignee_id = (select auth.uid()))
    )
  );

create policy task_tags_delete on public.task_tags for delete to authenticated
  using (
    (select public.is_staff())
    or exists (
      select 1 from public.tasks t
      where t.id = task_tags.task_id
        and (t.creator_id = (select auth.uid()) or t.assignee_id = (select auth.uid()))
    )
  );

-- ---- task_templates ----------------------------------------------------------
drop policy if exists task_templates_select_own_or_public     on public.task_templates;
drop policy if exists task_templates_insert_self              on public.task_templates;
drop policy if exists task_templates_update_owner_or_staff    on public.task_templates;
drop policy if exists task_templates_delete_owner_or_staff    on public.task_templates;

create policy task_templates_select on public.task_templates for select to authenticated
  using (
    created_by = (select auth.uid())
    or is_public
  );

create policy task_templates_insert on public.task_templates for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (not is_public or (select public.current_user_role()) in ('manager', 'admin'))
  );

create policy task_templates_update on public.task_templates for update to authenticated
  using (
    created_by = (select auth.uid())
    or (is_public and (select public.current_user_role()) in ('manager', 'admin'))
  )
  with check (
    created_by = (select auth.uid())
    or (is_public and (select public.current_user_role()) in ('manager', 'admin'))
  );

create policy task_templates_delete on public.task_templates for delete to authenticated
  using (
    created_by = (select auth.uid())
    or (is_public and (select public.current_user_role()) in ('manager', 'admin'))
  );

-- ---- task_files (stub) -------------------------------------------------------
drop policy if exists task_files_select_visible       on public.task_files;
drop policy if exists task_files_insert_task_party    on public.task_files;
drop policy if exists task_files_delete_own_or_admin  on public.task_files;

create policy task_files_select on public.task_files for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_files.task_id));

create policy task_files_insert on public.task_files for insert to authenticated
  with check (
    uploaded_by_user_id = (select auth.uid())
    and exists (
      select 1 from public.tasks t
      where t.id = task_files.task_id
        and (
          t.creator_id = (select auth.uid())
          or t.assignee_id = (select auth.uid())
          or (select public.is_staff())
        )
    )
  );

create policy task_files_delete on public.task_files for delete to authenticated
  using (
    uploaded_by_user_id = (select auth.uid())
    or (select public.current_user_role()) = 'admin'
  );

-- ---- kb_articles (stub) ------------------------------------------------------
drop policy if exists kb_articles_select_published_or_own on public.kb_articles;
drop policy if exists kb_articles_manage_staff            on public.kb_articles;
drop policy if exists kb_articles_update_own              on public.kb_articles;

create policy kb_articles_select on public.kb_articles for select to authenticated
  using (
    is_published
    or author_id = (select auth.uid())
    or (select public.current_user_role()) in ('manager', 'admin')
  );

create policy kb_articles_insert on public.kb_articles for insert to authenticated
  with check (
    (select public.current_user_role()) in ('manager', 'admin')
    or author_id = (select auth.uid())
  );

create policy kb_articles_update on public.kb_articles for update to authenticated
  using (
    author_id = (select auth.uid())
    or (select public.current_user_role()) in ('manager', 'admin')
  )
  with check (
    author_id = (select auth.uid())
    or (select public.current_user_role()) in ('manager', 'admin')
  );

create policy kb_articles_delete on public.kb_articles for delete to authenticated
  using ((select public.current_user_role()) in ('manager', 'admin'));

-- ---- notifications -----------------------------------------------------------
drop policy if exists notifications_select_own  on public.notifications;
drop policy if exists notifications_update_own  on public.notifications;
drop policy if exists notifications_delete_own  on public.notifications;
drop policy if exists notifications_admin_all   on public.notifications;

create policy notifications_select on public.notifications for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.current_user_role()) = 'admin'
  );

create policy notifications_update on public.notifications for update to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.current_user_role()) = 'admin'
  )
  with check (
    user_id = (select auth.uid())
    or (select public.current_user_role()) = 'admin'
  );

create policy notifications_delete on public.notifications for delete to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.current_user_role()) = 'admin'
  );

-- No INSERT policy — notifications are created by triggers / service_role only.

-- ---- outgoing_webhooks -------------------------------------------------------
drop policy if exists outgoing_webhooks_admin_all on public.outgoing_webhooks;

create policy outgoing_webhooks_select on public.outgoing_webhooks for select to authenticated
  using ((select public.current_user_role()) = 'admin');
create policy outgoing_webhooks_insert on public.outgoing_webhooks for insert to authenticated
  with check ((select public.current_user_role()) = 'admin');
create policy outgoing_webhooks_update on public.outgoing_webhooks for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');
create policy outgoing_webhooks_delete on public.outgoing_webhooks for delete to authenticated
  using ((select public.current_user_role()) = 'admin');
