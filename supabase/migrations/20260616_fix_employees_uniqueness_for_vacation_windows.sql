-- Permite múltiplas janelas/anos de férias para o mesmo militar.
-- Remove unicidade global por NIP e define unicidade por (user_id, planning_year).

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_nip_key;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_user_id_planning_year_key UNIQUE (user_id, planning_year);
