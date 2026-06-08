-- Add support for admin visibility control by sector.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS view_all_sectors boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.view_all_sectors IS
'When true, admin can view all sectors; when false, admin is restricted to own sector.';
