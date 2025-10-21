import { redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/server-supabase'

interface Props {
  params: Promise<{ userId: string }>
}

export default async function FriendFirstShelfPage({ params }: Props) {
  const { userId } = await params
  const supabase = await getServerSupabase()
  
  console.log('🔍 フレンド最初の棚取得開始:', { userId })
  
  // デバッグ: そのユーザーの全棚を確認
  const { data: allShelves, error: allShelvesError } = await supabase
    .from('shelves')
    .select('id, name, user_id, sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
  
  console.log('📋 フレンドの全棚:', { allShelves, allShelvesError })
  
  // ユーザーの最初の棚を取得
  const { data: firstShelf, error: firstShelfError } = await supabase
    .from('shelves')
    .select('id')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .limit(1)
    .single()

  console.log('📚 フレンド最初の棚結果:', { firstShelf, firstShelfError })

  if (firstShelf) {
    console.log('✅ 棚が見つかりました、リダイレクト:', firstShelf.id)
    redirect(`/app/friends/${userId}/shelf/${firstShelf.id}`)
  } else {
    console.log('❌ 棚が見つかりません、not-foundにリダイレクト')
    // 棚がない場合はエラーページにリダイレクト
    redirect(`/app/friends/${userId}/shelf/not-found`)
  }
}
