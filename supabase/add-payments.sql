-- Vendor fees: invite links, payment status and emails sent from /admin.
-- Safe to run more than once. Paste into the Supabase SQL Editor and run.
alter table public.vendor_applications add column if not exists invite_token text unique;
alter table public.vendor_applications add column if not exists invited_at timestamptz;
alter table public.vendor_applications add column if not exists reminder_sent_at timestamptz;
alter table public.vendor_applications add column if not exists paid boolean not null default false;
alter table public.vendor_applications add column if not exists amount_paid_cents integer;
alter table public.vendor_applications add column if not exists paid_at timestamptz;
alter table public.vendor_applications add column if not exists payment_id text;
alter table public.vendor_applications add column if not exists payment_method text;
alter table public.vendor_applications add column if not exists decline_emailed_at timestamptz;
