-- Make spotify_id nullable for email/anonymous login support
ALTER TABLE public.users 
  ALTER COLUMN spotify_id DROP NOT NULL;

-- Drop the existing UNIQUE constraint
ALTER TABLE public.users 
  DROP CONSTRAINT IF EXISTS users_spotify_id_key;

-- Create a new UNIQUE constraint that allows multiple NULL values
-- PostgreSQL allows multiple NULLs in a UNIQUE constraint, but we use a partial index for clarity
CREATE UNIQUE INDEX users_spotify_id_key ON public.users(spotify_id) WHERE spotify_id IS NOT NULL;

