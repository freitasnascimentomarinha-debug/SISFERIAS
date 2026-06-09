-- Adiciona coluna staff_json para armazenar dados das autoridades assinantes (Diretor, Vice-Diretor, Enc. Pessoal)
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS staff_json JSONB DEFAULT '{}'::jsonb;
