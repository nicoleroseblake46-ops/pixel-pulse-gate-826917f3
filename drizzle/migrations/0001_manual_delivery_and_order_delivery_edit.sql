ALTER TABLE public.products ADD COLUMN IF NOT EXISTS manual_delivery text;

CREATE OR REPLACE FUNCTION public.admin_set_order_delivery(_payment_id uuid, _item_index integer, _delivery text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec public.payments%ROWTYPE;
  items jsonb;
  item jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO rec FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  items := COALESCE(rec.metadata->'cart_items', '[]'::jsonb);
  IF jsonb_typeof(items) <> 'array' OR _item_index < 0 OR _item_index >= jsonb_array_length(items) THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  item := items->_item_index;
  item := jsonb_set(item, '{delivery}', to_jsonb(_delivery), true);
  items := jsonb_set(items, ARRAY[_item_index::text], item, true);

  UPDATE public.payments
     SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{cart_items}', items, true)
   WHERE id = _payment_id;

  RETURN items;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_order_delivery(uuid, integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_order_delivery(uuid, integer, text) TO authenticated;