import { createBrowserClient } from '@supabase/ssr'

// ブラウザ/サーバー共通：公開可能なAnonキーのみを使うクライアント
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
}
if (!supabaseAnonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
