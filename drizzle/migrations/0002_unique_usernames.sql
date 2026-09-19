-- 1. Fix any duplicate usernames that already exist (append short id suffix to later duplicates)
WITH ranked AS (
  SELECT id, username,
         row_number() OVER (PARTITION BY lower(trim(username)) ORDER BY created_at) AS rn
  FROM public.profiles
  WHERE username IS NOT NULL AND trim(username) <> ''
)
UPDATE public.profiles p
SET username = p.username || '_' || substr(replace(p.id::text, '-', ''), 1, 4)
FROM ranked r
WHERE p.id = r.id AND r.rn > 1;

-- 2. Enforce case-insensitive unique usernames
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
  ON public.profiles (lower(trim(username)))
  WHERE username IS NOT NULL AND trim(username) <> '';

-- 3. Auto-generate a unique username at signup if the chosen one is taken
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base text;
  candidate text;
  n int := 0;
BEGIN
  base := coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), split_part(new.email, '@', 1));
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(trim(username)) = lower(candidate)) LOOP
    n := n + 1;
    candidate := base || '_' || n;
  END LOOP;
  INSERT INTO public.profiles (id, username) VALUES (new.id, candidate);
  RETURN new;
END;
$$;