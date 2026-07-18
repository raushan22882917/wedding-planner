-- Every Razorpay Payment Link is first recorded on the server. The verified
-- webhook then looks up this immutable amount and entitlement instead of
-- trusting plan, user, or price values returned in Razorpay notes.
create table if not exists public.billing_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('coverage', 'usage_pack')),
  subscription_plan text check (subscription_plan in ('essential', 'signature')),
  usage_pack_id text check (usage_pack_id in ('ai_reply_pack', 'vendor_research_pack', 'availability_call')),
  wedding_count integer check (wedding_count between 1 and 10),
  coverage_ends_at date,
  expected_amount_paise integer not null check (expected_amount_paise > 0),
  provider_payment_link_id text unique,
  provider_short_url text,
  status text not null default 'created' check (status in ('created', 'paid', 'failed', 'expired')),
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'coverage'
      and subscription_plan is not null
      and usage_pack_id is null
      and wedding_count is not null
      and coverage_ends_at is not null)
    or
    (kind = 'usage_pack'
      and subscription_plan is null
      and usage_pack_id is not null
      and wedding_count is null
      and coverage_ends_at is null)
  )
);

create index if not exists billing_checkouts_user_status_idx
  on public.billing_checkouts (user_id, status, expires_at desc);

alter table public.billing_checkouts enable row level security;
revoke all on public.billing_checkouts from anon, authenticated;
grant all on public.billing_checkouts to service_role;

drop trigger if exists billing_checkouts_updated_at on public.billing_checkouts;
create trigger billing_checkouts_updated_at
  before update on public.billing_checkouts
  for each row execute function public.set_updated_at();
