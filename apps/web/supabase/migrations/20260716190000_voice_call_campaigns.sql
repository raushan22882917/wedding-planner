-- Consent-first outreach campaigns. Dograh credentials and call recordings
-- remain outside Supabase; this stores only the wedding brief and each user's
-- own call outcome so it can be reviewed and followed up in MarryMap.
create table public.voice_call_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Vendor availability calls',
  status text not null default 'active' check (status in ('active', 'completed', 'failed')),
  wedding_brief jsonb not null default '{}'::jsonb,
  target_count integer not null default 0 check (target_count >= 0),
  initiated_count integer not null default 0 check (initiated_count >= 0),
  completed_count integer not null default 0 check (completed_count >= 0),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.voice_call_runs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.voice_call_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vendor_id uuid references public.saved_vendors(id) on delete set null,
  recipient_name text not null,
  recipient_phone text not null,
  recipient_email text,
  status text not null default 'queued' check (status in ('queued', 'initiated', 'in_progress', 'completed', 'failed')),
  dograh_run_id bigint,
  initial_context jsonb not null default '{}'::jsonb,
  gathered_context jsonb not null default '{}'::jsonb,
  transcript_url text,
  recording_url text,
  error text,
  initiated_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, vendor_id)
);

grant select, insert, update, delete on public.voice_call_campaigns to authenticated;
grant select, insert, update, delete on public.voice_call_runs to authenticated;
grant all on public.voice_call_campaigns to service_role;
grant all on public.voice_call_runs to service_role;

alter table public.voice_call_campaigns enable row level security;
alter table public.voice_call_runs enable row level security;

create policy "own voice call campaigns" on public.voice_call_campaigns
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own voice call runs" on public.voice_call_runs
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index voice_call_campaigns_user_created_idx
  on public.voice_call_campaigns (user_id, created_at desc);
create index voice_call_runs_campaign_status_idx
  on public.voice_call_runs (campaign_id, status);
create index voice_call_runs_user_created_idx
  on public.voice_call_runs (user_id, created_at desc);

create trigger voice_call_campaigns_updated_at
  before update on public.voice_call_campaigns
  for each row execute function public.set_updated_at();
create trigger voice_call_runs_updated_at
  before update on public.voice_call_runs
  for each row execute function public.set_updated_at();
