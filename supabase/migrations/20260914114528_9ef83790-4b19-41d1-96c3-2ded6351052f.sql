
-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  username text UNIQUE,
  email text,
  phone text,
  dob date,
  avatar_url text,
  bio text,
  require_request boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CONVERSATIONS
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group boolean NOT NULL DEFAULT false,
  name text,
  photo_url text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.conversation_members (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE OR REPLACE FUNCTION public.is_member(_conv uuid, _uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_members m WHERE m.conversation_id = _conv AND m.user_id = _uid);
$$;
CREATE OR REPLACE FUNCTION public.is_conv_admin(_conv uuid, _uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_members m WHERE m.conversation_id = _conv AND m.user_id = _uid AND m.role = 'admin');
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conv_select" ON public.conversations FOR SELECT TO authenticated USING (public.is_member(id, auth.uid()));
CREATE POLICY "conv_insert" ON public.conversations FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "conv_update" ON public.conversations FOR UPDATE TO authenticated
  USING (public.is_conv_admin(id, auth.uid()) OR (NOT is_group AND public.is_member(id, auth.uid())))
  WITH CHECK (public.is_conv_admin(id, auth.uid()) OR (NOT is_group AND public.is_member(id, auth.uid())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_members TO authenticated;
GRANT ALL ON public.conversation_members TO service_role;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cm_select" ON public.conversation_members FOR SELECT TO authenticated USING (public.is_member(conversation_id, auth.uid()));
CREATE POLICY "cm_insert" ON public.conversation_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_conv_admin(conversation_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.created_by = auth.uid())
  );
CREATE POLICY "cm_update" ON public.conversation_members FOR UPDATE TO authenticated
  USING (public.is_conv_admin(conversation_id, auth.uid())) WITH CHECK (public.is_conv_admin(conversation_id, auth.uid()));
CREATE POLICY "cm_delete" ON public.conversation_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_conv_admin(conversation_id, auth.uid()));

-- MESSAGES
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text,
  reply_to uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  edited_at timestamptz,
  deleted_for_all boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conv_idx ON public.messages (conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg_select" ON public.messages FOR SELECT TO authenticated USING (public.is_member(conversation_id, auth.uid()));
CREATE POLICY "msg_insert" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND public.is_member(conversation_id, auth.uid()));
CREATE POLICY "msg_update_own" ON public.messages FOR UPDATE TO authenticated USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());
CREATE POLICY "msg_delete_own" ON public.messages FOR DELETE TO authenticated USING (sender_id = auth.uid());

CREATE OR REPLACE FUNCTION public.bump_conversation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER messages_bump AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.bump_conversation();

-- ATTACHMENTS
CREATE TABLE public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  url text NOT NULL,
  path text,
  name text NOT NULL,
  mime text,
  size bigint,
  kind text NOT NULL DEFAULT 'file',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "att_select" ON public.attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_member(m.conversation_id, auth.uid())));
CREATE POLICY "att_insert" ON public.attachments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND m.sender_id = auth.uid()));
CREATE POLICY "att_delete" ON public.attachments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND m.sender_id = auth.uid()));

-- REACTIONS
CREATE TABLE public.message_reactions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "react_select" ON public.message_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_member(m.conversation_id, auth.uid())));
CREATE POLICY "react_write" ON public.message_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "react_update" ON public.message_reactions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "react_delete" ON public.message_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- HIDDEN (delete for me)
CREATE TABLE public.message_hides (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.message_hides TO authenticated;
GRANT ALL ON public.message_hides TO service_role;
ALTER TABLE public.message_hides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hide_own" ON public.message_hides FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- RECEIPTS
CREATE TABLE public.message_receipts (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  PRIMARY KEY (message_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.message_receipts TO authenticated;
GRANT ALL ON public.message_receipts TO service_role;
ALTER TABLE public.message_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receipt_select" ON public.message_receipts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_member(m.conversation_id, auth.uid())));
CREATE POLICY "receipt_insert" ON public.message_receipts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "receipt_update" ON public.message_receipts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- CHAT REQUESTS
CREATE TABLE public.chat_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_user, to_user)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_requests TO authenticated;
GRANT ALL ON public.chat_requests TO service_role;
ALTER TABLE public.chat_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "req_select" ON public.chat_requests FOR SELECT TO authenticated USING (from_user = auth.uid() OR to_user = auth.uid());
CREATE POLICY "req_insert" ON public.chat_requests FOR INSERT TO authenticated WITH CHECK (from_user = auth.uid() AND to_user <> auth.uid());
CREATE POLICY "req_update" ON public.chat_requests FOR UPDATE TO authenticated USING (to_user = auth.uid()) WITH CHECK (to_user = auth.uid());
CREATE POLICY "req_delete" ON public.chat_requests FOR DELETE TO authenticated USING (from_user = auth.uid() OR to_user = auth.uid());

-- START A DIRECT CHAT
CREATE OR REPLACE FUNCTION public.start_direct_chat(_peer uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid();
        _conv uuid;
        _needs boolean;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _peer = _me THEN RAISE EXCEPTION 'cannot chat with yourself'; END IF;

  SELECT c.id INTO _conv
  FROM public.conversations c
  JOIN public.conversation_members a ON a.conversation_id = c.id AND a.user_id = _me
  JOIN public.conversation_members b ON b.conversation_id = c.id AND b.user_id = _peer
  WHERE c.is_group = false
  LIMIT 1;
  IF _conv IS NOT NULL THEN RETURN _conv; END IF;

  SELECT require_request INTO _needs FROM public.profiles WHERE id = _peer;
  IF COALESCE(_needs, false) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.chat_requests r
      WHERE r.status = 'accepted'
        AND ((r.from_user = _me AND r.to_user = _peer) OR (r.from_user = _peer AND r.to_user = _me))
    ) THEN
      RAISE EXCEPTION 'request_required';
    END IF;
  END IF;

  INSERT INTO public.conversations (is_group, created_by) VALUES (false, _me) RETURNING id INTO _conv;
  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES (_conv, _me, 'admin'), (_conv, _peer, 'admin');
  RETURN _conv;
END; $$;
GRANT EXECUTE ON FUNCTION public.start_direct_chat(uuid) TO authenticated;

-- REALTIME
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.message_receipts REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_members REPLICA IDENTITY FULL;
ALTER TABLE public.chat_requests REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_receipts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
