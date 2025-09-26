"use server"

import { getServerSupabase } from "@/lib/server-supabase"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { revalidatePath } from "next/cache"

export async function fixVirtualFriendTracks() {
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

    // 正しいSpotify IDに修正
    const trackFixes = [
      {
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        correctSpotifyId: '4uLU6hMCjMI75M1A2tKUQC' // 正しいQueenのBohemian RhapsodyのID
      },
      {
        title: 'bad guy',
        artist: 'Billie Eilish',
        correctSpotifyId: '2Fxmhks0bxFxX5khXwaCjQ'
      },
      {
        title: 'STAY (with Justin Bieber)',
        artist: 'The Kid LAROI',
        correctSpotifyId: '5PjdY0CKGZdEuoNab3yDmX'
      },
      {
        title: 'Believer',
        artist: 'Imagine Dragons',
        correctSpotifyId: '0pqnGHJpmpxLKifKRmU6WP'
      },
      {
        title: 'Blurryface',
        artist: 'Twenty One Pilots',
        correctSpotifyId: '3CRDbSIZ4r5MsZ0YwxuEkn'
      }
    ]

    for (const virtualUser of virtualUsers) {
      console.log(`仮想フレンド処理中: ${virtualUser.username}`)

      // 各修正対象の楽曲を更新
      for (const fix of trackFixes) {
        const { error: updateError } = await supabaseAdmin
          .from('shelf_items')
          .update({
            spotify_id: fix.correctSpotifyId,
            image_url: null // 画像URLをリセットしてSpotifyから再取得させる
          })
          .eq('title', fix.title)
          .eq('artist', fix.artist)
          .in('shelf_id', 
            await supabaseAdmin
              .from('shelves')
              .select('id')
              .eq('user_id', virtualUser.id)
              .then(res => res.data?.map(s => s.id) || [])
          )

        if (updateError) {
          console.error(`楽曲更新エラー (${fix.title}):`, updateError)
        } else {
          console.log(`楽曲更新成功: ${fix.title}`)
        }
      }
    }

    revalidatePath('/app/friends')
    return { 
      success: true, 
      message: `仮想フレンドの楽曲データを修正しました` 
    }
  } catch (error) {
    console.error('楽曲修正エラー:', error)
    return { error: '楽曲修正に失敗しました' }
  }
}
