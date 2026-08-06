CREATE TABLE IF NOT EXISTS public.print_preferences (
  user_id uuid PRIMARY KEY,
  phone text NOT NULL DEFAULT '',
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  encarregado jsonb NOT NULL DEFAULT '{}'::jsonb,
  encarregado_dep jsonb NOT NULL DEFAULT '{}'::jsonb,
  vice_diretor jsonb NOT NULL DEFAULT '{}'::jsonb,
  diretor jsonb NOT NULL DEFAULT '{}'::jsonb,
  observations text NOT NULL DEFAULT '',
  ship text NOT NULL DEFAULT 'CENTRO DE OPERACOES DO ABASTECIMENTO',
  specialization text NOT NULL DEFAULT 'PL',
  lic_time text NOT NULL DEFAULT '16:10',
  apr_time text NOT NULL DEFAULT '07:30',
  is_desmuniciado text NOT NULL DEFAULT 'sim',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_print_preferences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_print_preferences_updated_at ON public.print_preferences;
CREATE TRIGGER trg_print_preferences_updated_at
BEFORE UPDATE ON public.print_preferences
FOR EACH ROW
EXECUTE FUNCTION public.set_print_preferences_updated_at();

CREATE INDEX IF NOT EXISTS print_preferences_updated_at_idx
  ON public.print_preferences (updated_at DESC);

COMMENT ON TABLE public.print_preferences IS 'Preferencias da pagina de impressao por usuario';
COMMENT ON COLUMN public.print_preferences.user_id IS 'Identificador do usuario dono das preferencias';
COMMENT ON COLUMN public.print_preferences.address IS 'Endereco de permanencia utilizado no documento';
COMMENT ON COLUMN public.print_preferences.observations IS 'Texto do anexo administrativo (pagina 2)';

NOTIFY pgrst, 'reload schema';
