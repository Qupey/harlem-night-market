-- Vendor selection: which market dates and category each accepted vendor is assigned.
-- Safe to run more than once. Paste into the Supabase SQL Editor and run.
alter table public.vendor_applications add column if not exists assigned_dates date[] not null default '{}';
alter table public.vendor_applications add column if not exists market_category text;
