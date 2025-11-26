import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/app'
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  // エラーパラメータがある場合（パスワードリセットリンクの期限切れなど）
  if (error) {
    const redirectUrl = new URL(next, request.url)
    redirectUrl.searchParams.set('error', error)
    if (errorDescription) {
      redirectUrl.searchParams.set('error_description', errorDescription)
    }
    return NextResponse.redirect(redirectUrl)
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set(name, value, options)
          },
          remove(name: string, options: any) {
            cookieStore.set(name, '', { ...options, maxAge: 0 })
          },
        },
      }
    )

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!exchangeError && data.session) {
      // パスワードリセットの検出: nextパラメータまたはセッションタイプで判定
      // Supabaseのパスワードリセットセッションには特定のフラグが含まれる可能性がある
      const type = requestUrl.searchParams.get('type')
      const isPasswordReset = next === '/auth/reset-password' || type === 'recovery'
      
      // パスワードリセットの場合は、リセットページへリダイレクト
      if (isPasswordReset) {
        return NextResponse.redirect(new URL('/auth/reset-password', request.url))
      }
      
      // 通常の認証フローの場合
      // ユーザープロファイルが存在するかチェックし、存在しない場合は作成
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('id')
          .eq('id', data.session.user.id)
          .single()

        if (profileError && profileError.code === 'PGRST116') {
          // ユーザープロファイルが存在しない場合は作成
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: data.session.user.id,
              spotify_id: data.session.user.user_metadata?.provider_id ?? data.session.user.id,
              username: data.session.user.user_metadata?.user_name || data.session.user.email?.split('@')[0] || 'user',
              display_name: data.session.user.user_metadata?.full_name || data.session.user.email || 'user',
              avatar_url: data.session.user.user_metadata?.avatar_url ?? null,
              is_public: true,
            })

          if (insertError) {
            console.error('Failed to create user profile:', insertError)
          }
        }

        // 認証成功時にリダイレクト
        const redirectUrl = new URL(next, request.url)
        redirectUrl.searchParams.set('auth_success', 'true')
        redirectUrl.searchParams.set('new_user', (!userProfile ? 'true' : 'false'))
        return NextResponse.redirect(redirectUrl)
      }
    } else {
      console.error('Auth exchange failed:', exchangeError)
      // エラー時はリセットパスワードページまたはログインページへ
      if (next === '/auth/reset-password') {
        const redirectUrl = new URL(next, request.url)
        redirectUrl.searchParams.set('error', 'auth_failed')
        redirectUrl.searchParams.set('error_description', exchangeError?.message || '認証に失敗しました')
        return NextResponse.redirect(redirectUrl)
      }
    }
  }

  // エラー時も確実にログインページへ戻し、強制再認証を促す
  const url = new URL('/login', request.url)
  url.searchParams.set('error', 'auth_failed')
  url.searchParams.set('force_spotify_reauth', 'true')
  return NextResponse.redirect(url)
}
