-- Public wedding sites and the RSVP replies collected from them.
CREATE TABLE IF NOT EXISTS public.wedding_websites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title TEXT NOT NULL,
  welcome_message TEXT NOT NULL DEFAULT '',
  couple_story TEXT NOT NULL DEFAULT '',
  hero_image_url TEXT,
  card_design TEXT NOT NULL DEFAULT 'editorial' CHECK (card_design IN ('editorial', 'botanical', 'midnight')),
  ceremonies JSONB NOT NULL DEFAULT '[]'::jsonb,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wedding_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.wedding_websites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  response TEXT NOT NULL CHECK (response IN ('yes', 'no', 'maybe')),
  guest_count SMALLINT NOT NULL DEFAULT 1 CHECK (guest_count BETWEEN 1 AND 10),
  message TEXT,
  ceremonies JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wedding_websites TO authenticated;
GRANT SELECT ON public.wedding_websites TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wedding_rsvps TO authenticated;
GRANT SELECT, INSERT ON public.wedding_rsvps TO anon;
GRANT ALL ON public.wedding_websites, public.wedding_rsvps TO service_role;

ALTER TABLE public.wedding_websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wedding_rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners manage their wedding website" ON public.wedding_websites;
CREATE POLICY "owners manage their wedding website"
  ON public.wedding_websites FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "published wedding sites are public" ON public.wedding_websites;
CREATE POLICY "published wedding sites are public"
  ON public.wedding_websites FOR SELECT TO anon, authenticated
  USING (published = true);

DROP POLICY IF EXISTS "owners can read wedding RSVPs" ON public.wedding_rsvps;
CREATE POLICY "owners can read wedding RSVPs"
  ON public.wedding_rsvps FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.wedding_websites sites
    WHERE sites.id = website_id AND sites.user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "published wedding sites accept public RSVPs" ON public.wedding_rsvps;
CREATE POLICY "published wedding sites accept public RSVPs"
  ON public.wedding_rsvps FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.wedding_websites sites
    WHERE sites.id = website_id AND sites.published = true
  ));
DROP POLICY IF EXISTS "owners update wedding RSVPs" ON public.wedding_rsvps;
CREATE POLICY "owners update wedding RSVPs"
  ON public.wedding_rsvps FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.wedding_websites sites
    WHERE sites.id = website_id AND sites.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.wedding_websites sites
    WHERE sites.id = website_id AND sites.user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "owners delete wedding RSVPs" ON public.wedding_rsvps;
CREATE POLICY "owners delete wedding RSVPs"
  ON public.wedding_rsvps FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.wedding_websites sites
    WHERE sites.id = website_id AND sites.user_id = auth.uid()
  ));

DROP TRIGGER IF EXISTS wedding_websites_updated_at ON public.wedding_websites;
CREATE TRIGGER wedding_websites_updated_at BEFORE UPDATE ON public.wedding_websites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS wedding_rsvps_updated_at ON public.wedding_rsvps;
CREATE TRIGGER wedding_rsvps_updated_at BEFORE UPDATE ON public.wedding_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS wedding_rsvps_website_created_idx ON public.wedding_rsvps (website_id, created_at DESC);
