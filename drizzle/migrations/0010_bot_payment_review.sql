CREATE OR REPLACE FUNCTION public.bot_review_payment(_payment_id uuid, _approve boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE admin_id uuid; st text;
BEGIN
  SELECT user_id INTO admin_id FROM public.user_roles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  IF admin_id IS NULL THEN RAISE EXCEPTION 'No admin'; END IF;
  SELECT status INTO st FROM public.payments WHERE id = _payment_id;
  IF st IS NULL THEN RETURN 'missing'; END IF;
  IF st <> 'pending' THEN RETURN st; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  IF _approve THEN PERFORM public.approve_payment(_payment_id); ELSE PERFORM public.reject_payment(_payment_id); END IF;
  RETURN CASE WHEN _approve THEN 'confirmed' ELSE 'rejected' END;
END $$;
REVOKE ALL ON FUNCTION public.bot_review_payment(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_review_payment(uuid, boolean) TO service_role;