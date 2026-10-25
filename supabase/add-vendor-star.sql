-- Vendor star: organizers like this vendor but haven't decided where to place them.
-- Safe to run more than once. Paste into the Supabase SQL Editor and run.
alter table public.vendor_applications add column if not exists starred boolean not null default false;
