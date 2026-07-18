-- Billing state is written only by the payment webhook/service role. Couples
-- retain access to their normal wedding-profile fields, but cannot self-upgrade
-- by updating a column through the public Supabase client.
alter table public.profiles
  add column if not exists subscription_plan text not null default 'free'
    check (subscription_plan in ('free', 'essential', 'signature')),
  add column if not exists subscription_status text not null default 'active'
    check (subscription_status in ('active', 'pending', 'past_due', 'cancelled', 'expired')),
  add column if not exists billing_provider text,
  add column if not exists billing_provider_subscription_id text,
  add column if not exists subscription_renews_at timestamptz;

create unique index if not exists profiles_billing_provider_subscription_id_key
  on public.profiles (billing_provider, billing_provider_subscription_id)
  where billing_provider_subscription_id is not null;

revoke update on public.profiles from authenticated;
grant update (
  partner_one, partner_two, wedding_date, venue, city, guest_count, budget_total,
  wedding_brief, onboarding_completed_at, research_consent_at
) on public.profiles to authenticated;

create table if not exists public.subscription_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature in ('ai_planner', 'vendor_research', 'whatsapp_send', 'voice_call')),
  units integer not null default 1 check (units > 0 and units <= 100),
  estimated_cost_paise integer not null default 0 check (estimated_cost_paise >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists subscription_usage_events_cycle_idx
  on public.subscription_usage_events (user_id, feature, created_at desc);

alter table public.subscription_usage_events enable row level security;
revoke all on public.subscription_usage_events from anon, authenticated;
grant all on public.subscription_usage_events to service_role;

create table if not exists public.subscription_usage_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature in ('ai_planner', 'vendor_research', 'whatsapp_send', 'voice_call')),
  units integer not null check (units > 0 and units <= 1_000),
  cycle_start date not null default date_trunc('month', now())::date,
  source_ref text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists subscription_usage_credits_cycle_idx
  on public.subscription_usage_credits (user_id, feature, cycle_start);

alter table public.subscription_usage_credits enable row level security;
revoke all on public.subscription_usage_credits from anon, authenticated;
grant all on public.subscription_usage_credits to service_role;

