-- Market capacity: how many vendors fit at each market date, set on /admin/board.
-- A date with no row has no limit. Safe to run more than once. Paste into the Supabase SQL Editor and run.
create table if not exists public.market_capacity (
  event_date date primary key,
  capacity integer not null check (capacity > 0),
  updated_at timestamptz not null default now()
);
alter table public.market_capacity enable row level security;
