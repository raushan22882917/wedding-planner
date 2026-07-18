-- Couples can ask the MarryMap admin team for a bespoke wedding website or template.
CREATE TABLE IF NOT EXISTS public.website_custom_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  website_id UUID REFERENCES public.wedding_websites(id) ON DELETE SET NULL,
  request_title TEXT NOT NULL CHECK (char_length(request_title) BETWEEN 4 AND 120),
  brief TEXT NOT NULL CHECK (char_length(brief) BETWEEN 20 AND 2000),
  contact_preference TEXT NOT NULL DEFAULT 'email'
    CHECK (contact_preference IN ('email', 'phone', 'whatsapp')),
  contact_value TEXT NOT NULL CHECK (char_length(contact_value) BETWEEN 3 AND 200),
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_review', 'in_progress', 'completed')),
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS website_custom_requests_user_created_idx
  ON public.website_custom_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS website_custom_requests_status_created_idx
  ON public.website_custom_requests (status, created_at ASC);

GRANT SELECT, INSERT ON public.website_custom_requests TO authenticated;
GRANT ALL ON public.website_custom_requests TO service_role;

ALTER TABLE public.website_custom_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "couples read their website custom requests" ON public.website_custom_requests;
CREATE POLICY "couples read their website custom requests"
  ON public.website_custom_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "couples create website custom requests" ON public.website_custom_requests;
CREATE POLICY "couples create website custom requests"
  ON public.website_custom_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins manage website custom requests" ON public.website_custom_requests;
CREATE POLICY "admins manage website custom requests"
  ON public.website_custom_requests FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles roles
    WHERE roles.user_id = auth.uid() AND roles.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles roles
    WHERE roles.user_id = auth.uid() AND roles.role = 'admin'
  ));

DROP TRIGGER IF EXISTS website_custom_requests_updated_at ON public.website_custom_requests;
CREATE TRIGGER website_custom_requests_updated_at
  BEFORE UPDATE ON public.website_custom_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
