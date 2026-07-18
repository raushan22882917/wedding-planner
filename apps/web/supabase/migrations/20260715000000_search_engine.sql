-- Agent Reach Search Engine: Supabase/Postgres schema (canonical workspace migration set).
-- Run with: supabase db push

create extension if not exists pgcrypto;

create type public.source_kind as enum ('web', 'rss', 'web_search', 'manual');
create type public.scrape_job_status as enum ('queued', 'running', 'completed', 'failed', 'cancelled');

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  kind public.source_kind not null,
  url text not null,
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  last_crawled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.search_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  source_id uuid references public.sources(id) on delete cascade,
  external_id text,
  url text not null,
  canonical_url text not null,
  title text not null,
  description text,
  content text not null,
  content_hash text not null,
  author text,
  language text,
  -- Text keeps this RPC compatible with the pre-existing remote search table,
  -- where published_at was stored as an ISO-8601 string.
  published_at text,
  metadata jsonb not null default '{}'::jsonb,
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(content, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint search_documents_owner_source_canonical_url_key unique nulls not distinct (owner_id, source_id, canonical_url)
);

create table public.scrape_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  source_id uuid not null references public.sources(id) on delete cascade,
  status public.scrape_job_status not null default 'queued',
  attempted_at timestamptz,
  completed_at timestamptz,
  documents_created integer not null default 0,
  documents_updated integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.search_queries (
  id bigint generated always as identity primary key,
  owner_id uuid not null,
  query text not null,
  result_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index sources_owner_idx on public.sources (owner_id, created_at desc);
create index search_documents_owner_idx on public.search_documents (owner_id, created_at desc);
create index search_documents_owner_source_idx on public.search_documents (owner_id, source_id);
create index search_documents_published_idx on public.search_documents (owner_id, published_at desc nulls last);
create index search_documents_search_idx on public.search_documents using gin (search_vector);
create index scrape_jobs_poll_idx on public.scrape_jobs (status, created_at) where status = 'queued';
create index scrape_jobs_owner_idx on public.scrape_jobs (owner_id, created_at desc);
create index search_queries_owner_idx on public.search_queries (owner_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sources_updated_at before update on public.sources for each row execute function public.set_updated_at();
create trigger search_documents_updated_at before update on public.search_documents for each row execute function public.set_updated_at();
create trigger scrape_jobs_updated_at before update on public.scrape_jobs for each row execute function public.set_updated_at();

-- Atomically claim one queued job. Multiple API instances can safely run workers.
create or replace function public.claim_scrape_job()
returns public.scrape_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.scrape_jobs;
begin
  with candidate as (
    select id from public.scrape_jobs
    where status = 'queued'
    order by created_at
    for update skip locked
    limit 1
  )
  update public.scrape_jobs j
  set status = 'running', attempted_at = now(), error = null
  from candidate
  where j.id = candidate.id
  returning j.* into claimed;
  return claimed;
end;
$$;

-- A legacy function with this signature may be present from an earlier search
-- schema. PostgreSQL cannot change a function's table return shape in place.
drop function if exists public.search_documents(uuid, text, integer, integer, uuid[], timestamptz, timestamptz);

-- Full-text search with weighted rank, safe web-style query parsing, snippets and filters.
create or replace function public.search_documents(
  p_owner_id uuid,
  p_query text,
  p_limit integer default 20,
  p_offset integer default 0,
  p_source_ids uuid[] default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  id uuid,
  source_id uuid,
  source_name text,
  title text,
  url text,
  canonical_url text,
  description text,
  snippet text,
  published_at text,
  rank real,
  total_count bigint
)
language sql
stable
set search_path = public
as $$
  with query as (
    select websearch_to_tsquery('simple', trim(p_query)) as tsq
  ), ranked as (
    select
      d.id, d.source_id, s.name as source_name, d.title, d.url, d.canonical_url,
      d.description, d.published_at::text as published_at,
      ts_headline('simple', d.content, query.tsq,
        'StartSel=<mark>, StopSel=</mark>, MaxWords=32, MinWords=12, ShortWord=2, MaxFragments=2, FragmentDelimiter= … ') as snippet,
      ts_rank_cd(d.search_vector, query.tsq, 32)::real as rank,
      count(*) over () as total_count
    from public.search_documents d
    left join public.sources s on s.id = d.source_id
    cross join query
    where d.owner_id = p_owner_id
      and d.search_vector @@ query.tsq
      and (p_source_ids is null or d.source_id = any(p_source_ids))
      -- ISO-8601 publication timestamps remain sortable as text and this also
      -- works when older installations use a text column instead of timestamptz.
      and (p_from is null or d.published_at::text >= p_from::text)
      and (p_to is null or d.published_at::text < (p_to + interval '1 day')::text)
  )
  select * from ranked
  order by rank desc, published_at desc nulls last, id
  limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset);
$$;

alter table public.sources enable row level security;
alter table public.search_documents enable row level security;
alter table public.scrape_jobs enable row level security;
alter table public.search_queries enable row level security;

create policy "owners manage sources" on public.sources for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners manage search documents" on public.search_documents for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners view jobs" on public.scrape_jobs for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners view search analytics" on public.search_queries for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

revoke all on function public.claim_scrape_job() from public;
grant execute on function public.search_documents(uuid, text, integer, integer, uuid[], timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.claim_scrape_job() to service_role;
