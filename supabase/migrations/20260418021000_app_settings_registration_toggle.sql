-- App-wide settings (single-row) with admin toggle for public registration.

begin;

-- ---- table ----------------------------------------------------------------
create table public.app_settings (
  id           boolean primary key default true,
  registration_enabled boolean not null default true,
  updated_at   timestamptz not null default now(),

  constraint app_settings_singleton check (id)
);

alter table public.app_settings enable row level security;

insert into public.app_settings (id, registration_enabled)
values (true, true);

-- ---- RLS ------------------------------------------------------------------
create policy app_settings_select
  on public.app_settings for select to authenticated, anon
  using (true);

create policy app_settings_update
  on public.app_settings for update to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

-- ---- auto-update timestamp ------------------------------------------------
create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- ---- block sign-up when registration is off -------------------------------
create or replace function public.guard_registration_enabled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.app_settings where registration_enabled
  ) then
    raise exception 'registration_disabled'
      using hint = 'Public registration is currently disabled by the administrator.';
  end if;
  return new;
end;
$$;

create trigger auth_guard_registration
  before insert on auth.users
  for each row
  execute function public.guard_registration_enabled();

-- ---- public RPC for the login page (no auth required) ---------------------
create or replace function public.is_registration_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select registration_enabled from public.app_settings limit 1),
    true
  );
$$;

grant execute on function public.is_registration_enabled() to anon, authenticated;

commit;
