"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowLeft, Calendar, Music, Heart, MessageCircle, Play, Pause, ExternalLink, ChevronDown, Share2, Trash2 } from "lucide-react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import CommentSection from "@/components/comments/CommentSection"
import { useToast } from "@/hooks/use-toast"
import GlobalPlayer from "@/components/GlobalPlayer"
import { toggleLike, getLikeCount, getCommentCount } from "@/app/app/comments-likes-actions"

interface User {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
}

interface Shelf {
  id: string
  name: string
  description: string | null
  is_public: boolean
  created_at: string
  user: User
}

interface ShelfItem {
  id: string
  title: string
  artist: string
  album: string | null
  image_url: string | null
  spotify_type: string
  spotify_id: string
  position: number
}

interface Props {
  userId: string
  shelfId: string
}

export default function FriendShelfDetail({ userId, shelfId }: Props) {
  const [shelf, setShelf] = useState<Shelf | null>(null)
  const [items, setItems] = useState<ShelfItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [allShelves, setAllShelves] = useState<Shelf[]>([])
  const [selectedItem, setSelectedItem] = useState<ShelfItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [hoveredButton, setHoveredButton] = useState<number | null>(null)
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [userLikes, setUserLikes] = useState<Record<string, boolean>>({})
  const { toast } = useToast()

  const loadCounts = async (items: ShelfItem[]) => {
    try {
      const counts = await Promise.all(
        items.map(async (item) => {
          const [likeResult, commentResult] = await Promise.all([
            getLikeCount(item.id),
            getCommentCount(item.id)
          ])
          return {
            itemId: item.id,
            likeCount: likeResult.count || 0,
            commentCount: commentResult.count || 0
          }
        })
      )
      
      const newLikeCounts: Record<string, number> = {}
      const newCommentCounts: Record<string, number> = {}
      
      counts.forEach(({ itemId, likeCount, commentCount }) => {
        newLikeCounts[itemId] = likeCount
        newCommentCounts[itemId] = commentCount
      })
      
      setLikeCounts(newLikeCounts)
      setCommentCounts(newCommentCounts)
    } catch (error) {
      console.error('Failed to load counts:', error)
    }
  }

  const handleLike = async (itemId: string) => {
    try {
      const formData = new FormData()
      formData.set('shelfItemId', itemId)
      
      const result = await toggleLike(formData)
      if (result.error) {
        toast({ title: 'エラー', description: result.error, variant: 'destructive' })
        return
      }
      
      // いいね数を更新
      setLikeCounts(prev => ({
        ...prev,
        [itemId]: prev[itemId] + (result.liked ? 1 : -1)
      }))
      
      // ユーザーのいいね状態を更新
      setUserLikes(prev => ({
        ...prev,
        [itemId]: result.liked
      }))
      
      toast({ 
        title: '成功', 
        description: result.liked ? 'いいねしました' : 'いいねを取り消しました' 
      })
    } catch (error) {
      console.error('Failed to toggle like:', error)
      toast({ title: 'エラー', description: 'いいねの処理に失敗しました', variant: 'destructive' })
    }
  }

  const openInSpotify = (spotifyType: string, spotifyId: string) => {
    const url = spotifyType === 'track'
      ? `https://open.spotify.com/track/${spotifyId}`
      : spotifyType === 'album'
        ? `https://open.spotify.com/album/${spotifyId}`
        : `https://open.spotify.com/${spotifyType}/${spotifyId}`
    window.open(url, '_blank')
  }

  const handlePlay = async (item: ShelfItem) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken: string | undefined = (session as any)?.provider_token || (session as any)?.providerToken
      if (!accessToken) {
        toast({ title: 'Spotifyに再ログインしてください', description: '' })
        return
      }

      // デバイス確認
      const devicesRes = await fetch('https://api.spotify.com/v1/me/player/devices', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      const devices = await devicesRes.json()
      
      if (devices.devices && devices.devices.length > 0) {
        // アクティブデバイスがない場合は最初のデバイスに転送
        const activeDevice = devices.devices.find((d: any) => d.is_active)
        if (!activeDevice) {
          await fetch('https://api.spotify.com/v1/me/player', {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_ids: [devices.devices[0].id] })
          })
        }
      }

      // 再生開始
      const playRes = await fetch('https://api.spotify.com/v1/me/player/play', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: [`spotify:track:${item.spotify_id}`] })
      })

      if (playRes.ok) {
        // 楽曲の詳細情報を取得してからイベントを送信
        try {
          const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${item.spotify_id}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          })
          
          if (trackRes.ok) {
            const trackData = await trackRes.json()
            window.dispatchEvent(new CustomEvent('track:playing', {
              detail: {
                id: item.spotify_id,
                title: item.title,
                artist: item.artist,
                album: item.album,
                image_url: item.image_url,
                duration_ms: trackData.duration_ms, // 実際の楽曲の長さを取得
                shelfItems: items // フレンドの棚の楽曲リストを送信
              }
            }))
          } else {
            // 楽曲情報取得に失敗した場合は従来通り
            window.dispatchEvent(new CustomEvent('track:playing', {
              detail: {
                id: item.spotify_id,
                title: item.title,
                artist: item.artist,
                album: item.album,
                image_url: item.image_url,
                duration_ms: 0,
                shelfItems: items
              }
            }))
          }
        } catch (trackError) {
          console.error('楽曲詳細取得エラー:', trackError)
          // エラーの場合は従来通り
          window.dispatchEvent(new CustomEvent('track:playing', {
            detail: {
              id: item.spotify_id,
              title: item.title,
              artist: item.artist,
              album: item.album,
              image_url: item.image_url,
              duration_ms: 0,
              shelfItems: items
            }
          }))
        }
      }
    } catch (e) {
      console.error('再生エラー:', e)
      // 失敗しても致命的ではない
    }
  }

  useEffect(() => {
    const loadShelfData = async () => {
      try {
        // shelfIdが"not-found"または無効なUUIDの場合はエラーページを表示
        if (shelfId === 'not-found' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shelfId)) {
          console.log('❌ フレンドギャラリー - 無効な棚ID:', shelfId)
          setError('ギャラリーが存在しません')
          return
        }

        // 現在のユーザーIDを取得
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        console.log('🔐 フレンドギャラリー - 認証状態:', { user: user?.id, authError })
        setCurrentUserId(user?.id || null)

        // フレンドの全棚を取得
        console.log('📚 フレンドギャラリー - 全棚取得:', { userId })
        const { data: allShelvesData, error: allShelvesError } = await supabase
          .from('shelves')
          .select(`
            *,
            user:users(*)
          `)
          .eq('user_id', userId)
          .order('sort_order', { ascending: true })

        console.log('📚 フレンドギャラリー - 全棚結果:', { allShelvesData, allShelvesError })

        if (allShelvesError) {
          console.error('❌ 棚一覧の読み込みエラー:', allShelvesError)
        } else {
          console.log('✅ 棚一覧の読み込み成功:', allShelvesData?.length || 0, '個の棚')
          setAllShelves(allShelvesData || [])
        }

        // 棚の詳細情報を取得
        console.log('🔍 フレンドギャラリー - 棚詳細取得開始:', { userId, shelfId })
        
        // まず、その棚IDが存在するかどうかを確認
        const { data: shelfExists, error: existsError } = await supabase
          .from('shelves')
          .select('id, user_id')
          .eq('id', shelfId)
          .single()
        
        console.log('✅ フレンドギャラリー - 棚存在確認:', { shelfExists, existsError })
        
        // デバッグ: そのユーザーの全棚を確認
        const { data: userShelves, error: userShelvesError } = await supabase
          .from('shelves')
          .select('id, name, user_id')
          .eq('user_id', userId)
        
        console.log('📋 フレンドギャラリー - ユーザーの全棚:', { userShelves, userShelvesError })
        
        // デバッグ: その棚IDの全データを確認
        const { data: allShelfData, error: allShelfError } = await supabase
          .from('shelves')
          .select('*')
          .eq('id', shelfId)
        
        console.log('🗂️ フレンドギャラリー - 棚IDの全データ:', { allShelfData, allShelfError })
        
        const { data: shelfData, error: shelfError } = await supabase
          .from('shelves')
          .select(`
            *,
            user:users(*)
          `)
          .eq('id', shelfId)
          .single()

        console.log('🎯 フレンドギャラリー - 棚詳細結果:', { shelfData, shelfError })

        if (shelfError || !shelfData) {
          console.error('❌ フレンドギャラリー - 棚が見つからない:', { 
            shelfError: shelfError ? {
              message: shelfError.message,
              details: shelfError.details,
              hint: shelfError.hint,
              code: shelfError.code
            } : null,
            shelfData,
            shelfId,
            userId
          })
          
          if (shelfError) {
            setError(`ギャラリーの読み込みに失敗しました: ${shelfError.message}`)
          } else {
            setError('ギャラリーが存在しません')
          }
          return
        }

        // 棚が指定されたユーザーのものかどうかを確認
        if (shelfData.user_id !== userId) {
          console.error('フレンドギャラリー - 棚の所有者が一致しません:', { 
            shelfUserId: shelfData.user_id, 
            requestedUserId: userId 
          })
          setError('ギャラリーが存在しません')
          return
        }

        setShelf(shelfData)

        // 棚のアイテムを取得
        const { data: itemsData, error: itemsError } = await supabase
          .from('shelf_items')
          .select('*')
          .eq('shelf_id', shelfId)
          .order('position', { ascending: true })

        if (itemsError) {
          setError('アイテムの読み込みに失敗しました')
          return
        }

        const baseItems = itemsData || []
        console.log('フレンドギャラリー - 取得したアイテム:', baseItems.map(item => ({
          id: item.id,
          title: item.title,
          image_url: item.image_url,
          spotify_id: item.spotify_id
        })))
        setItems(baseItems)
        
        // いいね数とコメント数を取得
        await loadCounts(baseItems)

        // 画像URLをSpotifyから取得して常に最新に上書き（DBは変更せず表示のみ上書き）
        try {
          const { data: { session } } = await supabase.auth.getSession()
          const accessToken = (session as any)?.provider_token || (session as any)?.providerToken
          console.log('フレンドギャラリー - アクセストークン:', accessToken ? 'あり' : 'なし')
          
          if (accessToken && baseItems.length > 0) {
            // 各楽曲を個別に検索して正しい画像を取得（楽曲名とアーティスト名で検索）
            for (const item of baseItems) {
              if (item.spotify_type !== 'track' || !item.title || !item.artist) continue
              
              try {
                console.log(`楽曲検索中: ${item.title} by ${item.artist}`)
                
                // 楽曲名とアーティスト名で検索
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
                const correctImageUrl = correctTrack.album?.images?.[0]?.url

                if (correctImageUrl && correctImageUrl !== item.image_url) {
                  console.log(`楽曲画像更新: ${item.title} -> ${correctImageUrl}`)
                  setItems((prev) => prev.map((it) => {
                    if (it.id === item.id) {
                      return { ...it, image_url: correctImageUrl }
                    }
                    return it
                  }))
                }

                // APIレート制限を避けるため少し待機
                await new Promise(resolve => setTimeout(resolve, 100))

              } catch (searchError) {
                console.warn(`楽曲検索エラー: ${item.title}`, searchError)
              }
            }
          }
        } catch (e) {
          // 画像補完失敗は致命的でないため無視
          console.error('フレンドギャラリー - 画像補完エラー:', e)
        }
      } catch (error) {
        setError('データの読み込みに失敗しました')
      } finally {
        setIsLoading(false)
      }
    }

    loadShelfData()
  }, [userId, shelfId])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const handleModalPlay = async () => {
    if (!selectedItem) return
    await handlePlay(selectedItem)
  }

  const handleModalPause = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken: string | undefined = (session as any)?.provider_token || (session as any)?.providerToken
      if (!accessToken) {
        toast({ title: 'エラー', description: 'Spotifyに再ログインしてください', variant: 'destructive' })
        return
      }

      const pauseRes = await fetch('https://api.spotify.com/v1/me/player/pause', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })

      if (!pauseRes.ok) {
        toast({ title: 'エラー', description: '一時停止に失敗しました', variant: 'destructive' })
      }
    } catch (e) {
      console.error('一時停止エラー:', e)
      toast({ title: 'エラー', description: '一時停止に失敗しました', variant: 'destructive' })
    }
  }

  const spotifyUrl = (item: ShelfItem) => {
    return `https://open.spotify.com/${item.spotify_type}/${item.spotify_id}`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white grid place-items-center">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent mx-auto mb-4"></div>
          <p>読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error || !shelf) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <Button asChild>
            <Link href="/app/friends">
              <ArrowLeft className="h-4 w-4 mr-2" />
              フレンド一覧に戻る
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-black text-white">
      <div className="w-full px-6 pb-24 space-y-1">
        {/* ヘッダー */}
        <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="sm" className="text-white bg-[#1a1a1a] border-[#1a1a1a] hover:bg-[#333333]">
          <Link href="/app/friends">
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 mt-3">
            <Avatar className="h-6 w-6">
              <AvatarImage src={shelf.user.avatar_url || undefined} />
              <AvatarFallback>{shelf.user.display_name[0]}</AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground">{shelf.user.display_name}</span>
          </div>
          
          {/* 棚選択ドロップダウン */}
          {allShelves.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">棚:</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-white bg-[#1a1a1a] border-[#1a1a1a] hover:bg-[#333333]">
                    {shelf.name}
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {allShelves.map((s) => (
                    <DropdownMenuItem key={s.id} asChild>
                      <Link href={`/app/friends/${userId}/shelf/${s.id}`}>
                        {s.name}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      {/* アイテム一覧 */}
      <Card className="bg-[#1a1a1a] border-[#333333]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white">
              <Music className="h-5 w-5" />
              {shelf?.name || 'ギャラリー'}
              <span className="text-sm text-muted-foreground font-normal ml-2">
                ({items.length}曲)
              </span>
            </CardTitle>
            <Badge variant="outline" className="flex items-center gap-1 bg-[#333333] text-white border-[#333333]">
              <Calendar className="h-3 w-3" />
              {formatDate(shelf.created_at)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              この棚にはまだ楽曲がありません
            </p>
          ) : (
            <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
              {items.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="cursor-pointer"
                >
                  <Card 
                    className="group transition-colors duration-200 bg-[#333333] hover:bg-[#4d4d4d] border-[#333333] py-1 gap-1"
                  >
                    <CardContent className="px-2 py-0">
                      <div className="aspect-square rounded-lg mb-2 mt-1 relative overflow-hidden bg-[#333333] group">
                        {item.image_url ? (
                          <img 
                            src={item.image_url} 
                            alt={item.title}
                            className="w-full h-full object-contain rounded-lg transition-opacity duration-200 group-hover:opacity-50"
                          />
                        ) : (
                          <div className="w-full h-full rounded-lg flex items-center justify-center bg-[#333333] transition-opacity duration-200 group-hover:opacity-50">
                            <div className="text-gray-400 text-xs text-center p-2">
                              {item.title}
                            </div>
                          </div>
                        )}
                        

                        {/* ホバー時の再生・開くボタン */}
                        <div className="absolute inset-0 flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handlePlay(item)
                              }}
                              className="bg-transparent text-white hover:bg-transparent rounded-full p-2 transition-all duration-200 hover:scale-110"
                              title="再生"
                            >
                              <Play className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                window.open(`https://open.spotify.com/${item.spotify_type}/${item.spotify_id}`, '_blank')
                              }}
                              className="bg-transparent text-white hover:bg-transparent rounded-full p-2 transition-all duration-200 hover:scale-110"
                              title="Spotifyで開く"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1 text-white">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium text-sm truncate text-white flex-1 min-w-0">{item.title}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{item.artist}</p>
                        {item.album && (
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground truncate flex-1 min-w-0">{item.album}</p>
                            <div className="flex items-center gap-2 ml-auto">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleLike(item.id)
                                }}
                                className="flex items-center gap-1 text-xs text-white hover:text-red-500 transition-colors"
                              >
                                <Heart className={`h-4 w-4 ${userLikes[item.id] ? 'fill-red-500 text-red-500' : ''}`} />
                                <span>{likeCounts[item.id] || 0}</span>
                              </button>
                              <div className="flex items-center gap-1 text-xs text-white hover:-translate-y-1 transition-transform duration-200 ease-out">
                                <MessageCircle className="h-4 w-4" />
                                <span>{commentCounts[item.id] || 0}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>

    {/* 画像モーダルは廃止 */}

    <GlobalPlayer />
  </div>
)
}
