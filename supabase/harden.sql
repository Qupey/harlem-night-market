-- Security hardening: belt and braces on top of the other scripts. The website only talks to
-- Supabase with the secret (service role) key, so the public "anon" and "authenticated" roles
-- need no access at all. Safe to run more than once. Paste into the Supabase SQL Editor and run.

-- Row Level Security on every table in the public schema, so nothing is readable without a policy.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- No direct access for the public API roles, now or for tables and functions added later.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- The site's own functions stay callable by the server.
grant execute on all functions in schema public to service_role;

-- Vendor documents stay private: only the server can read them.
update storage.buckets set public = false where id = 'vendor-documents';
