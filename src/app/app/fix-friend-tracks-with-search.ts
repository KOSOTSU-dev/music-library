"use server"

import { getServerSupabase } from "@/lib/server-supabase"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { revalidatePath } from "next/cache"

export async function fixFriendTracksWithSearch() {
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

    // ユーザーのアクセストークンを取得
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = (session as any)?.provider_token || (session as any)?.providerToken
    if (!accessToken) {
      return { error: 'Spotifyアクセストークンがありません' }
    }

    let totalFixed = 0

    for (const virtualUser of virtualUsers) {
      console.log(`仮想フレンド処理中: ${virtualUser.username}`)

      // 仮想フレンドの全棚を取得
      const { data: userShelves } = await supabaseAdmin
        .from('shelves')
        .select('id, name')
        .eq('user_id', virtualUser.id)
        .eq('is_public', true)

      if (!userShelves || userShelves.length === 0) continue

      // 各棚の楽曲を取得
      for (const shelf of userShelves) {
        const { data: shelfItems } = await supabaseAdmin
          .from('shelf_items')
          .select('*')
          .eq('shelf_id', shelf.id)
          .order('position', { ascending: true })

        if (!shelfItems || shelfItems.length === 0) continue

        console.log(`棚「${shelf.name}」の楽曲を処理中: ${shelfItems.length}曲`)

        for (const item of shelfItems) {
          try {
            console.log(`楽曲検索中: ${item.title} by ${item.artist}`)
            
            // Spotify APIで楽曲を検索（楽曲名 + アーティスト名）
            const searchQuery = encodeURIComponent(`track:"${item.title}" artist:"${item.artist}"`)
            const searchRes = await fetch(
              `https://api.spotify.com/v1/search?q=${searchQuery}&type=track&limit=1`,
              {
                headers: { Authorization: `Bearer ${accessToken}` }
              }
            )

            if (!searchRes.ok) {
              console.warn(`楽曲検索失敗: ${item.title} - ${searchRes.status}`)
              continue
            }

            const searchData = await searchRes.json()
            const tracks = searchData.tracks?.items || []

            if (tracks.length === 0) {
              console.warn(`楽曲が見つからない: ${item.title} by ${item.artist}`)
              continue
            }

            const correctTrack = tracks[0]
            const correctSpotifyId = correctTrack.id
            const correctImageUrl = correctTrack.album?.images?.[0]?.url

            console.log(`正しい楽曲情報を発見:`, {
              original: { id: item.spotify_id, title: item.title, artist: item.artist },
              correct: { 
                id: correctSpotifyId, 
                title: correctTrack.name, 
                artist: correctTrack.artists[0]?.name,
                image: correctImageUrl 
              }
            })

            // データベースを更新
            const { error: updateError } = await supabaseAdmin
              .from('shelf_items')
              .update({
                spotify_id: correctSpotifyId,
                image_url: correctImageUrl,
                title: correctTrack.name,
                artist: correctTrack.artists[0]?.name || item.artist,
                album: correctTrack.album?.name || item.album
              })
              .eq('id', item.id)

            if (updateError) {
              console.error(`楽曲更新エラー: ${item.title}`, updateError)
            } else {
              console.log(`楽曲更新成功: ${item.title} -> ${correctTrack.name}`)
              totalFixed++
            }

            // APIレート制限を避けるため少し待機
            await new Promise(resolve => setTimeout(resolve, 200))

          } catch (error) {
            console.error(`楽曲処理エラー: ${item.title}`, error)
          }
        }
      }
    }

    revalidatePath('/app/friends')
    return { 
      success: true, 
      message: `${totalFixed}曲の楽曲情報を正しく修正しました` 
    }
  } catch (error) {
    console.error('楽曲修正エラー:', error)
    return { error: '楽曲修正に失敗しました' }
  }
}
