import { redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/server-supabase'

interface Props {
  params: Promise<{ userId: string }>
}

export default async function FriendFirstShelfPage({ params }: Props) {
  const { userId } = await params
  const supabase = await getServerSupabase()
  
  // ユーザーの最初の公開棚を取得
  const { data: firstShelf } = await supabase
    .from('shelves')
    .select('id')
    .eq('user_id', userId)
    .eq('is_public', true)
    .order('sort_order', { ascending: true })
    .limit(1)
    .single()

  if (firstShelf) {
    redirect(`/app/friends/${userId}/shelf/${firstShelf.id}`)
  } else {
    // 棚がない場合はエラーページにリダイレクト
    redirect(`/app/friends/${userId}/shelf/not-found`)
  }
}
