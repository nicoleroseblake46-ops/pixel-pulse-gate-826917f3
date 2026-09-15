CREATE OR REPLACE FUNCTION public.refresh_card_bases()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base_name text;
  codes text;
  validity int;
  inserted int := 0;
  batch int := 25 + floor(random() * 26)::int;
BEGIN
  -- Idempotent: one fresh base per day
  IF EXISTS (
    SELECT 1 FROM public.products
    WHERE category = 'cards' AND name LIKE to_char(now(), 'MMDD') || '-%'
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

  SELECT string_agg(cc, '-' ORDER BY cc) INTO codes
  FROM (
    SELECT DISTINCT upper(country_code) AS cc FROM _src
    WHERE country_code IS NOT NULL AND length(country_code) = 2
    LIMIT 5
  ) t;

  validity := 78 + floor(random() * 18)::int;
  base_name := to_char(now(), 'MMDD') || '-' || COALESCE(codes, 'MIX') || '-' || validity || '%valid';

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