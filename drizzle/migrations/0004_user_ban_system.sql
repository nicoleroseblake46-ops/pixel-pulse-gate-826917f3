ALTER TABLE public.profiles ADD COLUMN banned_at timestamptz;

CREATE OR REPLACE FUNCTION public.admin_set_user_ban(_user_id uuid, _banned boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_profile public.profiles%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF _user_id IS NULL THEN RAISE EXCEPTION 'User required'; END IF;
  IF public.has_role(_user_id, 'admin') THEN RAISE EXCEPTION 'Cannot ban an admin'; END IF;

  UPDATE public.profiles
     SET banned_at = CASE WHEN _banned THEN now() ELSE NULL END
   WHERE id = _user_id
  RETURNING * INTO target_profile;

  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

  RETURN jsonb_build_object(
    'user_id', target_profile.id,
    'username', target_profile.username,
    'banned', _banned
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_ban(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_ban(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.purchase_cart(_items jsonb, _cart_total numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
  current_balance numeric;
  user_banned_at timestamptz;
  order_id uuid;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT balance, banned_at INTO current_balance, user_banned_at
  FROM public.profiles
  WHERE id = current_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF user_banned_at IS NOT NULL THEN
    RAISE EXCEPTION 'Account suspended';
  END IF;

  IF _cart_total IS NULL OR _cart_total <= 0 THEN
    RAISE EXCEPTION 'Cart total must be greater than zero';
  END IF;

  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  IF current_balance < _cart_total THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.profiles
  SET balance = balance - _cart_total
  WHERE id = current_user_id;

  INSERT INTO public.payments (
    user_id, coin, amount, bonus_amount, cart_total, wallet_address,
    status, confirmed_at, total_credit, metadata
  ) VALUES (
    current_user_id, 'BALANCE', 0, 0, _cart_total, 'BALANCE_PURCHASE',
    'confirmed', now(), 0,
    jsonb_build_object('cart_items', _items, 'payment_method', 'balance')
  )
  RETURNING id INTO order_id;

  DELETE FROM public.products p
  USING jsonb_array_elements(_items) AS it
  WHERE (it->>'id') LIKE 'cards-%'
    AND p.category = 'cards'
    AND p.id::text = substring(it->>'id' from 7);

  RETURN order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.charge_checker_fee(_count integer, _price_per_check numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _user uuid := auth.uid();
  _total numeric;
  _new_balance numeric;
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _user AND banned_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Account suspended';
  END IF;
  IF _count IS NULL OR _count <= 0 THEN
    RAISE EXCEPTION 'Invalid count';
  END IF;
  IF _price_per_check IS NULL OR _price_per_check <= 0 THEN
    RAISE EXCEPTION 'Invalid price';
  END IF;

  _total := (_count::numeric) * _price_per_check;

  UPDATE public.profiles
     SET balance = balance - _total
   WHERE id = _user
     AND balance >= _total
  RETURNING balance INTO _new_balance;

  IF _new_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  RETURN _new_balance;
END;
$$;