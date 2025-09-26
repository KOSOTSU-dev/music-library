-- Add memo field to shelf_items table
ALTER TABLE public.shelf_items 
ADD COLUMN memo text;

-- Add check constraint for memo length (20 characters max)
ALTER TABLE public.shelf_items 
ADD CONSTRAINT shelf_items_memo_length_check 
CHECK (char_length(memo) <= 20);

