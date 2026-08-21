-- Recria admin_reset_password com filtro seguro por id (nunca afeta outros usuários)
-- e validação de que o chamador é admin, evitando o incidente de senha global sobrescrita.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.admin_reset_password(target_email TEXT, new_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_role TEXT;
  target_id UUID;
BEGIN
  SELECT role INTO requester_role FROM public.profiles WHERE id = auth.uid();

  IF requester_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT id INTO target_id FROM auth.users WHERE email = target_email;

  IF target_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf'))
  WHERE id = target_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_password(TEXT, TEXT) TO authenticated;
