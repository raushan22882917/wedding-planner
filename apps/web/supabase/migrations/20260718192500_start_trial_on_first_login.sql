-- Start the trial when a newly created account first uses the authenticated
-- app, rather than when the account record is created. Existing profiles stay
-- ineligible, so this is not a retroactive promotion.
alter table public.profiles
  add column if not exists subscription_trial_eligible boolean not null default false,
  add column if not exists subscription_trial_started_at timestamptz;

update public.profiles
set subscription_trial_started_at = coalesce(subscription_trial_started_at, created_at),
    subscription_trial_eligible = false
where billing_provider = 'trial';

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
    subscription_trial_eligible
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'partner_one', split_part(new.email, '@', 1)),
    'free',
    'active',
    true
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

create or replace function public.activate_my_subscription_trial()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  update public.profiles
  set subscription_plan = 'signature',
      subscription_status = 'active',
      billing_provider = 'trial',
      billing_provider_subscription_id = null,
      subscription_wedding_count = 1,
      subscription_coverage_ends_at = current_date + 13,
      subscription_renews_at = null,
      subscription_trial_started_at = now(),
      subscription_trial_eligible = false
  where id = v_user_id
    and subscription_trial_eligible = true
    and subscription_trial_started_at is null
    and subscription_plan = 'free';

  return found;
end;
$$;

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
      then coalesce(subscription_trial_started_at, created_at)
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

  perform public.activate_my_subscription_trial();
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

revoke all on function public.activate_my_subscription_trial() from public;
grant execute on function public.activate_my_subscription_trial() to authenticated;
notify pgrst, 'reload schema';
