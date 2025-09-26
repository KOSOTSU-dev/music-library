"use server"

import { getServerSupabase } from "@/lib/server-supabase"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { revalidatePath } from "next/cache"

export async function addShelvesToVirtualFriends() {
  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未認証です' }

  try {
    // 仮想フレンドを取得
    const { data: virtualUsers, error: virtualUsersError } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name')
      .like('spotify_id', 'virtual_%')

    if (virtualUsersError) {
      console.error('仮想フレンド検索エラー:', virtualUsersError)
      return { error: '仮想フレンドの検索に失敗しました' }
    }

    if (!virtualUsers || virtualUsers.length === 0) {
      return { error: '仮想フレンドが見つかりません' }
    }

    for (const virtualUser of virtualUsers) {
      console.log(`仮想フレンド処理中: ${virtualUser.username}`)

      // 既存の棚を確認
      const { data: existingShelves } = await supabaseAdmin
        .from('shelves')
        .select('name')
        .eq('user_id', virtualUser.id)
        .eq('is_public', true)

      const existingShelfNames = existingShelves?.map(s => s.name) || []

      // 追加する棚の定義
      const shelvesToAdd = [
        {
          name: 'リラックス',
          description: `${virtualUser.display_name}のリラックス用楽曲`,
          sort_order: 1
        },
        {
          name: 'エナジー',
          description: `${virtualUser.display_name}のエナジーチャージ用楽曲`,
          sort_order: 2
        }
      ]

      // 存在しない棚のみ追加
      for (const shelfData of shelvesToAdd) {
        if (!existingShelfNames.includes(shelfData.name)) {
          const { error: shelfError } = await supabaseAdmin
            .from('shelves')
            .insert({
              name: shelfData.name,
              description: shelfData.description,
              user_id: virtualUser.id,
              is_public: true,
              sort_order: shelfData.sort_order
            })

          if (shelfError) {
            console.error(`棚作成失敗 (${virtualUser.username} - ${shelfData.name}):`, shelfError)
          } else {
            console.log(`棚作成成功 (${virtualUser.username} - ${shelfData.name})`)
          }
        }
      }

      // 各棚に楽曲を追加
      const { data: userShelves } = await supabaseAdmin
        .from('shelves')
        .select('id, name')
        .eq('user_id', virtualUser.id)
        .eq('is_public', true)
        .order('sort_order', { ascending: true })

      if (!userShelves || userShelves.length === 0) continue

      // 棚ごとの楽曲データ
      const shelfTracks = {
        'お気に入り': [
          { title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', image_url: null, spotify_type: 'track', spotify_id: '0VjIjW4GlUZAMYd2vXMi3b' },
          { title: 'Levitating', artist: 'Dua Lipa', album: 'Future Nostalgia', image_url: null, spotify_type: 'track', spotify_id: '463CkQjx2Zk1yXoBuierM9' },
          { title: "Don't Start Now", artist: 'Dua Lipa', album: 'Future Nostalgia', image_url: null, spotify_type: 'track', spotify_id: '3PfIrDoz19wz7qK7tYeu62' },
          { title: 'Shape of You', artist: 'Ed Sheeran', album: '÷ (Divide)', image_url: null, spotify_type: 'track', spotify_id: '7qiZfU4dY1lWllzX7mPBI3' },
          { title: 'Uptown Funk', artist: 'Mark Ronson', album: 'Uptown Special', image_url: null, spotify_type: 'track', spotify_id: '32OlwWuMpZ6b0aN2RZOeMS' },
        ],
        'リラックス': [
          { title: 'drivers license', artist: 'Olivia Rodrigo', album: 'SOUR', image_url: null, spotify_type: 'track', spotify_id: '5wANPM4fQCJwkGd4rN57mH' },
          { title: 'Hello', artist: 'Adele', album: '25', image_url: null, spotify_type: 'track', spotify_id: '1zHlj4dQ8ZAtrayhuDDmkY' },
          { title: 'Circles', artist: 'Post Malone', album: "Hollywood's Bleeding", image_url: null, spotify_type: 'track', spotify_id: '21jGcNKet2qwijlDFuPiPb' },
          { title: 'Memories', artist: 'Maroon 5', album: 'JORDI', image_url: null, spotify_type: 'track', spotify_id: '2b8fOow8UzyDFAE27YhOZM' },
          { title: 'As It Was', artist: 'Harry Styles', album: "Harry's House", image_url: null, spotify_type: 'track', spotify_id: '4LRPiXqCikLlN15c3yImP7' },
        ],
        'エナジー': [
          { title: 'bad guy', artist: 'Billie Eilish', album: 'WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?', image_url: null, spotify_type: 'track', spotify_id: '2Fxmhks0bxFxX5khXwaCjQ' },
          { title: 'STAY (with Justin Bieber)', artist: 'The Kid LAROI', album: 'F*CK LOVE 3: OVER YOU', image_url: null, spotify_type: 'track', spotify_id: '5PjdY0CKGZdEuoNab3yDmX' },
          { title: 'Believer', artist: 'Imagine Dragons', album: 'Evolve', image_url: null, spotify_type: 'track', spotify_id: '0pqnGHJpmpxLKifKRmU6WP' },
          { title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', image_url: null, spotify_type: 'track', spotify_id: '4uLU6hMCjMI75M1A2tKUQC' },
          { title: 'Blurryface', artist: 'Twenty One Pilots', album: 'Stressed Out', image_url: null, spotify_type: 'track', spotify_id: '3CRDbSIZ4r5MsZ0YwxuEkn' },
        ]
      }

      // 各棚に楽曲を追加
      for (const shelf of userShelves) {
        // 既存のアイテムは一旦クリアしてから投入
        await supabaseAdmin
          .from('shelf_items')
          .delete()
          .eq('shelf_id', shelf.id)

        const tracks = shelfTracks[shelf.name as keyof typeof shelfTracks] || []
        if (tracks.length === 0) continue

        const itemsToInsert = tracks.map((t, idx) => ({
          shelf_id: shelf.id,
          title: t.title,
          artist: t.artist,
          album: t.album,
          image_url: t.image_url,
          spotify_type: t.spotify_type,
          spotify_id: t.spotify_id,
          position: idx,
        }))

        await supabaseAdmin.from('shelf_items').insert(itemsToInsert)
      }
    }

    revalidatePath('/app/friends')
    return { 
      success: true, 
      message: `仮想フレンドに追加の棚を作成しました` 
    }
  } catch (error) {
    console.error('棚追加エラー:', error)
    return { error: '棚追加に失敗しました' }
  }
}