create or replace function public.subscription_feature_limit(p_plan text, p_feature text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_plan
    when 'essential' then case p_feature
      when 'ai_planner' then 120 when 'vendor_research' then 20 when 'whatsapp_send' then 60 when 'voice_call' then 0 else 0 end
    when 'signature' then case p_feature
      when 'ai_planner' then 400 when 'vendor_research' then 75 when 'whatsapp_send' then 250 when 'voice_call' then 10 else 0 end
    else case p_feature
      when 'ai_planner' then 8 when 'vendor_research' then 3 else 0 end
  end;
$$;

create or replace function public.subscription_estimated_cost_paise(p_feature text, p_units integer)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_feature
    when 'ai_planner' then 120 * p_units
    when 'vendor_research' then 1800 * p_units
    when 'whatsapp_send' then 0
    when 'voice_call' then 2500 * p_units
    else 0
  end;
$$;

create or replace function public.consume_subscription_quota(p_feature text, p_units integer default 1)
returns table (event_id uuid, allowed boolean, used_units integer, included_units integer, resets_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan text;
  v_status text;
  v_limit integer;
  v_used integer;
  v_event_id uuid;
  v_credits integer;
  v_cycle_start timestamptz := date_trunc('month', now());
  v_resets_at timestamptz := date_trunc('month', now()) + interval '1 month';
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_feature not in ('ai_planner', 'vendor_research', 'whatsapp_send', 'voice_call') then
    raise exception 'Unsupported subscription feature';
  end if;
  if p_units is null or p_units < 1 or p_units > 100 then raise exception 'Invalid usage amount'; end if;

  select subscription_plan, subscription_status into v_plan, v_status
  from public.profiles where id = v_user_id for update;
  v_plan := coalesce(v_plan, 'free');
  if v_status <> 'active' then v_plan := 'free'; end if;
  v_limit := public.subscription_feature_limit(v_plan, p_feature);
  select coalesce(sum(units), 0)::integer into v_credits
  from public.subscription_usage_credits
  where user_id = v_user_id and feature = p_feature and cycle_start = date_trunc('month', now())::date;
  v_limit := v_limit + v_credits;
  select coalesce(sum(units), 0)::integer into v_used
  from public.subscription_usage_events
  where user_id = v_user_id and feature = p_feature and created_at >= v_cycle_start;

  if v_used + p_units > v_limit then
    return query select null::uuid, false, v_used, v_limit, v_resets_at;
    return;
  end if;

  insert into public.subscription_usage_events (user_id, feature, units, estimated_cost_paise)
  values (v_user_id, p_feature, p_units, public.subscription_estimated_cost_paise(p_feature, p_units))
  returning id into v_event_id;
  return query select v_event_id, true, v_used + p_units, v_limit, v_resets_at;
end;
$$;

create or replace function public.finalize_ai_usage(
  p_event_id uuid,
  p_input_tokens integer,
  p_output_tokens integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost_paise integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_input_tokens < 0 or p_output_tokens < 0 then raise exception 'Invalid token usage'; end if;
  -- Gemini 3.5 Flash paid-rate estimate: $1.50 input / $9.00 output per 1M
  -- tokens, calculated at a conservative ₹90/USD. Provider billing remains
  -- authoritative; this exists to make the allowance economics auditable.
  v_cost_paise := ceil(((p_input_tokens * 1.5 + p_output_tokens * 9) / 1000000.0) * 90 * 100);
  update public.subscription_usage_events
  set estimated_cost_paise = greatest(v_cost_paise, 0),
      metadata = jsonb_build_object('input_tokens', p_input_tokens, 'output_tokens', p_output_tokens)
  where id = p_event_id and user_id = auth.uid() and feature = 'ai_planner';
end;
$$;

-- The API service uses a service-role key and therefore has no auth.uid().
-- This companion function keeps WhatsApp and telephony limits in the same
-- transaction-safe ledger without exposing an owner-id parameter to browsers.
create or replace function public.consume_subscription_quota_for_user(
  p_user_id uuid,
  p_feature text,
  p_units integer default 1
)
returns table (event_id uuid, allowed boolean, used_units integer, included_units integer, resets_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_status text;
  v_limit integer;
  v_used integer;
  v_event_id uuid;
  v_credits integer;
  v_cycle_start timestamptz := date_trunc('month', now());
  v_resets_at timestamptz := date_trunc('month', now()) + interval '1 month';
begin
  if p_user_id is null then raise exception 'User is required'; end if;
  if p_feature not in ('ai_planner', 'vendor_research', 'whatsapp_send', 'voice_call') then
    raise exception 'Unsupported subscription feature';
  end if;
  if p_units is null or p_units < 1 or p_units > 100 then raise exception 'Invalid usage amount'; end if;

  select subscription_plan, subscription_status into v_plan, v_status
  from public.profiles where id = p_user_id for update;
  v_plan := coalesce(v_plan, 'free');
  if v_status <> 'active' then v_plan := 'free'; end if;
  v_limit := public.subscription_feature_limit(v_plan, p_feature);
  select coalesce(sum(units), 0)::integer into v_credits
  from public.subscription_usage_credits
  where user_id = p_user_id and feature = p_feature and cycle_start = date_trunc('month', now())::date;
  v_limit := v_limit + v_credits;
  select coalesce(sum(units), 0)::integer into v_used
  from public.subscription_usage_events
  where user_id = p_user_id and feature = p_feature and created_at >= v_cycle_start;

  if v_used + p_units > v_limit then
    return query select null::uuid, false, v_used, v_limit, v_resets_at;
    return;
  end if;

  insert into public.subscription_usage_events (user_id, feature, units, estimated_cost_paise)
  values (p_user_id, p_feature, p_units, public.subscription_estimated_cost_paise(p_feature, p_units))
  returning id into v_event_id;
  return query select v_event_id, true, v_used + p_units, v_limit, v_resets_at;
end;
$$;

create or replace function public.get_subscription_usage()
returns table (feature text, used_units integer, included_units integer, estimated_cost_paise integer)
language sql
security definer
set search_path = public
as $$
  with current_plan as (
    select case when subscription_status = 'active' then subscription_plan else 'free' end as plan
    from public.profiles where id = auth.uid()
  ), features(feature) as (
    values ('ai_planner'::text), ('vendor_research'::text), ('whatsapp_send'::text), ('voice_call'::text)
  ), usage as (
    select feature, coalesce(sum(units), 0)::integer as used_units,
           coalesce(sum(estimated_cost_paise), 0)::integer as estimated_cost_paise
    from public.subscription_usage_events
    where user_id = auth.uid() and created_at >= date_trunc('month', now())
    group by feature
  ), credits as (
    select feature, coalesce(sum(units), 0)::integer as units
    from public.subscription_usage_credits
    where user_id = auth.uid() and cycle_start = date_trunc('month', now())::date
    group by feature
  )
  select features.feature,
         coalesce(usage.used_units, 0),
         public.subscription_feature_limit(coalesce(current_plan.plan, 'free'), features.feature) + coalesce(credits.units, 0),
         coalesce(usage.estimated_cost_paise, 0)
  from features
  left join usage using (feature)
  left join credits using (feature)
  left join current_plan on true
  order by array_position(array['ai_planner', 'vendor_research', 'whatsapp_send', 'voice_call'], features.feature);
$$;

revoke all on function public.consume_subscription_quota(text, integer) from public;
revoke all on function public.finalize_ai_usage(uuid, integer, integer) from public;
revoke all on function public.get_subscription_usage() from public;
revoke all on function public.consume_subscription_quota_for_user(uuid, text, integer) from public;
grant execute on function public.consume_subscription_quota(text, integer) to authenticated;
grant execute on function public.finalize_ai_usage(uuid, integer, integer) to authenticated;
grant execute on function public.get_subscription_usage() to authenticated;
grant execute on function public.consume_subscription_quota_for_user(uuid, text, integer) to service_role;

comment on table public.subscription_usage_events is
  'Append-only entitlement consumption. Direct client access is intentionally denied.';
