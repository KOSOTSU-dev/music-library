"use server"

import { getServerSupabase } from "@/lib/server-supabase"
import { revalidatePath } from "next/cache"

// フレンド申請を送信
export async function sendFriendRequest(formData: FormData) {
  const friendId = String(formData.get('friendId') || '')
  if (!friendId) return { error: 'フレンドIDが必要です' }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未認証です' }

  if (user.id === friendId) {
    return { error: '自分自身をフレンドに追加することはできません' }
  }

  // 既存の関係をチェック
  const { data: existing } = await supabase
    .from('friends')
    .select('*')
    .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'accepted') {
      return { error: '既にフレンドです' }
    } else if (existing.status === 'pending') {
      return { error: '既にフレンド申請中です' }
    } else if (existing.status === 'blocked') {
      return { error: 'このユーザーはブロックされています' }
    }
  }

  // フレンド申請を作成
  const { error } = await supabase
    .from('friends')
    .insert({
      user_id: user.id,
      friend_id: friendId,
      status: 'pending'
    })

  if (error) return { error: error.message }

  revalidatePath('/app')
  return { success: true }
}

// フレンド申請を承認
export async function acceptFriendRequest(formData: FormData) {
  const friendId = String(formData.get('friendId') || '')
  if (!friendId) return { error: 'フレンドIDが必要です' }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未認証です' }

  // フレンド申請を承認
  const { error } = await supabase
    .from('friends')
    .update({ status: 'accepted' })
    .eq('user_id', friendId)
    .eq('friend_id', user.id)
    .eq('status', 'pending')

  if (error) return { error: error.message }

  revalidatePath('/app')
  return { success: true }
}

// フレンド申請を拒否
export async function rejectFriendRequest(formData: FormData) {
  const friendId = String(formData.get('friendId') || '')
  if (!friendId) return { error: 'フレンドIDが必要です' }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未認証です' }

  // フレンド申請を削除
  const { error } = await supabase
    .from('friends')
    .delete()
    .eq('user_id', friendId)
    .eq('friend_id', user.id)
    .eq('status', 'pending')

  if (error) return { error: error.message }

  revalidatePath('/app')
  return { success: true }
}

// フレンドを削除
export async function removeFriend(formData: FormData) {
  const friendId = String(formData.get('friendId') || '')
  if (!friendId) return { error: 'フレンドIDが必要です' }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未認証です' }

  // フレンド関係を削除（双方向）
  const { error } = await supabase
    .from('friends')
    .delete()
    .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`)

  if (error) return { error: error.message }

  revalidatePath('/app')
  return { success: true }
}

// フレンドをブロック
export async function blockUser(formData: FormData) {
  const userId = String(formData.get('userId') || '')
  if (!userId) return { error: 'ユーザーIDが必要です' }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未認証です' }

  if (user.id === userId) {
    return { error: '自分自身をブロックすることはできません' }
  }

  // 既存の関係を削除またはブロックに更新
  const { error } = await supabase
    .from('friends')
    .upsert({
      user_id: user.id,
      friend_id: userId,
      status: 'blocked'
    }, { onConflict: 'user_id,friend_id' })

  if (error) return { error: error.message }

  revalidatePath('/app')
  return { success: true }
}

// ユーザー検索
export async function searchUsers(formData: FormData) {
  const query = String(formData.get('query') || '').trim()
  if (!query || query.length < 2) return { error: '検索クエリは2文字以上必要です' }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未認証です' }

  // 公開ユーザーを検索（自分以外）
  const { data, error } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url, is_public')
    .neq('id', user.id)
    .eq('is_public', true)
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .limit(10)

  if (error) return { error: error.message }

  return { users: data || [] }
}

// プロフィール更新
export async function updateProfile(formData: FormData) {
  const username = String(formData.get('username') || '').trim()
  const displayName = String(formData.get('displayName') || '').trim()
  const avatarFile = formData.get('avatar') as File | null

  if (!username) {
    return { error: 'ユーザー名は必須です' }
  }

  if (username.length < 3 || username.length > 20) {
    return { error: 'ユーザー名は3-20文字で入力してください' }
  }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未認証です' }

  // ユーザー名の重複チェック
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .neq('id', user.id)
    .maybeSingle()

  if (existing) {
    return { error: 'このユーザー名は既に使用されています' }
  }

  let avatarUrl = null

  // アバター画像のアップロード
  if (avatarFile && avatarFile.size > 0) {
    const fileExt = avatarFile.name.split('.').pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, avatarFile)

    if (uploadError) {
      return { error: 'アバター画像のアップロードに失敗しました' }
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName)

    avatarUrl = publicUrl
  }

  // プロフィール更新
  const updateData: any = {
    username: username,
    display_name: displayName || username, // 表示名が空の場合はユーザー名を使用
    is_public: true // 常に公開設定
  }

  if (avatarUrl) {
    updateData.avatar_url = avatarUrl
  }

  const { error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/app')
  return { success: true }
}

// フレンド申請数を取得
export async function getPendingFriendRequestsCount() {
  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { count: 0 }

  const { count, error } = await supabase
    .from('friends')
    .select('*', { count: 'exact', head: true })
    .eq('friend_id', user.id)
    .eq('status', 'pending')

  if (error) return { count: 0 }
  return { count: count || 0 }
}
