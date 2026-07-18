-- Shared, source-backed vendor directory. Personal shortlist and booking data
-- remains in public.saved_vendors and is never exposed through this table.

create table public.vendor_directory (
  id uuid primary key default gen_random_uuid(),
  canonical_url text not null unique,
  name text not null check (char_length(name) between 1 and 300),
  category text,
  city text,
  address text,
  summary text,
  website text,
  maps_url text,
  contact_email text,
  contact_phone text,
  image_url text,
  services jsonb not null default '[]'::jsonb check (jsonb_typeof(services) = 'array'),
  source_url text not null,
  source_name text,
  source_excerpt text,
  verification_status text not null default 'source_backed'
    check (verification_status in ('source_backed', 'verified', 'needs_review')),
  is_published boolean not null default true,
  source_count integer not null default 1 check (source_count > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(category, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(city, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(address, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(services::text, '')), 'B')
  ) stored
);

create index vendor_directory_search_idx on public.vendor_directory using gin (search_vector);
create index vendor_directory_published_idx on public.vendor_directory (is_published, last_seen_at desc);
create index vendor_directory_city_category_idx on public.vendor_directory (city, category) where is_published;

create trigger vendor_directory_updated_at
  before update on public.vendor_directory
  for each row execute function public.set_updated_at();

create or replace function public.search_vendor_directory(
  p_query text,
  p_limit integer default 6
)
returns table (
  id uuid,
  name text,
  category text,
  city text,
  address text,
  summary text,
  website text,
  maps_url text,
  contact_email text,
  contact_phone text,
  image_url text,
  services jsonb,
  source_url text,
  source_name text,
  source_excerpt text,
  verification_status text,
  last_seen_at timestamptz,
  rank real
)
language sql
stable
set search_path = public
as $$
  with query as (
    select websearch_to_tsquery('simple', trim(p_query)) as tsq
  )
  select
    d.id, d.name, d.category, d.city, d.address, d.summary, d.website,
    d.maps_url, d.contact_email, d.contact_phone, d.image_url, d.services,
    d.source_url, d.source_name, d.source_excerpt, d.verification_status,
    d.last_seen_at, ts_rank_cd(d.search_vector, query.tsq, 32)::real as rank
  from public.vendor_directory d
  cross join query
  where d.is_published
    and d.search_vector @@ query.tsq
  order by rank desc, d.last_seen_at desc, d.name
  limit greatest(1, least(p_limit, 24));
$$;

alter table public.vendor_directory enable row level security;

grant select on public.vendor_directory to authenticated;
grant execute on function public.search_vendor_directory(text, integer) to authenticated, service_role;

create policy "authenticated users view published vendor directory"
  on public.vendor_directory for select to authenticated
  using (is_published);
