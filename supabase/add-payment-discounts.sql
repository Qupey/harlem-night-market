-- Vendor fees: how much a Stripe promotion code took off a vendor's payment.
-- Safe to run more than once. Paste into the Supabase SQL Editor and run.
alter table public.vendor_applications add column if not exists amount_discount_cents integer;
