DROP POLICY IF EXISTS "Anyone can read settings" ON public.app_settings;
CREATE POLICY "Signed-in users read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.app_settings FROM anon;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND cmd='SELECT' AND (qual ILIKE '%product-images%') LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', r.policyname);
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.confirm_payment(uuid) FROM PUBLIC, anon, authenticated;