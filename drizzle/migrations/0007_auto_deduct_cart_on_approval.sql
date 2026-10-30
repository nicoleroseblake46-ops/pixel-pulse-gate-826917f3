CREATE OR REPLACE FUNCTION public.approve_payment(_payment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.payments%ROWTYPE;
  cur_balance numeric;
  items jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  SELECT * INTO p FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF p.status = 'confirmed' THEN RETURN; END IF;
  IF p.status <> 'pending' THEN RAISE EXCEPTION 'Payment is not pending'; END IF;

  SELECT balance INTO cur_balance FROM public.profiles WHERE id = p.user_id FOR UPDATE;
  items := COALESCE(p.metadata->'cart_items', '[]'::jsonb);

  IF p.cart_total > 0 AND jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0
     AND COALESCE(cur_balance,0) + p.total_credit >= p.cart_total THEN
    -- Credit the deposit and immediately pay for the order placed with it
    UPDATE public.payments SET status = 'confirmed', confirmed_at = now(),
      metadata = p.metadata || jsonb_build_object('auto_deducted', p.cart_total)
    WHERE id = _payment_id;
    UPDATE public.profiles SET balance = balance + p.total_credit - p.cart_total WHERE id = p.user_id;
    DELETE FROM public.products pr USING jsonb_array_elements(items) AS it
    WHERE (it->>'id') LIKE 'cards-%' AND pr.category = 'cards'
      AND pr.id::text = substring(it->>'id' from 7);
  ELSE
    -- Not enough to cover the order: credit only, drop the unpaid order
    UPDATE public.payments SET status = 'confirmed', confirmed_at = now(),
      cart_total = 0,
      metadata = (p.metadata - 'cart_items') || CASE WHEN p.cart_total > 0
        THEN jsonb_build_object('unpaid_cart_items', items) ELSE '{}'::jsonb END
    WHERE id = _payment_id;
    UPDATE public.profiles SET balance = balance + p.total_credit WHERE id = p.user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_payment(_payment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.approve_payment(_payment_id);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_payment(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.confirm_payment(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.approve_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment(uuid) TO authenticated;