'use server'

import { getServerSupabase } from '@/lib/server-supabase'
import { revalidatePath } from 'next/cache'

export async function addComment(shelfItemId: string, content: string) {
  const supabase = await getServerSupabase()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({
      shelf_item_id: shelfItemId,
      user_id: user.id,
      content: content.trim()
    })
    .select()
    .single()

  if (error) {
    console.error('コメント投稿エラー:', error)
    return { error: 'コメントの投稿に失敗しました' }
  }

  revalidatePath('/app/friends')
  return { data }
}

export async function deleteComment(commentId: string) {
  const supabase = await getServerSupabase()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  // コメントの所有者かチェック
  const { data: comment, error: fetchError } = await supabase
    .from('comments')
    .select('user_id')
    .eq('id', commentId)
    .single()

  if (fetchError || !comment) {
    return { error: 'コメントが見つかりません' }
  }

  if (comment.user_id !== user.id) {
    return { error: 'このコメントを削除する権限がありません' }
  }

  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)

  if (error) {
    console.error('コメント削除エラー:', error)
    return { error: 'コメントの削除に失敗しました' }
  }

  revalidatePath('/app/friends')
  return { success: true }
}

export async function toggleCommentLike(commentId: string) {
  const supabase = await getServerSupabase()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: '認証が必要です' }
  }

  // 既存のいいねをチェック
  const { data: existingLike, error: fetchError } = await supabase
    .from('comment_likes')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', user.id)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('いいね確認エラー:', fetchError)
    return { error: 'いいねの確認に失敗しました' }
  }

  if (existingLike) {
    // いいねを削除
    const { error } = await supabase
      .from('comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', user.id)

    if (error) {
      console.error('いいね削除エラー:', error)
      return { error: 'いいねの削除に失敗しました' }
    }
  } else {
    // いいねを追加
    const { error } = await supabase
      .from('comment_likes')
      .insert({
        comment_id: commentId,
        user_id: user.id
      })

    if (error) {
      console.error('いいね追加エラー:', error)
      return { error: 'いいねの追加に失敗しました' }
    }
  }

  revalidatePath('/app/friends')
  return { success: true }
}
