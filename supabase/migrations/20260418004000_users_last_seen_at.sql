-- Last activity timestamp for admin user list (updated from the client on sign-in).
alter table public.users
  add column if not exists last_seen_at timestamptz;

comment on column public.users.last_seen_at is
  'Updated when the user signs in or restores a session (client). For display as recent activity.';
