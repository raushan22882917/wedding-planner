-- Store the structured planning brief collected after a couple signs up. The
-- operational fields remain on profiles so existing dashboard queries stay fast.
alter table public.profiles
  add column if not exists wedding_brief jsonb not null default '{}'::jsonb,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists research_consent_at timestamptz;

comment on column public.profiles.wedding_brief is
  'Couple-provided planning preferences: traditions, ceremonies, style, priorities, and family notes.';
comment on column public.profiles.research_consent_at is
  'When the couple authorised public-source vendor research. This does not authorise outreach or booking.';
