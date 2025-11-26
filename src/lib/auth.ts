import { supabase } from './supabase'

export interface User {
  id: string
  spotify_id?: string | null
  username: string
  display_name: string
  avatar_url?: string
  is_public: boolean
  created_at: string
}

// Spotify OAuth認証
export async function signInWithSpotify(options?: { forceReauth?: boolean }) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://music-library-rouge.vercel.app')
  
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

// メール/パスワードでログイン
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw error
  }

  // ユーザープロファイルが存在しない場合は作成
  if (data.user) {
    await ensureUserProfile(data.user.id, {
      email: data.user.email || '',
      username: data.user.email?.split('@')[0] || 'user',
      display_name: data.user.email?.split('@')[0] || 'User',
    })
    await ensureDefaultShelf(data.user.id)
  }

  return data
}

// メール/パスワードで新規登録
export async function signUpWithEmail(email: string, password: string, username?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username || email.split('@')[0],
        display_name: username || email.split('@')[0],
      },
    },
  })

  if (error) {
    throw error
  }

  // ユーザープロファイルが存在しない場合は作成
  if (data.user) {
    await ensureUserProfile(data.user.id, {
      email: data.user.email || '',
      username: username || data.user.email?.split('@')[0] || 'user',
      display_name: username || data.user.email?.split('@')[0] || 'User',
    })
    await ensureDefaultShelf(data.user.id)
  }

  return data
}

// 匿名ログイン（ゲストログイン）
export async function signInAnonymously() {
  const { data, error } = await supabase.auth.signInAnonymously()

  if (error) {
    // 匿名認証が無効な場合のエラーメッセージを改善
    if (error.message.includes('Anonymous sign-ins are disabled')) {
      throw new Error('ゲストログイン機能が無効になっています。Supabase Dashboardで匿名認証を有効にしてください。')
    }
    // CAPTCHA検証エラーの場合
    if (error.message.includes('captcha') || error.message.includes('CAPTCHA') || error.message.includes('verification')) {
      throw new Error('CAPTCHA検証に失敗しました。hCaptchaの設定を確認してください。または、一時的にCAPTCHAを無効化してください。')
    }
    throw error
  }

  // ユーザープロファイルが存在しない場合は作成
  if (data.user) {
    const guestUsername = `guest_${data.user.id.slice(0, 8)}`
    await ensureUserProfile(data.user.id, {
      username: guestUsername,
      display_name: 'ゲストユーザー',
    })
    await ensureDefaultShelf(data.user.id)
  }

  return data
}

// ユーザープロファイルが存在するか確認し、存在しない場合は作成
async function ensureUserProfile(userId: string, userData: { email?: string; username: string; display_name: string }) {
  const { data: existingProfile } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single()

  if (!existingProfile) {
    const { error } = await supabase
      .from('users')
      .insert({
        id: userId,
        username: userData.username,
        display_name: userData.display_name,
        spotify_id: null,
        is_public: true,
      })

    if (error) {
      console.error('Failed to create user profile:', error)
    }
  }
}

async function ensureDefaultShelf(userId: string) {
  const { data: existingShelves, error } = await supabase
    .from('shelves')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (error) {
    console.error('Failed to check default shelf:', error)
    return
  }

  if (existingShelves && existingShelves.length > 0) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('selected-shelf-id', existingShelves[0].id)
      } catch (e) {
        console.warn('Failed to persist selected shelf id:', e)
      }
    }
    return
  }

  const { data: newShelf, error: insertError } = await supabase
    .from('shelves')
    .insert({ user_id: userId, name: 'リスト1', is_public: true })
    .select('id, name, created_at')
    .single()

  if (insertError) {
    console.error('Failed to create default shelf:', insertError)
    return
  }

  if (typeof window !== 'undefined' && newShelf?.id) {
    try {
      localStorage.setItem('selected-shelf-id', newShelf.id)
    } catch (e) {
      console.warn('Failed to persist default shelf id:', e)
    }
  }
}

// パスワードリセットメールを送信
export async function resetPasswordForEmail(email: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://music-library-rouge.vercel.app')
  
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${baseUrl}/auth/reset-password`,
  })

  if (error) {
    throw error
  }
}

// パスワードを更新（リセット後の新パスワード設定）
export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  })

  if (error) {
    throw error
  }
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
    
    // ページをリロードしてからトップページに移動
    window.location.replace('/')
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
    const spotifyLogoutUrl = `https://accounts.spotify.com/logout?continue=${encodeURIComponent(window.location.origin + '/?force_spotify_reauth=true')}`
    window.location.href = spotifyLogoutUrl
  }
}

// 現在のユーザーを取得
export async function getCurrentUser(): Promise<User | null> {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.user) {
    return null
  }

  // データベースからユーザープロファイルを取得
  const { data: userProfile } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (userProfile) {
    return {
      id: userProfile.id,
      spotify_id: userProfile.spotify_id || null,
      username: userProfile.username,
      display_name: userProfile.display_name,
      avatar_url: userProfile.avatar_url,
      is_public: userProfile.is_public,
      created_at: userProfile.created_at,
    }
  }

  // プロファイルが存在しない場合（Spotifyログインなど）
  const spotifyUser = session.user.user_metadata
  
  return {
    id: session.user.id,
    spotify_id: spotifyUser.provider_id || null,
    username: spotifyUser.user_name || spotifyUser.display_name || session.user.email?.split('@')[0] || 'user',
    display_name: spotifyUser.full_name || spotifyUser.display_name || session.user.email?.split('@')[0] || 'User',
    avatar_url: spotifyUser.avatar_url,
    is_public: true,
    created_at: session.user.created_at,
  }
}

// ユーザー情報をデータベースに保存/更新
export async function upsertUser(user: Partial<User>) {
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    throw new Error('User not authenticated')
  }

  const { data, error } = await supabase
    .from('users')
    .upsert({
      ...user,
      id: authUser.id,
    }, { onConflict: 'id' })
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
