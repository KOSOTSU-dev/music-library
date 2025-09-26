"use server"

import { getServerSupabase } from "@/lib/server-supabase"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { revalidatePath } from "next/cache"

// 仮想フレンドの画像URLを更新
export async function updateVirtualFriendImages() {
  console.log('updateVirtualFriendImages 開始')
  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.log('未認証エラー')
    return { error: '未認証です' }
  }
  console.log('認証済みユーザー:', user.id)

  try {
    // 仮想フレンドのユーザーIDを取得（service roleでRLSを回避）
    const { data: virtualUsers, error: virtualUsersError } = await supabaseAdmin
      .from('users')
      .select('id, username')
      .like('spotify_id', 'virtual_%')

    console.log('仮想フレンド検索結果:', { virtualUsers, virtualUsersError })

    if (virtualUsersError) {
      console.error('仮想フレンド検索エラー:', virtualUsersError)
      return { error: '仮想フレンドの検索に失敗しました' }
    }

    if (!virtualUsers || virtualUsers.length === 0) {
      console.log('仮想フレンドが見つかりません')
      return { error: '仮想フレンドが見つかりません' }
    }

    // 各仮想フレンドのサンプル曲の画像URLを更新（service roleで更新）
    for (const virtualUser of virtualUsers) {
      console.log('仮想フレンド処理中:', virtualUser.username)
      if (virtualUser.username === 'testfriend1') {
        // お試しフレンド１の画像URL更新
        console.log('Blinding Lights 画像URL更新開始')
        const { error: updateError } = await supabaseAdmin
          .from('shelf_items')
          .update({ 
            image_url: 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36'
          })
          .eq('title', 'Blinding Lights')
          .eq('artist', 'The Weeknd')

        if (updateError) {
          console.error('Blinding Lights 画像更新エラー:', updateError)
        } else {
          console.log('Blinding Lights 画像URL更新成功')
        }

        const { error: updateError2 } = await supabaseAdmin
          .from('shelf_items')
          .update({ 
            image_url: 'https://i.scdn.co/image/ab67616d0000b273e2e352d89826aef6dbd5ff8f'
          })
          .eq('title', 'Levitating')
          .eq('artist', 'Dua Lipa')

        if (updateError2) {
          console.error('Levitating 画像更新エラー:', updateError2)
        }

        const { error: updateError3 } = await supabaseAdmin
          .from('shelf_items')
          .update({ 
            image_url: 'https://i.scdn.co/image/ab67616d0000b273e2e352d89826aef6dbd5ff8f'
          })
          .eq('title', 'Don\'t Start Now')
          .eq('artist', 'Dua Lipa')

        if (updateError3) {
          console.error('Don\'t Start Now 画像更新エラー:', updateError3)
        }
      }
    }

    revalidatePath('/app/friends')
    console.log('画像URL更新完了')
    return { success: true, message: '仮想フレンドの画像URLを更新しました' }
  } catch (error) {
    console.error('画像URL更新エラー:', error)
    return { error: '画像URL更新に失敗しました' }
  }
}
