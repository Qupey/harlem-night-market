-- Harlem Night Market: vendor registration tables.
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste this file > Run.
-- Safe to run again; it only creates what's missing.
--
-- Table names follow the project spec so the admin dashboard can build on them.
-- Event dates are still configured in lib/events.ts, so preferences store the
-- date itself rather than a link to an event_dates table.

create extension if not exists pgcrypto;

create table if not exists public.vendor_applications (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null,
  contact_name text not null,
  business_name text not null,
  email text not null,
  phone text not null,
  instagram text,
  website text,
  business_address text,
  categories text[] not null default '{}',
  other_category text,
  product_details text,
  available_all_dates boolean not null default false,
  availability_notes text,
  setup_type text not null,
  setup_type_other text,
  needs_electricity boolean not null,
  needs_table boolean not null,
  needs_chairs boolean not null,
  setup_notes text,
  agreements jsonb not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'waitlisted', 'needs_info')),
  admin_notes text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Columns added after the first launch (for databases created before them).
alter table public.vendor_applications add column if not exists product_details text;
-- Vendor selection, set in /admin: assigned market dates and market category.
alter table public.vendor_applications add column if not exists assigned_dates date[] not null default '{}';
alter table public.vendor_applications add column if not exists market_category text;

create table if not exists public.vendor_date_preferences (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.vendor_applications (id) on delete cascade,
  event_date date not null,
  rank smallint not null check (rank between 1 and 3),
  unique (application_id, rank)
);

create table if not exists public.food_vendor_details (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.vendor_applications (id) on delete cascade,
  food_types text[] not null default '{}',
  other_food_type text,
  has_food_handler_license text check (has_food_handler_license in ('yes', 'no', 'in_progress')),
  license_number text,
  license_expiration date
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.vendor_applications (id) on delete cascade,
  position smallint not null default 0,
  name text not null,
  description text,
  price text,
  dietary_tags text[] not null default '{}'
);

create table if not exists public.uploaded_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.vendor_applications (id) on delete cascade,
  document_type text not null
    check (document_type in ('food_handler_license', 'doh_permit', 'insurance', 'logo', 'product_image', 'other')),
  file_path text not null, -- path inside the vendor-documents storage bucket
  file_name text not null, -- original name the vendor uploaded
  content_type text,
  size_bytes integer,
  uploaded_at timestamptz not null default now(),
  verified boolean not null default false,
  verified_by text,
  verified_at timestamptz
);

create index if not exists vendor_applications_event_idx on public.vendor_applications (event_slug, submitted_at desc);
create index if not exists vendor_date_preferences_app_idx on public.vendor_date_preferences (application_id);
create index if not exists menu_items_app_idx on public.menu_items (application_id);
create index if not exists uploaded_documents_app_idx on public.uploaded_documents (application_id);

-- Row Level Security on, with no policies: the public website key can't read or
-- write these tables. Only the website's server, using the secret key, can.
alter table public.vendor_applications enable row level security;
alter table public.vendor_date_preferences enable row level security;
alter table public.food_vendor_details enable row level security;
alter table public.menu_items enable row level security;
alter table public.uploaded_documents enable row level security;

-- Saves one whole application in a single transaction, so a failed submission
-- never leaves half an application behind.
create or replace function public.submit_vendor_application(app jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  new_id uuid := coalesce((app->>'id')::uuid, gen_random_uuid());
begin
  insert into vendor_applications (
    id, event_slug, contact_name, business_name, email, phone, instagram, website,
    business_address, categories, other_category, product_details, available_all_dates, availability_notes,
    setup_type, setup_type_other, needs_electricity, needs_table, needs_chairs, setup_notes, agreements
  ) values (
    new_id, app->>'event_slug', app->>'contact_name', app->>'business_name', app->>'email',
    app->>'phone', app->>'instagram', app->>'website', app->>'business_address',
    array(select jsonb_array_elements_text(coalesce(app->'categories', '[]'))),
    app->>'other_category', app->>'product_details', coalesce((app->>'available_all_dates')::boolean, false),
    app->>'availability_notes', app->>'setup_type', app->>'setup_type_other',
    (app->>'needs_electricity')::boolean, (app->>'needs_table')::boolean,
    (app->>'needs_chairs')::boolean, app->>'setup_notes', coalesce(app->'agreements', '{}')
  );

  insert into vendor_date_preferences (application_id, event_date, rank)
  select new_id, (p->>'event_date')::date, (p->>'rank')::smallint
  from jsonb_array_elements(coalesce(app->'date_preferences', '[]')) p;

  if app->'food' is not null and app->'food' <> 'null'::jsonb then
    insert into food_vendor_details (
      application_id, food_types, other_food_type, has_food_handler_license, license_number, license_expiration
    ) values (
      new_id,
      array(select jsonb_array_elements_text(coalesce(app->'food'->'food_types', '[]'))),
      app->'food'->>'other_food_type',
      app->'food'->>'has_food_handler_license',
      app->'food'->>'license_number',
      nullif(app->'food'->>'license_expiration', '')::date
    );
  end if;

  insert into menu_items (application_id, position, name, description, price, dietary_tags)
  select new_id, (m.ord - 1)::smallint, m.item->>'name', m.item->>'description', m.item->>'price',
         array(select jsonb_array_elements_text(coalesce(m.item->'dietary_tags', '[]')))
  from jsonb_array_elements(coalesce(app->'menu_items', '[]')) with ordinality as m(item, ord);

  insert into uploaded_documents (application_id, document_type, file_path, file_name, content_type, size_bytes)
  select new_id, d->>'document_type', d->>'file_path', d->>'file_name', d->>'content_type', (d->>'size_bytes')::integer
  from jsonb_array_elements(coalesce(app->'documents', '[]')) d;

  return new_id;
end;
$$;

-- Only the server (secret key) may call it.
revoke execute on function public.submit_vendor_application(jsonb) from public, anon, authenticated;
grant execute on function public.submit_vendor_application(jsonb) to service_role;

-- FAQ shown on the event page, managed at /admin/faq.
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

-- Private bucket for licenses, permits, logos and product photos (10 MB per file).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vendor-documents', 'vendor-documents', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif', 'application/pdf']
)
on conflict (id) do nothing;
