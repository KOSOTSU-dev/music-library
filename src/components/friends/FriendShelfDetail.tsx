"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowLeft, Calendar, Music, Heart, MessageCircle, Play, Pause, ExternalLink, ChevronDown, Share2 } from "lucide-react"
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
        // 現在のユーザーIDを取得
        const { data: { user } } = await supabase.auth.getUser()
        setCurrentUserId(user?.id || null)

        // フレンドの全公開棚を取得
        const { data: allShelvesData, error: allShelvesError } = await supabase
          .from('shelves')
          .select(`
            *,
            user:users(*)
          `)
          .eq('user_id', userId)
          .eq('is_public', true)
          .order('sort_order', { ascending: true })

        if (allShelvesError) {
          console.error('棚一覧の読み込みエラー:', allShelvesError)
        } else {
          setAllShelves(allShelvesData || [])
        }

        // 棚の詳細情報を取得
        const { data: shelfData, error: shelfError } = await supabase
          .from('shelves')
          .select(`
            *,
            user:users(*)
          `)
          .eq('id', shelfId)
          .eq('user_id', userId)
          .eq('is_public', true)
          .single()

        if (shelfError || !shelfData) {
          setError('棚が見つからないか、公開されていません')
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
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
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
    <div className="relative min-h-screen">
      <div className="max-w-6xl mx-auto p-6 pb-24 space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/app/friends">
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
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
                  <Button variant="outline" size="sm" className="h-8">
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5" />
              楽曲一覧
              <span className="text-sm text-muted-foreground font-normal ml-2">
                ({items.length}曲)
              </span>
            </CardTitle>
            <Badge variant="outline" className="flex items-center gap-1">
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
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {items.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="cursor-pointer"
                >
                  <Card 
                    className="hover:shadow-md hover:brightness-75 transition-all duration-200"
                    onClick={() => {
                      setSelectedItem(item)
                      setIsModalOpen(true)
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="aspect-[3/4] bg-gradient-to-b from-gray-200 to-gray-300 rounded-lg mb-3 relative overflow-hidden">
                        {item.image_url ? (
                          <img 
                            src={item.image_url} 
                            alt={item.title}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-b from-gray-200 to-gray-300 rounded-lg flex items-center justify-center">
                            <div className="text-gray-500 text-xs text-center p-2">
                              {item.title}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-medium text-sm truncate">{item.title}</h3>
                        <p className="text-xs text-muted-foreground truncate">{item.artist}</p>
                        {item.album && (
                          <p className="text-xs text-muted-foreground truncate">{item.album}</p>
                        )}
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleLike(item.id)
                              }}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
                            >
                              <Heart className={`h-3 w-3 ${userLikes[item.id] ? 'fill-red-500 text-red-500' : ''}`} />
                              <span>{likeCounts[item.id] || 0}</span>
                            </button>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MessageCircle className="h-3 w-3" />
                              <span>{commentCounts[item.id] || 0}</span>
                            </div>
                          </div>
                        </div>
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

    {/* 楽曲詳細モーダル */}
    {selectedItem && (
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="truncate">{selectedItem.title}</DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                aria-label="URLをコピー"
                onClick={() => navigator.clipboard.writeText(spotifyUrl(selectedItem))}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="flex gap-4">
            {selectedItem.image_url ? (
              <img
                src={selectedItem.image_url}
                alt={selectedItem.title}
                className="w-24 h-24 rounded-lg object-cover"
              />
            ) : (
              <div className="w-24 h-24 bg-gradient-to-b from-gray-200 to-gray-300 rounded-lg flex items-center justify-center">
                <div className="text-gray-500 text-xs text-center p-2">
                  {selectedItem.title}
                </div>
              </div>
            )}
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">アーティスト</p>
                <p className="font-medium">{selectedItem.artist}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">種別: {selectedItem.spotify_type}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <motion.button
              type="button"
              className="group relative inline-flex items-center h-10 rounded-lg border border-border bg-background hover:bg-accent overflow-hidden px-4"
              onClick={() => openInSpotify(selectedItem.spotify_type, selectedItem.spotify_id)}
              onMouseEnter={() => setHoveredButton(0)}
              onMouseLeave={() => setHoveredButton(null)}
            >
              <span className="flex items-center justify-center flex-shrink-0">
                <ExternalLink className="h-4 w-4" />
              </span>
              <AnimatePresence>
                {hoveredButton === 0 && (
                  <motion.span
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "auto", opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
                    className="overflow-hidden whitespace-nowrap ml-2 text-sm"
                  >
                    Spotifyで開く
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
            <motion.button
              type="button"
              className="group relative inline-flex items-center h-10 rounded-lg border border-border bg-background hover:bg-accent overflow-hidden px-4"
              onClick={() => toast({ title: 'いいね！' })}
              onMouseEnter={() => setHoveredButton(1)}
              onMouseLeave={() => setHoveredButton(null)}
            >
              <span className="flex items-center justify-center flex-shrink-0">
                <Heart className="h-4 w-4" />
              </span>
              <AnimatePresence>
                {hoveredButton === 1 && (
                  <motion.span
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "auto", opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
                    className="overflow-hidden whitespace-nowrap ml-2 text-sm"
                  >
                    いいね
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
            <motion.button
              type="button"
              className="group relative inline-flex items-center h-10 rounded-lg border border-border bg-background hover:bg-accent overflow-hidden px-4"
              onClick={() => toast({ title: 'コメント機能' })}
              onMouseEnter={() => setHoveredButton(2)}
              onMouseLeave={() => setHoveredButton(null)}
            >
              <span className="flex items-center justify-center flex-shrink-0">
                <MessageCircle className="h-4 w-4" />
              </span>
              <AnimatePresence>
                {hoveredButton === 2 && (
                  <motion.span
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "auto", opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
                    className="overflow-hidden whitespace-nowrap ml-2 text-sm"
                  >
                    コメント
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
            <motion.button
              type="button"
              className="group relative inline-flex items-center h-10 rounded-lg border border-border bg-background hover:bg-accent overflow-hidden px-4"
              onClick={handleModalPlay}
              onMouseEnter={() => setHoveredButton(3)}
              onMouseLeave={() => setHoveredButton(null)}
            >
              <span className="flex items-center justify-center flex-shrink-0">
                <Play className="h-4 w-4" />
              </span>
              <AnimatePresence>
                {hoveredButton === 3 && (
                  <motion.span
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "auto", opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
                    className="overflow-hidden whitespace-nowrap ml-2 text-sm"
                  >
                    再生
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
            <motion.button
              type="button"
              className="group relative inline-flex items-center h-10 rounded-lg border border-border bg-background hover:bg-accent overflow-hidden px-4"
              onClick={handleModalPause}
              onMouseEnter={() => setHoveredButton(4)}
              onMouseLeave={() => setHoveredButton(null)}
            >
              <span className="flex items-center justify-center flex-shrink-0">
                <Pause className="h-4 w-4" />
              </span>
              <AnimatePresence>
                {hoveredButton === 4 && (
                  <motion.span
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "auto", opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
                    className="overflow-hidden whitespace-nowrap ml-2 text-sm"
                  >
                    一時停止
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </DialogContent>
      </Dialog>
    )}

    <GlobalPlayer />
  </div>
)
}
