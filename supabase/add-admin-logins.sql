-- Individual admin logins (sign in at /admin/login). Safe to run more than once.
-- Paste into the Supabase SQL Editor and run. Until this has been run, the admin keeps using
-- the shared ADMIN_PASSWORD exactly as before.
--
-- Only the website's server (secret key) uses these tables: Row Level Security is on with no
-- policies, and the public "anon" and "authenticated" roles get no access at all. Only emails in
-- admin_users can sign in, and an owner adds them on /admin/team.

-- Admin accounts. password_hash is scrypt with a per-user salt; null until they set a password.
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  password_hash text,
  role text not null default 'admin' check (role in ('owner', 'admin')),
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);

-- Signed-in browsers. Only a SHA-256 hash of each session token is stored.
create table if not exists public.admin_sessions (
  token_hash text primary key,
  user_id uuid not null references public.admin_users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen timestamptz not null default now()
);
create index if not exists admin_sessions_user_idx on public.admin_sessions (user_id);

-- Single-use links for invites and password resets (24 hours). Stored hashed.
create table if not exists public.admin_tokens (
  token_hash text primary key,
  user_id uuid not null references public.admin_users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists admin_tokens_user_idx on public.admin_tokens (user_id);

-- Failed sign-in counters per email and per IP address, for the 15-minute lockout.
create table if not exists public.admin_login_attempts (
  key text primary key,
  count integer not null default 0,
  first_at timestamptz not null default now(),
  locked_until timestamptz
);

-- Admin settings, such as whether the shared password still works.
create table if not exists public.admin_settings (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);

-- Who changed what: status changes, invites, payments, deletes and team changes.
create table if not exists public.admin_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  admin_email text not null,
  action text not null,
  detail text not null default ''
);
create index if not exists admin_audit_at_idx on public.admin_audit (at desc);

do $$
declare t text;
begin
  foreach t in array array['admin_users', 'admin_sessions', 'admin_tokens', 'admin_login_attempts', 'admin_settings', 'admin_audit'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;
grant usage, select on all sequences in schema public to service_role;

-- Ask the API to see the new tables straight away.
notify pgrst, 'reload schema';
