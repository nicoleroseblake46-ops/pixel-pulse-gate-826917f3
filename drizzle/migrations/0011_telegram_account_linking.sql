CREATE TABLE public.telegram_account_links (chat_id bigint PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE, linked_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.telegram_account_links TO service_role;
ALTER TABLE public.telegram_account_links ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.telegram_link_tokens (token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
GRANT ALL ON public.telegram_link_tokens TO service_role;
ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.consume_telegram_link(_token_hash text, _chat_id bigint) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE linked_user uuid;
BEGIN
DELETE FROM public.telegram_link_tokens WHERE token_hash = _token_hash AND expires_at > now() RETURNING user_id INTO linked_user;
IF linked_user IS NULL THEN RETURN NULL; END IF;
DELETE FROM public.telegram_account_links WHERE user_id = linked_user OR chat_id = _chat_id;
INSERT INTO public.telegram_account_links(chat_id, user_id) VALUES (_chat_id, linked_user);
RETURN linked_user;
END; $$;
REVOKE ALL ON FUNCTION public.consume_telegram_link(text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_telegram_link(text, bigint) TO service_role;