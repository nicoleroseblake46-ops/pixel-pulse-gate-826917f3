CREATE OR REPLACE FUNCTION public.refresh_card_bases()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base_name text;
  validity int;
  inserted int := 0;
  batch int := 25 + floor(random() * 26)::int;
  pool text[] := ARRAY['PREMIUM MIX', 'GOLD BASE', 'FRESH MIX', 'ELITE BASE'];
BEGIN
  -- Idempotent: one fresh base per day (names now come from a small common pool)
  IF EXISTS (
    SELECT 1 FROM public.products
    WHERE category = 'cards'
      AND created_at::date = current_date
      AND name ~ '^(PREMIUM MIX|GOLD BASE|FRESH MIX|ELITE BASE)-[0-9]+%valid$'
  ) THEN
    RETURN 0;
  END IF;

  CREATE TEMP TABLE _src ON COMMIT DROP AS
    SELECT * FROM public.products
    WHERE category = 'cards' AND is_active AND full_card IS NOT NULL
    ORDER BY random() LIMIT batch;

  IF (SELECT count(*) FROM _src) = 0 THEN
    RETURN 0;
  END IF;

  validity := 78 + floor(random() * 18)::int;
  base_name := pool[1 + floor(random() * array_length(pool, 1))::int] || '-' || validity || '%valid';

  INSERT INTO public.products (
    category, name, meta, price, tag, sort_order, is_active,
    bin, country, country_code, state, city, zip, brand, card_type, bank,
    seller, exp, valid, scheme, level, extras, full_card, vendor_id, image_url, created_at
  )
  SELECT
    'cards'::product_category,
    base_name,
    s.meta,
    GREATEST(3, round((s.price * (0.85 + random() * 0.4))::numeric, 0)),
    s.tag,
    0,
    true,
    s.bin,
    s.country,
    s.country_code,
    s.state,
    s.city,
    s.zip,
    s.brand,
    s.card_type,
    s.bank,
    s.seller,
    lpad((1 + floor(random() * 12))::text, 2, '0') || '/' || (28 + floor(random() * 4))::text,
    validity || '%',
    s.scheme,
    s.level,
    s.extras,
    COALESCE(s.bin, left(regexp_replace(s.full_card, '\|.*$', ''), 6))
      || lpad(floor(random() * 1e10)::bigint::text, 10, '0')
      || '|' || lpad((1 + floor(random() * 12))::text, 2, '0') || '/' || (28 + floor(random() * 4))::text
      || '|' || lpad(floor(random() * 1000)::int::text, 3, '0'),
    s.vendor_id,
    s.image_url,
    now()
  FROM _src s;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_card_bases() FROM public, anon, authenticated;