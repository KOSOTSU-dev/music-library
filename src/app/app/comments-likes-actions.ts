'use server'

import { getServerSupabase } from '@/lib/server-supabase'
import { Database } from '@/types/database'

type Comment = Database['public']['Tables']['comments']['Row']
type Like = Database['public']['Tables']['likes']['Row']

// Get comments for a shelf item
export async function getComments(shelfItemId: string) {
  const supabase = await getServerSupabase()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('未認証です')
  }

  const { data: comments, error } = await supabase
    .from('comments')
    .select(`
      id,
      content,
      created_at,
      updated_at,
      users!inner(
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('shelf_item_id', shelfItemId)
    .order('created_at', { ascending: true })

  if (error) {
    return { error: error.message }
  }

  return { comments }
}

// Add a comment
export async function addComment(formData: FormData) {
  const shelfItemId = String(formData.get('shelfItemId') || '').trim()
  const content = String(formData.get('content') || '').trim()
  
  if (!shelfItemId || !content) {
    return { error: 'コメント内容が必要です' }
  }

  if (content.length > 500) {
    return { error: 'コメントは500文字以内で入力してください' }
  }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('未認証です')
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({
      shelf_item_id: shelfItemId,
      user_id: user.id,
      content
    })
    .select(`
      id,
      content,
      created_at,
      updated_at,
      users!inner(
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .single()

  if (error) {
    return { error: error.message }
  }

  return { comment: data }
}

// Delete a comment
export async function deleteComment(formData: FormData) {
  const commentId = String(formData.get('commentId') || '').trim()
  
  if (!commentId) {
    return { error: 'コメントIDが必要です' }
  }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('未認証です')
  }

  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

// Get likes for a shelf item
export async function getLikes(shelfItemId: string) {
  const supabase = await getServerSupabase()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('未認証です')
  }

  const { data: likes, error } = await supabase
    .from('likes')
    .select(`
      id,
      created_at,
      users!inner(
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('shelf_item_id', shelfItemId)
    .order('created_at', { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { likes }
}

// Toggle like (add or remove)
export async function toggleLike(formData: FormData) {
  const shelfItemId = String(formData.get('shelfItemId') || '').trim()
  
  if (!shelfItemId) {
    return { error: 'アイテムIDが必要です' }
  }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('未認証です')
  }

  // Check if user already liked this item
  const { data: existingLike } = await supabase
    .from('likes')
    .select('id')
    .eq('shelf_item_id', shelfItemId)
    .eq('user_id', user.id)
    .single()

  if (existingLike) {
    // Remove like
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('shelf_item_id', shelfItemId)
      .eq('user_id', user.id)

    if (error) {
      return { error: error.message }
    }

    return { liked: false }
  } else {
    // Add like
    const { error } = await supabase
      .from('likes')
      .insert({
        shelf_item_id: shelfItemId,
        user_id: user.id
      })

    if (error) {
      return { error: error.message }
    }

    return { liked: true }
  }
}

// Get like count for a shelf item
export async function getLikeCount(shelfItemId: string) {
  const supabase = await getServerSupabase()

  const { count, error } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('shelf_item_id', shelfItemId)

  if (error) {
    return { error: error.message }
  }

  return { count: count || 0 }
}

// Get comment count for a shelf item
export async function getCommentCount(shelfItemId: string) {
  const supabase = await getServerSupabase()

  const { count, error } = await supabase
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('shelf_item_id', shelfItemId)

  if (error) {
    return { error: error.message }
  }

  return { count: count || 0 }
}

// Check if current user has liked a shelf item
export async function getUserLikeStatus(shelfItemId: string) {
  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { liked: false }
  }

  const { data } = await supabase
    .from('likes')
    .select('id')
    .eq('shelf_item_id', shelfItemId)
    .eq('user_id', user.id)
    .single()

  return { liked: !!data }
}
