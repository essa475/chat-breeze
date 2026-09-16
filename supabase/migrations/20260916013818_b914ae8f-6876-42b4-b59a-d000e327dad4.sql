ALTER TABLE public.profiles ADD COLUMN last_seen_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION private.shares_conversation(_first uuid, _second uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_members a
    JOIN public.conversation_members b ON b.conversation_id = a.conversation_id
    WHERE a.user_id = _first AND b.user_id = _second
  );
$$;

CREATE OR REPLACE FUNCTION public.touch_presence()
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.profiles SET last_seen_at = now(), updated_at = now() WHERE id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.touch_presence() TO authenticated;

CREATE TABLE public.statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text,
  media_path text,
  media_type text,
  background text NOT NULL DEFAULT 'ink',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  CONSTRAINT status_has_content CHECK (body IS NOT NULL OR media_path IS NOT NULL),
  CONSTRAINT status_body_length CHECK (char_length(body) <= 700),
  CONSTRAINT status_background_valid CHECK (background IN ('ink', 'blue', 'green', 'red', 'violet'))
);
GRANT SELECT, INSERT, DELETE ON public.statuses TO authenticated;
GRANT ALL ON public.statuses TO service_role;
ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY status_select_contacts ON public.statuses FOR SELECT TO authenticated
USING (author_id = auth.uid() OR (expires_at > now() AND private.shares_conversation(auth.uid(), author_id)));
CREATE POLICY status_insert_own ON public.statuses FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid() AND expires_at <= now() + interval '24 hours 1 minute');
CREATE POLICY status_delete_own ON public.statuses FOR DELETE TO authenticated
USING (author_id = auth.uid());
CREATE INDEX statuses_active_idx ON public.statuses (expires_at DESC, created_at DESC);
CREATE INDEX statuses_author_idx ON public.statuses (author_id, created_at DESC);

CREATE TABLE public.status_views (
  status_id uuid NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (status_id, viewer_id)
);
GRANT SELECT, INSERT ON public.status_views TO authenticated;
GRANT ALL ON public.status_views TO service_role;
ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY status_views_select ON public.status_views FOR SELECT TO authenticated
USING (viewer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.statuses s WHERE s.id = status_id AND s.author_id = auth.uid()));
CREATE POLICY status_views_insert_own ON public.status_views FOR INSERT TO authenticated
WITH CHECK (viewer_id = auth.uid() AND EXISTS (SELECT 1 FROM public.statuses s WHERE s.id = status_id AND (s.author_id = auth.uid() OR private.shares_conversation(auth.uid(), s.author_id))));

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.statuses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.status_views;