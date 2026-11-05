-- Market spaces: which numbered space on the market map each vendor has on each date, set on /admin/board.
-- A vendor booked for a date with no row here is waiting for a space. Safe to run more than once.
-- Paste into the Supabase SQL Editor and run.
create table if not exists public.market_spaces (
  event_date date not null,
  space_number integer not null check (space_number > 0),
  application_id uuid not null references public.vendor_applications (id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (event_date, space_number),
  unique (event_date, application_id)
);
alter table public.market_spaces enable row level security;

-- Applies several space changes for one date in a single transaction, so a swap can't trip the
-- unique constraints or stop halfway. p_changes is { application id: space number, or null to clear }.
create or replace function public.save_market_spaces(p_date date, p_changes jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from public.market_spaces
  where event_date = p_date
    and application_id in (select key::uuid from jsonb_each_text(p_changes));

  insert into public.market_spaces (event_date, space_number, application_id)
  select p_date, value::integer, key::uuid
  from jsonb_each_text(p_changes)
  where value is not null;
end;
$$;

revoke all on function public.save_market_spaces(date, jsonb) from public, anon, authenticated;
grant execute on function public.save_market_spaces(date, jsonb) to service_role;
grant select, insert, update, delete on public.market_spaces to service_role;

-- Lets the API see the new function right away.
notify pgrst, 'reload schema';
