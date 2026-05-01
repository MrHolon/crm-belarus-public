-- Default priority per category (maps to tasks.priority via priorities.code in the app layer).
alter table public.problem_categories
  add column default_priority_id bigint references public.priorities (id);

update public.problem_categories pc
set default_priority_id = p.id
from public.priorities p
where
  pc.default_priority_id is null
  and (
    (pc.severity = 'critical' and p.code = 'critical')
    or (pc.severity = 'important' and p.code = 'high')
    or (pc.severity = 'normal' and p.code = 'medium')
  );

comment on column public.problem_categories.default_priority_id is
  'Default priorities row for new tasks in this category; application maps priorities.code to tasks.priority enum.';

-- Tags: optional chip color + soft deactivation (references UI; on-the-fly tag creation unchanged).
alter table public.tags
  add column color text,
  add column is_active boolean not null default true;

comment on column public.tags.color is 'Optional CSS hex color for UI chips, e.g. #228be6.';
comment on column public.tags.is_active is 'When false, tag is hidden from pickers but kept for existing task_tags.';

-- Manager/admin can edit tag catalog (color, activation) without owning the row.
create policy tags_update on public.tags
  for update to authenticated
  using ((select public.current_user_role()) in ('manager', 'admin'))
  with check ((select public.current_user_role()) in ('manager', 'admin'));
