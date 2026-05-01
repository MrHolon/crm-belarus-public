-- Fix: `log_task_changes` (AFTER UPDATE trigger on public.tasks) used to run
-- as the invoking user. RLS on `task_history` only allows INSERT for admins,
-- so any status/assignee/etc. change by a non-admin user (specialist,
-- duty_officer, developer, accountant, manager) failed with
--   new row violates row-level security policy for table "task_history"
-- blocking the lifecycle B3 -> B10 for everyone but admins.
--
-- Fix: mark the trigger SECURITY DEFINER. The trigger only runs after the
-- invoking user's UPDATE has already passed tasks RLS + enforce_task_status
-- _transition, so promoting the internal insert does not expose anything
-- the user couldn't already cause to be logged.

begin;

create or replace function public.log_task_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fields text[] := array[
    'assignee_id',
    'status',
    'priority',
    'complexity',
    'due_date',
    'category_id',
    'rejection_reason',
    'rejected_at',
    'rejected_by_id',
    'cancellation_reason',
    'cancelled_at'
  ];
  field  text;
  old_j  jsonb := to_jsonb(old);
  new_j  jsonb := to_jsonb(new);
  old_v  jsonb;
  new_v  jsonb;
begin
  foreach field in array fields loop
    old_v := old_j -> field;
    new_v := new_j -> field;
    if old_v is distinct from new_v then
      insert into public.task_history (task_id, user_id, field_name, old_value, new_value)
      values (new.id, (select auth.uid()), field, old_v, new_v);
    end if;
  end loop;
  return new;
end;
$$;

commit;
