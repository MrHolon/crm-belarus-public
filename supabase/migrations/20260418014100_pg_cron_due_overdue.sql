-- E3: Schedule due_soon / overdue notification sweep (ТЗ/06 §6.3–6.4).
-- Requires pg_cron (bundled with Supabase Postgres). Safe no-op if extension missing.

begin;

do $ext$
begin
  create extension if not exists pg_cron with schema extensions;
exception
  when duplicate_object then
    null;
end;
$ext$;

do $sched$
declare
  r record;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron not installed: skip scheduling notify_due_soon / notify_overdue';
    return;
  end if;

  begin
    for r in
      select jobid from cron.job where jobname in ('crm-notify-due-soon', 'crm-notify-overdue')
    loop
      perform cron.unschedule(r.jobid);
    end loop;
  exception
    when undefined_table then
      raise notice 'cron.job missing: skip unschedule';
    when undefined_column then
      raise notice 'cron.job.jobname missing: skip unschedule';
  end;

  perform cron.schedule(
    'crm-notify-due-soon',
    '0 * * * *',
    $$select public.notify_due_soon()$$
  );
  perform cron.schedule(
    'crm-notify-overdue',
    '5 * * * *',
    $$select public.notify_overdue()$$
  );
exception
  when undefined_function then
    raise notice 'cron.schedule unavailable: %', sqlerrm;
  when others then
    raise notice 'pg_cron schedule skipped: %', sqlerrm;
end;
$sched$;

commit;
