CREATE POLICY status_media_insert_own ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'status-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY status_media_select_contacts ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'status-media' AND EXISTS (
    SELECT 1 FROM public.statuses s
    WHERE s.media_path = name
      AND (s.author_id = auth.uid() OR (s.expires_at > now() AND private.shares_conversation(auth.uid(), s.author_id)))
  )
);
CREATE POLICY status_media_delete_own ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'status-media' AND (storage.foldername(name))[1] = auth.uid()::text);