"use server"

import { getServerSupabase } from "@/lib/server-supabase"

export async function createShelf(formData: FormData) {
  const name = String(formData.get("name") || "").trim()
  if (!name) {
    return { error: "棚名を入力してください" }
  }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error("未認証です")
  }

  // Ensure user profile exists
  await supabase.from('users').upsert({
    id: user.id,
    spotify_id: user.user_metadata?.provider_id ?? user.id,
    username: user.user_metadata?.user_name || user.email?.split('@')[0] || 'user',
    display_name: user.user_metadata?.full_name || user.email || 'user',
    avatar_url: user.user_metadata?.avatar_url ?? null,
    is_public: true,
  }, { onConflict: 'id' })

  const { error, data } = await supabase
    .from('shelves')
    .insert({ user_id: user.id, name, is_public: true })
    .select('id, name, created_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return { shelf: data }
}

export async function updateShelf(formData: FormData) {
  const id = String(formData.get("id") || "")
  const name = String(formData.get("name") || "").trim()
  
  if (!id || !name) {
    return { error: "棚名を入力してください" }
  }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error("未認証です")
  }

  const { error, data } = await supabase
    .from("shelves")
    .update({ name })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, name, created_at, sort_order')
    .single()

  if (error) {
    console.error('Error updating shelf:', error)
    return { error: "棚名の更新に失敗しました" }
  }

  return { shelf: data }
}

export async function deleteShelf(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (!id) throw new Error('棚IDが不正です')

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('未認証です')

  const { error } = await supabase
    .from('shelves')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)

  return { id }
}

export async function addShelfItem(formData: FormData) {
  const shelfId = String(formData.get('shelfId') || '')
  const spotifyType = String(formData.get('spotifyType') || '') as 'track'|'album'|'playlist'
  const spotifyId = String(formData.get('spotifyId') || '')
  const title = String(formData.get('title') || '')
  const artist = String(formData.get('artist') || '')
  const album = (formData.get('album') ? String(formData.get('album')) : null) as string | null
  const imageUrl = (formData.get('imageUrl') ? String(formData.get('imageUrl')) : null) as string | null
  const color = (formData.get('color') ? String(formData.get('color')) : null) as string | null

  if (!shelfId || !spotifyType || !spotifyId || !title) {
    return { error: '必要な情報が不足しています' }
  }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未認証です' }

  // 次のpositionを算出
  const { data: maxPosData } = await supabase
    .from('shelf_items')
    .select('position')
    .eq('shelf_id', shelfId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextPosition = (maxPosData?.position ?? -1) + 1

  const { error, data } = await supabase
    .from('shelf_items')
    .insert({
      shelf_id: shelfId,
      spotify_type: spotifyType,
      spotify_id: spotifyId,
      title,
      artist,
      album,
      image_url: imageUrl,
      color,
      position: nextPosition,
    })
    .select('id, title, artist, album, image_url, color, position, spotify_type, spotify_id')
    .single()

  if (error) return { error: error.message }

  return { item: data }
}

export async function reorderShelfItems(formData: FormData) {
  const shelfId = String(formData.get('shelfId') || '')
  const itemIds = JSON.parse(String(formData.get('itemIds') || '[]'))
  
  if (!shelfId || !Array.isArray(itemIds)) {
    return { error: 'Invalid data for reordering' }
  }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未認証です' }

  // 各アイテムのpositionを更新
  const updates = itemIds.map((itemId: string, index: number) => ({
    id: itemId,
    position: index
  }))

  const { error } = await supabase
    .from('shelf_items')
    .upsert(updates, { onConflict: 'id' })

  if (error) return { error: error.message }

  return { success: true }
}

export async function deleteShelfItem(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (!id) return { error: 'Invalid shelf item id' }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未認証です' }

  const { error } = await supabase
    .from('shelf_items')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function moveShelfItem(formData: FormData) {
  const id = String(formData.get('id') || '')
  const toShelfId = String(formData.get('toShelfId') || '')
  if (!id || !toShelfId) return { error: 'Invalid data' }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未認証です' }

  const { data: maxPosData } = await supabase
    .from('shelf_items')
    .select('position')
    .eq('shelf_id', toShelfId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextPosition = (maxPosData?.position ?? -1) + 1

  const { error } = await supabase
    .from('shelf_items')
    .update({ shelf_id: toShelfId, position: nextPosition })
    .eq('id', id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function duplicateShelfItem(formData: FormData) {
  const id = String(formData.get('id') || '')
  const toShelfId = String(formData.get('toShelfId') || '')
  if (!id || !toShelfId) return { error: 'Invalid data' }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未認証です' }

  const { data: src, error: selErr } = await supabase
    .from('shelf_items')
    .select('*')
    .eq('id', id)
    .single()

  if (selErr || !src) return { error: selErr?.message || 'Not found' }

  const { data: maxPosData } = await supabase
    .from('shelf_items')
    .select('position')
    .eq('shelf_id', toShelfId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextPosition = (maxPosData?.position ?? -1) + 1

  const insertData = {
    shelf_id: toShelfId,
    spotify_type: src.spotify_type,
    spotify_id: src.spotify_id,
    title: src.title,
    artist: src.artist,
    album: src.album,
    image_url: src.image_url,
    color: src.color,
    position: nextPosition,
  }

  const { error } = await supabase
    .from('shelf_items')
    .insert(insertData)

  if (error) return { error: error.message }
  return { success: true }
}

export async function reorderShelves(formData: FormData) {
  const shelfIds = JSON.parse(String(formData.get('shelfIds') || '[]'))

  if (!Array.isArray(shelfIds)) {
    return { error: 'Invalid data for reordering' }
  }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未認証です' }

  // 各棚のsort_orderを更新
  const updates = shelfIds.map((shelfId: string, index: number) => ({
    id: shelfId,
    sort_order: index
  }))

  const { error } = await supabase
    .from('shelves')
    .upsert(updates, { onConflict: 'id' })

  if (error) return { error: error.message }

  return { success: true }
}

export async function updateShelfItemMemo(formData: FormData) {
  const itemId = String(formData.get("itemId") || "").trim()
  const memo = String(formData.get("memo") || "").trim()
  
  if (!itemId) {
    return { error: "アイテムIDが必要です" }
  }

  if (memo.length > 20) {
    return { error: "メモは20文字以内で入力してください" }
  }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error("未認証です")
  }

  // Check if the user owns this shelf item
  const { data: shelfItem } = await supabase
    .from('shelf_items')
    .select('shelf_id, shelves!inner(user_id)')
    .eq('id', itemId)
    .single()

  if (!shelfItem || shelfItem.shelves.user_id !== user.id) {
    return { error: "このアイテムを編集する権限がありません" }
  }

  const { error } = await supabase
    .from('shelf_items')
    .update({ memo: memo || null })
    .eq('id', itemId)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

