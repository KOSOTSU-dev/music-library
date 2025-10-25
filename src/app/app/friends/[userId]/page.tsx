import { redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/server-supabase'

interface Props {
  params: Promise<{ userId: string }>
}

export default async function FriendPage({ params }: Props) {
  const { userId } = await params
  const supabase = await getServerSupabase()
  
  console.log('🔍 フレンドページ - 最初の棚取得開始:', { userId })
  
  // ユーザーが仮想フレンドかどうかをチェック
  const { data: userData } = await supabase
    .from('users')
    .select('username')
    .eq('id', userId)
    .single()
  
  const isVirtualFriend = userData?.username?.startsWith('virtual_')
  
  // 仮想フレンドの場合のみSpotify認証をチェック
  if (isVirtualFriend) {
    const { data: { session } } = await supabase.auth.getSession()
    const spotifyToken = session?.provider_token
    
    if (!spotifyToken) {
      console.log('❌ フレンドページ - 仮想フレンドのギャラリーでSpotify認証が切れています')
      // クライアントサイドでSpotify認証エラーを表示するため、特別なパラメータを付けてリダイレクト
      return redirect(`/app/friends/${userId}/shelf/not-found?spotify_auth_required=true`)
    }
  }
  
  // そのユーザーの最初の棚を取得
  const { data: firstShelf, error } = await supabase
    .from('shelves')
    .select('id')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .limit(1)
    .single()
  
  console.log('🔍 フレンドページ - 最初の棚結果:', { firstShelf, error })
  
  if (error || !firstShelf) {
    console.log('❌ フレンドページ - 棚が見つからない、not-foundにリダイレクト')
    return redirect('/app/friends/not-found')
  }
  
  // 最初の棚にリダイレクト
  console.log('✅ フレンドページ - 最初の棚にリダイレクト:', firstShelf.id)
  return redirect(`/app/friends/${userId}/shelf/${firstShelf.id}`)
}
