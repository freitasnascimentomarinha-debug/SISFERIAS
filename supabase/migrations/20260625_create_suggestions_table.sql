CREATE TABLE IF NOT EXISTS public.suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_name text NOT NULL DEFAULT '',
  title text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS suggestions_created_at_idx
  ON public.suggestions (created_at DESC);

COMMENT ON TABLE public.suggestions IS 'Sugestoes enviadas pelos usuarios do sistema';
COMMENT ON COLUMN public.suggestions.user_id IS 'Usuario que enviou a sugestao';
COMMENT ON COLUMN public.suggestions.user_name IS 'Nome do usuario no momento do envio';
COMMENT ON COLUMN public.suggestions.title IS 'Titulo resumido da sugestao';
COMMENT ON COLUMN public.suggestions.description IS 'Descricao detalhada da sugestao';
COMMENT ON COLUMN public.suggestions.created_at IS 'Data e hora do envio';

NOTIFY pgrst, 'reload schema';