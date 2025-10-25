-- comment_likesテーブルを作成
CREATE TABLE IF NOT EXISTS public.comment_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(comment_id, user_id)
);

-- RLSを有効化
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- RLSポリシーを作成
CREATE POLICY "Enable read access for all users" ON public.comment_likes
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.comment_likes
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable delete for users based on user_id" ON public.comment_likes
    FOR DELETE USING (auth.uid() = user_id);

-- インデックスを作成
CREATE INDEX IF NOT EXISTS comment_likes_comment_id_idx ON public.comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS comment_likes_user_id_idx ON public.comment_likes(user_id);
