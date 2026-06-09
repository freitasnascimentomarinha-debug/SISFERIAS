ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS rank text,
  ADD COLUMN IF NOT EXISTS sector text,
  ADD COLUMN IF NOT EXISTS war_name text,
  ADD COLUMN IF NOT EXISTS nip text;

COMMENT ON COLUMN public.profiles.category IS 'Categoria militar/civil do usuario';
COMMENT ON COLUMN public.profiles.rank IS 'Posto/Graduacao do usuario';
COMMENT ON COLUMN public.profiles.sector IS 'Setor principal do usuario';
COMMENT ON COLUMN public.profiles.war_name IS 'Nome de guerra do usuario';
COMMENT ON COLUMN public.profiles.nip IS 'Numero de Identificacao Pessoal';

NOTIFY pgrst, 'reload schema';
