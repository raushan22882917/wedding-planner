-- Preserve every supported vendor-card field and make it searchable for
-- future couples using the shared source-backed directory.

alter table public.vendor_directory
  add column if not exists price text,
  add column if not exists capacity text;

-- PostgreSQL cannot alter a table-returning function's result shape in place.
drop function if exists public.search_vendor_directory(text, integer);

create function public.search_vendor_directory(
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
  price text,
  capacity text,
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
    d.id, d.name, d.category, d.city, d.address, d.summary, d.price,
    d.capacity, d.website, d.maps_url, d.contact_email, d.contact_phone,
    d.image_url, d.services, d.source_url, d.source_name, d.source_excerpt,
    d.verification_status, d.last_seen_at,
    ts_rank_cd(d.search_vector, query.tsq, 32)::real as rank
  from public.vendor_directory d
  cross join query
  where d.is_published
    and d.search_vector @@ query.tsq
  order by rank desc, d.last_seen_at desc, d.name
  limit greatest(1, least(p_limit, 24));
$$;

grant execute on function public.search_vendor_directory(text, integer) to authenticated, service_role;
