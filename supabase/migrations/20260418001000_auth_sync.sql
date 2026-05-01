-- =============================================================================
-- 20260418001000_auth_sync.sql
-- Keep public.users in sync with auth.users:
--   * on sign-up (insert into auth.users) create a matching profile row
--   * on email change reflect it in public.users
-- Default role is 'specialist'; admins are elevated manually after signup.
-- full_name and login come from raw_user_meta_data, with sensible fallbacks.
-- =============================================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta       jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_fullname text  := coalesce(
                        nullif(trim(meta ->> 'full_name'), ''),
                        split_part(new.email, '@', 1)
                      );
  v_login    text  := coalesce(
                        nullif(trim(meta ->> 'login'), ''),
                        new.email
                      );
  v_role     public.user_role := coalesce(
                        (meta ->> 'role')::public.user_role,
                        'specialist'::public.user_role
                      );
begin
  insert into public.users (id, full_name, login, email, role)
  values (new.id, v_fullname, v_login, new.email, v_role)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Propagate email changes back to public.users.
create or replace function public.handle_auth_user_email_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.handle_auth_user_email_changed() from public;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_auth_user_email_changed();
