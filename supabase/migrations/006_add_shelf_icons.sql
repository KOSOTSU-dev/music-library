-- Add icon_url column to shelves table
ALTER TABLE public.shelves ADD COLUMN IF NOT EXISTS icon_url TEXT;
