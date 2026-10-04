-- Bulk admin actions: ban many accounts at once, delete many accounts at once.

-- 1) Ban or unban many users in one call (admins and the caller are skipped).
CREATE OR REPLACE FUNCTION public.admin_set_user_bans(_user_ids uuid[], _banned boolean)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
  v_count integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT array_agg(t.id) INTO v_ids
  FROM unnest(coalesce(_user_ids, '{}'::uuid[])) AS t(id)
  WHERE t.id IS NOT NULL
    AND t.id <> auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = t.id AND ur.role = 'admin');

  IF v_ids IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.profiles
     SET banned_at = CASE WHEN _banned THEN now() ELSE NULL END
   WHERE id = ANY(v_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- 2) Delete many accounts in one call (admins and the caller are skipped).
--    Deleting from auth.users cascades to profiles, payments and roles.
CREATE OR REPLACE FUNCTION public.admin_delete_users(_user_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
  v_count integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT array_agg(t.id) INTO v_ids
  FROM unnest(coalesce(_user_ids, '{}'::uuid[])) AS t(id)
  WHERE t.id IS NOT NULL
    AND t.id <> auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = t.id AND ur.role = 'admin');

  IF v_ids IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM auth.users u WHERE u.id = ANY(v_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- Lock execution down to signed-in admins only (checked inside each function).
REVOKE ALL ON FUNCTION public.admin_set_user_bans(uuid[], boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_delete_users(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_bans(uuid[], boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_users(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.admin_set_user_bans(uuid[], boolean) IS 'Bulk ban/unban for admins; skips admins and the caller.';
COMMENT ON FUNCTION public.admin_delete_users(uuid[]) IS 'Bulk account deletion for admins; skips admins and the caller.';