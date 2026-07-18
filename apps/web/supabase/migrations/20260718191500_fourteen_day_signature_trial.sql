-- New couples can use every MarryMap capability before paying. The trial is
-- granted only by the auth signup trigger, never by the browser, and ends at
-- the close of the fourteenth calendar day (today + 13 days).
--
-- Existing accounts are intentionally untouched: this avoids reopening an
-- expired pass or changing an already-paid subscription.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _role public.app_role;
begin
  insert into public.profiles (
    id,
    partner_one,
    subscription_plan,
    subscription_status,
    billing_provider,
    subscription_wedding_count,
    subscription_coverage_ends_at,
    subscription_renews_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'partner_one', split_part(new.email, '@', 1)),
    'signature',
    'active',
    'trial',
    1,
    current_date + 13,
    null
  )
  on conflict (id) do nothing;

  _role := coalesce(
    nullif(new.raw_user_meta_data->>'role', '')::public.app_role,
    'couple'::public.app_role
  );

  insert into public.user_roles (user_id, role)
  values (new.id, _role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

-- Trial usage is bounded across the full 14-day window, even when that window
-- crosses a calendar month. Paid and free accounts retain their monthly cycle.
create or replace function public.subscription_usage_window_start(p_user_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select case
    when billing_provider = 'trial'
      and subscription_status = 'active'
      and subscription_coverage_ends_at >= current_date
      then created_at
    else date_trunc('month', now())
  end
  from public.profiles
  where id = p_user_id;
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
  v_coverage_ends_at date;
  v_billing_provider text;
  v_limit integer;
  v_used integer;
  v_event_id uuid;
  v_credits integer;
  v_cycle_start timestamptz;
  v_resets_at timestamptz;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_feature not in ('ai_planner', 'vendor_research', 'whatsapp_send', 'voice_call') then
    raise exception 'Unsupported subscription feature';
  end if;
  if p_units is null or p_units < 1 or p_units > 100 then raise exception 'Invalid usage amount'; end if;

  select subscription_plan, subscription_status, subscription_coverage_ends_at, billing_provider
    into v_plan, v_status, v_coverage_ends_at, v_billing_provider
  from public.profiles where id = v_user_id for update;
  v_plan := coalesce(v_plan, 'free');
  if v_status <> 'active' or (v_coverage_ends_at is not null and v_coverage_ends_at < current_date) then
    v_plan := 'free';
  end if;
  v_cycle_start := coalesce(public.subscription_usage_window_start(v_user_id), date_trunc('month', now()));
  v_resets_at := case
    when v_billing_provider = 'trial' and v_status = 'active' and v_coverage_ends_at >= current_date
      then (v_coverage_ends_at + 1)::timestamptz
    else date_trunc('month', now()) + interval '1 month'
  end;
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
  v_billing_provider text;
  v_limit integer;
  v_used integer;
  v_event_id uuid;
  v_credits integer;
  v_cycle_start timestamptz;
  v_resets_at timestamptz;
begin
  if p_user_id is null then raise exception 'User is required'; end if;
  if p_feature not in ('ai_planner', 'vendor_research', 'whatsapp_send', 'voice_call') then
    raise exception 'Unsupported subscription feature';
  end if;
  if p_units is null or p_units < 1 or p_units > 100 then raise exception 'Invalid usage amount'; end if;

  select subscription_plan, subscription_status, subscription_coverage_ends_at, billing_provider
    into v_plan, v_status, v_coverage_ends_at, v_billing_provider
  from public.profiles where id = p_user_id for update;
  v_plan := coalesce(v_plan, 'free');
  if v_status <> 'active' or (v_coverage_ends_at is not null and v_coverage_ends_at < current_date) then
    v_plan := 'free';
  end if;
  v_cycle_start := coalesce(public.subscription_usage_window_start(p_user_id), date_trunc('month', now()));
  v_resets_at := case
    when v_billing_provider = 'trial' and v_status = 'active' and v_coverage_ends_at >= current_date
      then (v_coverage_ends_at + 1)::timestamptz
    else date_trunc('month', now()) + interval '1 month'
  end;
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
  with profile as (
    select
      case
        when subscription_status = 'active'
          and (subscription_coverage_ends_at is null or subscription_coverage_ends_at >= current_date)
          then subscription_plan
        else 'free'
      end as plan,
      public.subscription_usage_window_start(id) as cycle_start
    from public.profiles
    where id = auth.uid()
  ), features(feature) as (
    values ('ai_planner'::text), ('vendor_research'::text), ('whatsapp_send'::text), ('voice_call'::text)
  ), usage as (
    select event.feature, coalesce(sum(event.units), 0)::integer as used_units,
           coalesce(sum(event.estimated_cost_paise), 0)::integer as estimated_cost_paise
    from public.subscription_usage_events event
    cross join profile
    where event.user_id = auth.uid() and event.created_at >= profile.cycle_start
    group by event.feature
  ), credits as (
    select feature, coalesce(sum(units), 0)::integer as units
    from public.subscription_usage_credits
    where user_id = auth.uid() and cycle_start = date_trunc('month', now())::date
    group by feature
  )
  select features.feature,
         coalesce(usage.used_units, 0),
         public.subscription_feature_limit(coalesce(profile.plan, 'free'), features.feature) + coalesce(credits.units, 0),
         coalesce(usage.estimated_cost_paise, 0)
  from features
  left join usage using (feature)
  left join credits using (feature)
  left join profile on true
  order by array_position(array['ai_planner', 'vendor_research', 'whatsapp_send', 'voice_call'], features.feature);
$$;

revoke all on function public.subscription_usage_window_start(uuid) from public;
grant execute on function public.subscription_usage_window_start(uuid) to authenticated, service_role;
notify pgrst, 'reload schema';
