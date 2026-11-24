-- Updated invites and refunds (vendor fees). Safe to run more than once.
-- Paste into the Supabase SQL Editor and run. Until then the admin works as before, without the
-- "dates changed since invite" flag and the "Mark refunded" button.

-- The market dates the last invite email listed, to spot vendors whose dates changed since.
alter table public.vendor_applications add column if not exists invited_dates date[];

-- Refunds recorded on /admin after they've been made in Stripe (or paid back by hand).
alter table public.vendor_applications add column if not exists refunded_cents integer;
alter table public.vendor_applications add column if not exists refunded_at timestamptz;

notify pgrst, 'reload schema';
