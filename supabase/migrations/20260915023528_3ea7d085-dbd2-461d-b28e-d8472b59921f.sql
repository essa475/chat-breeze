CREATE TABLE public.user_conversation_state (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  cleared_at timestamptz,
  hidden_at timestamptz,
  PRIMARY KEY (user_id, conversation_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_conversation_state TO authenticated;
GRANT ALL ON public.user_conversation_state TO service_role;

ALTER TABLE public.user_conversation_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ucs_select_own" ON public.user_conversation_state
FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ucs_insert_own" ON public.user_conversation_state
FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND private.is_member(conversation_id, auth.uid())
);
CREATE POLICY "ucs_update_own" ON public.user_conversation_state
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (
  user_id = auth.uid() AND private.is_member(conversation_id, auth.uid())
);
CREATE POLICY "ucs_delete_own" ON public.user_conversation_state
FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION private.create_group(_name text, _photo_url text, _member_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _me uuid := auth.uid();
  _conv uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF length(trim(coalesce(_name, ''))) = 0 THEN RAISE EXCEPTION 'group_name_required'; END IF;
  IF coalesce(array_length(_member_ids, 1), 0) = 0 THEN RAISE EXCEPTION 'group_members_required'; END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(_member_ids) member_id
    LEFT JOIN public.profiles p ON p.id = member_id
    WHERE p.id IS NULL OR member_id = _me
  ) THEN RAISE EXCEPTION 'invalid_group_member'; END IF;

  INSERT INTO public.conversations (is_group, name, photo_url, created_by)
  VALUES (true, trim(_name), _photo_url, _me)
  RETURNING id INTO _conv;

  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES (_conv, _me, 'admin');

  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  SELECT _conv, member_id, 'member'
  FROM (SELECT DISTINCT unnest(_member_ids) AS member_id) selected;

  RETURN _conv;
END;
$$;

REVOKE ALL ON FUNCTION private.create_group(text, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.create_group(text, text, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_group(_name text, _photo_url text, _member_ids uuid[])
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, private
AS $$ SELECT private.create_group(_name, _photo_url, _member_ids); $$;

REVOKE ALL ON FUNCTION public.create_group(text, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group(text, text, uuid[]) TO authenticated;