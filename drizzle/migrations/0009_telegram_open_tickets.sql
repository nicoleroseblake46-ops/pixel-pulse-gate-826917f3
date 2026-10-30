CREATE TABLE public.telegram_open_tickets (chat_id bigint PRIMARY KEY, ticket_ref text, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.telegram_open_tickets TO service_role;
ALTER TABLE public.telegram_open_tickets ENABLE ROW LEVEL SECURITY;