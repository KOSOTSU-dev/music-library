-- Allow users to insert their own profile row
CREATE POLICY IF NOT EXISTS "Users can insert their own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);



