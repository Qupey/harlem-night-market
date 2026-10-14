-- Adds the FAQ table used by the event page and /admin/faq.
-- Safe to run more than once. Paste into the Supabase SQL Editor and run.
create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null,
  question text not null,
  answer text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists faqs_event_idx on public.faqs (event_slug, position);
alter table public.faqs enable row level security;
