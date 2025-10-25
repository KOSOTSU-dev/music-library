-- commentsテーブルのRLSポリシーを修正

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Users can view all comments" ON comments;
DROP POLICY IF EXISTS "Users can insert their own comments" ON comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON comments;

-- 新しいポリシーを作成
-- 1. 全ユーザーがコメントを閲覧可能
CREATE POLICY "Enable read access for all users" ON comments
    FOR SELECT USING (true);

-- 2. 認証されたユーザーがコメントを投稿可能
CREATE POLICY "Enable insert for authenticated users" ON comments
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 3. ユーザーは自分のコメントのみ更新可能
CREATE POLICY "Enable update for users based on user_id" ON comments
    FOR UPDATE USING (auth.uid() = user_id);

-- 4. ユーザーは自分のコメントのみ削除可能
CREATE POLICY "Enable delete for users based on user_id" ON comments
    FOR DELETE USING (auth.uid() = user_id);

-- likesテーブルのRLSポリシーも修正
DROP POLICY IF EXISTS "Users can view all likes" ON likes;
DROP POLICY IF EXISTS "Users can insert their own likes" ON likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON likes;

-- likesテーブルの新しいポリシー
CREATE POLICY "Enable read access for all users" ON likes
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON likes
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable delete for users based on user_id" ON likes
    FOR DELETE USING (auth.uid() = user_id);

-- comment_likesテーブルは存在しないため、コメントのいいね機能は後で実装
