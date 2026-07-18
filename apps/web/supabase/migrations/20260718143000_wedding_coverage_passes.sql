-- A planning pass is priced for the exact active window rather than renewing
-- blindly each month. The paid webhook is the only writer for these fields.
alter table public.profiles
  add column if not exists subscription_wedding_count integer not null default 1
    check (subscription_wedding_count between 1 and 10),
  add column if not exists subscription_coverage_ends_at date;

-- Keep the quota gate aligned with the pass end date. Existing recurring
-- subscriptions have a NULL coverage end date and continue to work unchanged.
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
  v_coverage_ends_at date;
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

  select subscription_plan, subscription_status, subscription_coverage_ends_at
    into v_plan, v_status, v_coverage_ends_at
  from public.profiles where id = v_user_id for update;
  v_plan := coalesce(v_plan, 'free');
  if v_status <> 'active' or (v_coverage_ends_at is not null and v_coverage_ends_at < current_date) then
    v_plan := 'free';
  end if;
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
  v_coverage_ends_at date;
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

  select subscription_plan, subscription_status, subscription_coverage_ends_at
    into v_plan, v_status, v_coverage_ends_at
  from public.profiles where id = p_user_id for update;
  v_plan := coalesce(v_plan, 'free');
  if v_status <> 'active' or (v_coverage_ends_at is not null and v_coverage_ends_at < current_date) then
    v_plan := 'free';
  end if;
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
    select case
      when subscription_status = 'active'
        and (subscription_coverage_ends_at is null or subscription_coverage_ends_at >= current_date)
        then subscription_plan
      else 'free'
    end as plan
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
