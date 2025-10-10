-- Extensions (for gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    spotify_id TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shelves table
CREATE TABLE IF NOT EXISTS public.shelves (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shelf_items table
CREATE TABLE IF NOT EXISTS public.shelf_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shelf_id UUID REFERENCES public.shelves(id) ON DELETE CASCADE NOT NULL,
    spotify_type TEXT CHECK (spotify_type IN ('track', 'album', 'playlist')) NOT NULL,
    spotify_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT,
    image_url TEXT,
    color TEXT,
    position INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create comments table
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shelf_item_id UUID REFERENCES public.shelf_items(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create friends table
CREATE TABLE IF NOT EXISTS public.friends (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    friend_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    status TEXT CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shelves_user_id ON public.shelves(user_id);
CREATE INDEX IF NOT EXISTS idx_shelves_is_public ON public.shelves(is_public);
CREATE INDEX IF NOT EXISTS idx_shelf_items_shelf_id ON public.shelf_items(shelf_id);
CREATE INDEX IF NOT EXISTS idx_shelf_items_position ON public.shelf_items(shelf_id, position);
CREATE INDEX IF NOT EXISTS idx_comments_shelf_item_id ON public.comments(shelf_item_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON public.friends(status);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shelves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shelf_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Public users can be viewed by everyone" ON public.users
    FOR SELECT USING (is_public = true);

-- Shelves policies
CREATE POLICY "Users can view their own shelves" ON public.shelves
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own shelves" ON public.shelves
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shelves" ON public.shelves
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shelves" ON public.shelves
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Public shelves can be viewed by everyone" ON public.shelves
    FOR SELECT USING (is_public = true);

-- Shelf items policies
CREATE POLICY "Users can view items in their own shelves" ON public.shelf_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.shelves 
            WHERE shelves.id = shelf_items.shelf_id 
            AND shelves.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create items in their own shelves" ON public.shelf_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.shelves 
            WHERE shelves.id = shelf_items.shelf_id 
            AND shelves.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update items in their own shelves" ON public.shelf_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.shelves 
            WHERE shelves.id = shelf_items.shelf_id 
            AND shelves.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete items in their own shelves" ON public.shelf_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.shelves 
            WHERE shelves.id = shelf_items.shelf_id 
            AND shelves.user_id = auth.uid()
        )
    );

CREATE POLICY "Items in public shelves can be viewed by everyone" ON public.shelf_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.shelves 
            WHERE shelves.id = shelf_items.shelf_id 
            AND shelves.is_public = true
        )
    );

-- Comments policies
CREATE POLICY "Anyone can view comments on public shelf items" ON public.comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.shelf_items 
            JOIN public.shelves ON shelves.id = shelf_items.shelf_id
            WHERE shelf_items.id = comments.shelf_item_id 
            AND shelves.is_public = true
        )
    );

CREATE POLICY "Users can view comments on their own shelf items" ON public.comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.shelf_items 
            JOIN public.shelves ON shelves.id = shelf_items.shelf_id
            WHERE shelf_items.id = comments.shelf_item_id 
            AND shelves.user_id = auth.uid()
        )
    );

CREATE POLICY "Authenticated users can create comments" ON public.comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON public.comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON public.comments
    FOR DELETE USING (auth.uid() = user_id);

-- Friends policies
CREATE POLICY "Users can view their own friend relationships" ON public.friends
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friend requests" ON public.friends
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update friend requests they received" ON public.friends
    FOR UPDATE USING (auth.uid() = friend_id);

CREATE POLICY "Users can delete their own friend relationships" ON public.friends
    FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shelves_updated_at BEFORE UPDATEimage.png ON public.shelves
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_friends_updated_at BEFORE UPDATE ON public.friends
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
