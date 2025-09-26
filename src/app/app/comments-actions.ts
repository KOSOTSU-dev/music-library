"use server"

import { getServerSupabase } from "@/lib/server-supabase"
import { revalidatePath } from "next/cache"

// コメントを追加
export async function addComment(formData: FormData) {
  const shelfItemId = String(formData.get('shelfItemId') || '')
  const content = String(formData.get('content') || '').trim()

  if (!shelfItemId) {
    return { error: '棚アイテムIDが必要です' }
  }

  if (!content) {
    return { error: 'コメント内容を入力してください' }
  }

  if (content.length > 500) {
    return { error: 'コメントは500文字以内で入力してください' }
  }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未認証です' }

  const { data, error } = await supabase
    .from('comments')
    .insert({
      shelf_item_id: shelfItemId,
      user_id: user.id,
      content: content
    })
    .select(`
      *,
      user:users!comments_user_id_fkey(
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .single()

  if (error) return { error: error.message }

  revalidatePath('/app/friends')
  return { comment: data }
}

// コメントを削除
export async function deleteComment(formData: FormData) {
  const commentId = String(formData.get('commentId') || '')

  if (!commentId) {
    return { error: 'コメントIDが必要です' }
  }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未認証です' }

  // コメントが自分のものかチェック
  const { data: comment, error: fetchError } = await supabase
    .from('comments')
    .select('user_id')
    .eq('id', commentId)
    .single()

  if (fetchError) return { error: 'コメントが見つかりません' }
  if (comment.user_id !== user.id) return { error: '自分のコメントのみ削除できます' }

  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)

  if (error) return { error: error.message }

  revalidatePath('/app/friends')
  return { success: true }
}

// 棚アイテムのコメント一覧を取得
export async function getCommentsForShelfItem(shelfItemId: string) {
  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { comments: [], error: '未認証です' }

  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      user:users!comments_user_id_fkey(
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('shelf_item_id', shelfItemId)
    .order('created_at', { ascending: false })

  if (error) return { comments: [], error: error.message }

  return { comments: data || [] }
}
