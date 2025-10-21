import { supabase } from './supabase'

export interface User {
  id: string
  spotify_id: string
  username: string
  display_name: string
  avatar_url?: string
  is_public: boolean
  created_at: string
}

// Spotify OAuth認証
export async function signInWithSpotify(options?: { forceReauth?: boolean }) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'spotify',
    options: {
      scopes: [
        'user-read-email',
        'user-read-private',
        'streaming',
        'user-read-playback-state',
        'user-modify-playback-state',
        'playlist-read-private',
        'playlist-read-collaborative',
      ].join(' '),
      redirectTo: `${baseUrl}/auth/callback?next=/app`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
        // forceReauthがtrueの場合のみshow_dialogをtrueにする
        ...(options?.forceReauth && { show_dialog: 'true' }),
      },
    },
  })

  if (error) {
    throw error
  }

  return data
}

// ログアウト
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    throw error
  }
  
  // ログアウト後にセッションを確実にクリアしてログインページにリダイレクト
  if (typeof window !== 'undefined') {
    // localStorageをクリア（アイコン以外）
    try {
      const keysToKeep = ['shelf:icons'] // アイコンは保持
      const allKeys = Object.keys(localStorage)
      allKeys.forEach(key => {
        if (!keysToKeep.includes(key)) {
          localStorage.removeItem(key)
        }
      })
    } catch (e) {
      console.warn('localStorage clear failed:', e)
    }
    
    // セッションストレージもクリア
    try {
      sessionStorage.clear()
    } catch (e) {
      console.warn('sessionStorage clear failed:', e)
    }
    
    // ページをリロードしてからログインページに移動
    window.location.replace('/login')
  }
}

// 完全なログアウト（Spotifyセッションも含む）
export async function fullSignOut() {
  if (typeof window !== 'undefined') {
    // まずSupabaseからログアウト
    await signOut()
    
    // localStorageとsessionStorageをクリア（アイコン以外）
    try {
      const keysToKeep = ['shelf:icons'] // アイコンは保持
      const allKeys = Object.keys(localStorage)
      allKeys.forEach(key => {
        if (!keysToKeep.includes(key)) {
          localStorage.removeItem(key)
        }
      })
    } catch (e) {
      console.warn('localStorage clear failed:', e)
    }
    try {
      sessionStorage.clear()
    } catch (e) {
      console.warn('sessionStorage clear failed:', e)
    }

    // Spotifyのログアウトページにリダイレクトし、完了後にMusic Libraryに戻る
    const spotifyLogoutUrl = `https://accounts.spotify.com/logout?continue=${encodeURIComponent(window.location.origin + '/login?force_spotify_reauth=true')}`
    window.location.href = spotifyLogoutUrl
  }
}

// 現在のユーザーを取得
export async function getCurrentUser(): Promise<User | null> {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.user) {
    return null
  }

  // Supabaseのユーザー情報からSpotify情報を取得
  const spotifyUser = session.user.user_metadata
  
  return {
    id: session.user.id,
    spotify_id: spotifyUser.provider_id,
    username: spotifyUser.user_name || spotifyUser.display_name,
    display_name: spotifyUser.full_name || spotifyUser.display_name,
    avatar_url: spotifyUser.avatar_url,
    is_public: true, // デフォルトは公開
    created_at: session.user.created_at,
  }
}

// ユーザー情報をデータベースに保存/更新
export async function upsertUser(user: Partial<User>) {
  const { data, error } = await supabase
    .from('users')
    .upsert(user, { onConflict: 'spotify_id' })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

// ユーザーの公開設定を更新
export async function updateUserPrivacy(isPublic: boolean) {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('User not authenticated')
  }

  const { data, error } = await supabase
    .from('users')
    .update({ is_public: isPublic })
    .eq('id', user.id)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}
