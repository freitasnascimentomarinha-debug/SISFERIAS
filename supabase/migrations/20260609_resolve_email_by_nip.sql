-- Função pública que resolve NIP → email sem expor a tabela profiles para usuários não autenticados
CREATE OR REPLACE FUNCTION public.get_email_by_nip(p_nip TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT email FROM public.profiles WHERE nip = p_nip LIMIT 1;
$$;

-- Garante que qualquer um (inclusive anon) pode chamar a função
GRANT EXECUTE ON FUNCTION public.get_email_by_nip(TEXT) TO anon, authenticated;
