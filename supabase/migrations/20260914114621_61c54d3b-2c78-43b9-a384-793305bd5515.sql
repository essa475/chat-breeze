
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_member(_conv uuid, _uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_members m WHERE m.conversation_id = _conv AND m.user_id = _uid);
$$;
CREATE OR REPLACE FUNCTION private.is_conv_admin(_conv uuid, _uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_members m WHERE m.conversation_id = _conv AND m.user_id = _uid AND m.role = 'admin');
$$;
REVOKE ALL ON FUNCTION private.is_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_conv_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_conv_admin(uuid, uuid) TO authenticated, service_role;

DROP POLICY "conv_select" ON public.conversations;
DROP POLICY "conv_update" ON public.conversations;
CREATE POLICY "conv_select" ON public.conversations FOR SELECT TO authenticated USING (private.is_member(id, auth.uid()));
CREATE POLICY "conv_update" ON public.conversations FOR UPDATE TO authenticated
  USING (private.is_conv_admin(id, auth.uid()) OR (NOT is_group AND private.is_member(id, auth.uid())))
  WITH CHECK (private.is_conv_admin(id, auth.uid()) OR (NOT is_group AND private.is_member(id, auth.uid())));

DROP POLICY "cm_select" ON public.conversation_members;
DROP POLICY "cm_insert" ON public.conversation_members;
DROP POLICY "cm_update" ON public.conversation_members;
DROP POLICY "cm_delete" ON public.conversation_members;
CREATE POLICY "cm_select" ON public.conversation_members FOR SELECT TO authenticated USING (private.is_member(conversation_id, auth.uid()));
CREATE POLICY "cm_insert" ON public.conversation_members FOR INSERT TO authenticated
  WITH CHECK (
    private.is_conv_admin(conversation_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.created_by = auth.uid())
  );
CREATE POLICY "cm_update" ON public.conversation_members FOR UPDATE TO authenticated
  USING (private.is_conv_admin(conversation_id, auth.uid())) WITH CHECK (private.is_conv_admin(conversation_id, auth.uid()));
CREATE POLICY "cm_delete" ON public.conversation_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR private.is_conv_admin(conversation_id, auth.uid()));

DROP POLICY "msg_select" ON public.messages;
DROP POLICY "msg_insert" ON public.messages;
CREATE POLICY "msg_select" ON public.messages FOR SELECT TO authenticated USING (private.is_member(conversation_id, auth.uid()));
CREATE POLICY "msg_insert" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND private.is_member(conversation_id, auth.uid()));

DROP POLICY "att_select" ON public.attachments;
CREATE POLICY "att_select" ON public.attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND private.is_member(m.conversation_id, auth.uid())));

DROP POLICY "react_select" ON public.message_reactions;
CREATE POLICY "react_select" ON public.message_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND private.is_member(m.conversation_id, auth.uid())));

DROP POLICY "receipt_select" ON public.message_receipts;
CREATE POLICY "receipt_select" ON public.message_receipts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND private.is_member(m.conversation_id, auth.uid())));

DROP FUNCTION public.is_member(uuid, uuid);
DROP FUNCTION public.is_conv_admin(uuid, uuid);

CREATE OR REPLACE FUNCTION private.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION private.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION private.bump_conversation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;

DROP TRIGGER profiles_touch ON public.profiles;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
DROP TRIGGER on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();
DROP TRIGGER messages_bump ON public.messages;
CREATE TRIGGER messages_bump AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION private.bump_conversation();
DROP FUNCTION public.touch_updated_at();
DROP FUNCTION public.handle_new_user();
DROP FUNCTION public.bump_conversation();

CREATE OR REPLACE FUNCTION private.start_direct_chat(_peer uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid();
        _conv uuid;
        _needs boolean;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _peer = _me THEN RAISE EXCEPTION 'cannot chat with yourself'; END IF;
  SELECT c.id INTO _conv FROM public.conversations c
  JOIN public.conversation_members a ON a.conversation_id = c.id AND a.user_id = _me
  JOIN public.conversation_members b ON b.conversation_id = c.id AND b.user_id = _peer
  WHERE c.is_group = false LIMIT 1;
  IF _conv IS NOT NULL THEN RETURN _conv; END IF;
  SELECT require_request INTO _needs FROM public.profiles WHERE id = _peer;
  IF COALESCE(_needs, false) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.chat_requests r
      WHERE r.status = 'accepted'
        AND ((r.from_user = _me AND r.to_user = _peer) OR (r.from_user = _peer AND r.to_user = _me))
    ) THEN RAISE EXCEPTION 'request_required'; END IF;
  END IF;
  INSERT INTO public.conversations (is_group, created_by) VALUES (false, _me) RETURNING id INTO _conv;
  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES (_conv, _me, 'admin'), (_conv, _peer, 'admin');
  RETURN _conv;
END; $$;
REVOKE ALL ON FUNCTION private.start_direct_chat(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.start_direct_chat(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.start_direct_chat(_peer uuid) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT private.start_direct_chat(_peer);
$$;
REVOKE ALL ON FUNCTION public.start_direct_chat(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_direct_chat(uuid) TO authenticated;
