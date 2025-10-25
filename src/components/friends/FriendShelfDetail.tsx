"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ArrowLeft, Calendar, Music, Heart, MessageCircle, Play, Pause, ExternalLink, ChevronDown, Share2, Trash2, StickyNote, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import CommentSection from "@/components/comments/CommentSection"
import CommentModal from '@/components/comments/CommentModal'
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
  const [commentModalOpen, setCommentModalOpen] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [likedUsers, setLikedUsers] = useState<Record<string, User[]>>({})
  const [showLikedUsers, setShowLikedUsers] = useState<string | null>(null)
  const [itemDetailOpen, setItemDetailOpen] = useState(false)
  const { toast } = useToast()
  
  // ナビゲーション機能
  const currentIndex = selectedItem && items ? items.findIndex(item => item.id === selectedItem.id) : -1
  const hasPrevious = currentIndex > 0
  const hasNext = currentIndex < (items?.length || 0) - 1

  const handlePrevious = () => {
    if (hasPrevious && items) {
      setSelectedItem(items[currentIndex - 1])
    }
  }

  const handleNext = () => {
    if (hasNext && items) {
      setSelectedItem(items[currentIndex + 1])
    }
  }


  const handleItemClick = (item: ShelfItem) => {
    setSelectedItem(item)
    setItemDetailOpen(true)
  }

  const loadCounts = async (items: ShelfItem[]) => {
    try {
      // currentUserIdが設定されていない場合は待機
      if (!currentUserId) {
        console.log('currentUserIdが未設定のため、loadCountsをスキップします')
        return
      }

      const counts = await Promise.all(
        items.map(async (item) => {
          // 直接Supabaseクライアントを使用してカウントを取得
          const [likeCountResult, commentCountResult] = await Promise.all([
            supabase
              .from('likes')
              .select('*', { count: 'exact', head: true })
              .eq('shelf_item_id', item.id),
            supabase
              .from('comments')
              .select('*', { count: 'exact', head: true })
              .eq('shelf_item_id', item.id)
          ])
          
          const likeCount = likeCountResult.count || 0
          const commentCount = commentCountResult.count || 0
          
          console.log('カウント取得結果:', { 
            itemId: item.id, 
            likeCount, 
            commentCount,
            likeError: likeCountResult.error,
            commentError: commentCountResult.error
          })
          // 自分がいいねしているかを確認
          let likedByMe = false
          try {
            console.log('いいね確認開始:', { itemId: item.id, currentUserId })
            const { data } = await supabase
              .from('likes')
              .select('user_id')
              .eq('shelf_item_id', item.id)
              .eq('user_id', currentUserId)
            console.log('いいね確認結果:', { data, itemId: item.id })
            likedByMe = !!(data && data.length > 0)
          } catch (error) {
            console.error('いいね状態確認エラー:', error)
          }

          return {
            itemId: item.id,
            likeCount: likeCount,
            commentCount: commentCount,
            likedByMe
          }
        })
      )
      
      const newLikeCounts: Record<string, number> = {}
      const newCommentCounts: Record<string, number> = {}
      const newUserLikes: Record<string, boolean> = {}
      
      counts.forEach(({ itemId, likeCount, commentCount, likedByMe }) => {
        newLikeCounts[itemId] = likeCount
        newCommentCounts[itemId] = commentCount
        newUserLikes[itemId] = !!likedByMe
        console.log(`アイテム ${itemId}: いいね数=${likeCount}, コメント数=${commentCount}, いいね済み=${likedByMe}`)
      })
      
      console.log('最終的なコメント数設定:', newCommentCounts)
      
      setLikeCounts(newLikeCounts)
      setCommentCounts(newCommentCounts)
      setUserLikes(newUserLikes)
    } catch (error) {
      console.error('Failed to load counts:', error)
    }
  }

  const loadLikedUsers = async (itemId: string) => {
    try {
      const { data, error } = await supabase
        .from('likes')
        .select(`
          user:users(id, display_name, avatar_url)
        `)
        .eq('shelf_item_id', itemId)

      if (error) {
        console.error('いいねユーザー取得エラー:', error)
        return
      }

      const users = data?.map(like => like.user).filter(Boolean) as User[]
      setLikedUsers(prev => ({
        ...prev,
        [itemId]: users
      }))
    } catch (error) {
      console.error('いいねユーザー取得エラー:', error)
    }
  }

  const handleLike = async (itemId: string) => {
    try {
      if (!currentUserId) {
        toast({ title: 'エラー', description: 'ログインが必要です', variant: 'destructive' })
        return
      }

      // 現在のいいね状態を確認
      console.log('いいね確認開始:', { itemId, currentUserId })
      
      const { data: existingLikes, error: fetchError } = await supabase
        .from('likes')
        .select('id')
        .eq('shelf_item_id', itemId)
        .eq('user_id', currentUserId)

      console.log('いいね確認結果:', { existingLikes, fetchError })

      if (fetchError) {
        console.error('いいね確認エラー詳細:', {
          message: fetchError.message,
          details: fetchError.details,
          hint: fetchError.hint,
          code: fetchError.code
        })
        toast({ title: 'エラー', description: `いいねの確認に失敗しました: ${fetchError.message}`, variant: 'destructive' })
        return
      }

      const existingLike = existingLikes && existingLikes.length > 0
      console.log('いいね状態:', existingLike)

      if (existingLike) {
        // いいねを削除
        const { error: deleteError } = await supabase
          .from('likes')
          .delete()
          .eq('shelf_item_id', itemId)
          .eq('user_id', currentUserId)

        if (deleteError) {
          console.error('いいね削除エラー:', deleteError)
          toast({ title: 'エラー', description: 'いいねの削除に失敗しました', variant: 'destructive' })
          return
        }

        // いいね数を更新
        setLikeCounts(prev => ({
          ...prev,
          [itemId]: Math.max(0, (prev[itemId] || 0) - 1)
        }))
        
        // ユーザーのいいね状態を更新
        setUserLikes(prev => ({
          ...prev,
          [itemId]: false
        }))
      } else {
        // いいねを追加
        const { error: insertError } = await supabase
          .from('likes')
          .insert({
            shelf_item_id: itemId,
            user_id: currentUserId
          })

        if (insertError) {
          console.error('いいね追加エラー:', insertError)
          toast({ title: 'エラー', description: 'いいねの追加に失敗しました', variant: 'destructive' })
          return
        }

        // いいね数を更新
        setLikeCounts(prev => ({
          ...prev,
          [itemId]: (prev[itemId] || 0) + 1
        }))
        
        // ユーザーのいいね状態を更新
        setUserLikes(prev => ({
          ...prev,
          [itemId]: true
        }))
      }
    } catch (error) {
      console.error('いいね処理エラー:', error)
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

  const handlePlay = async (item: ShelfItem, retryCount = 0) => {
    try {
      console.log(`再生試行 ${retryCount + 1}回目:`, item.title)
      
      // セッションを再取得（初回再生時の認証問題を回避）
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken: string | undefined = (session as any)?.provider_token || (session as any)?.providerToken
      
      if (!accessToken) {
        console.log('アクセストークンが見つかりません')
        window.dispatchEvent(new CustomEvent('spotify:reauth-required'))
        toast({ title: 'Spotifyに再ログインしてください' })
        return
      }

      console.log('アクセストークン取得成功')

      // デバイス確認
      const devicesRes = await fetch('https://api.spotify.com/v1/me/player/devices', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      const devices = await devicesRes.json()
      
      console.log('デバイス一覧:', devices.devices?.length || 0, '個のデバイス')
      
      if (devices.devices && devices.devices.length > 0) {
        // アクティブデバイスがない場合は最初のデバイスに転送
        const activeDevice = devices.devices.find((d: any) => d.is_active)
        if (!activeDevice) {
          console.log('アクティブデバイスが見つからないため、デバイス転送を実行')
          const transferRes = await fetch('https://api.spotify.com/v1/me/player', {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_ids: [devices.devices[0].id] })
          })
          
          if (transferRes.ok) {
            console.log('デバイス転送成功、少し待機します')
            // デバイス転送後に少し待機（初回再生時の問題を回避）
            await new Promise(resolve => setTimeout(resolve, 1000))
          } else {
            console.log('デバイス転送失敗:', transferRes.status)
          }
        } else {
          console.log('アクティブデバイスが見つかりました:', activeDevice.name)
        }
      }

      // 再生開始
      console.log('再生開始:', item.spotify_id)
      const playRes = await fetch('https://api.spotify.com/v1/me/player/play', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: [`spotify:track:${item.spotify_id}`] })
      })

      console.log('再生レスポンス:', playRes.status, playRes.statusText)

      if (playRes.status === 401) {
        console.log('認証エラー、再認証が必要')
        window.dispatchEvent(new CustomEvent('spotify:reauth-required'))
        toast({ title: 'Spotifyに再ログインしてください' })
        return
      }

      if (playRes.status === 404) {
        console.log('デバイスが見つからない、リトライします')
        if (retryCount < 2) {
          console.log(`${1000 * (retryCount + 1)}ms後にリトライします`)
          setTimeout(() => handlePlay(item, retryCount + 1), 1000 * (retryCount + 1))
          return
        } else {
          console.log('リトライ回数上限に達しました')
          toast({ title: 'エラー', description: 'デバイスが見つかりません。Spotifyアプリを開いてください。', variant: 'destructive' })
          return
        }
      }

      if (playRes.ok) {
        console.log('再生成功')
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
      } else {
        console.log('再生失敗:', playRes.status, playRes.statusText)
        const errorText = await playRes.text()
        console.log('エラー詳細:', errorText)
        
        // 初回再生時の一般的な問題（デバイス未準備）の場合はリトライ
        if (playRes.status === 400 && retryCount < 2) {
          console.log('初回再生エラー、リトライします')
          setTimeout(() => handlePlay(item, retryCount + 1), 1000 * (retryCount + 1))
          return
        }
        
        toast({ title: '再生に失敗しました', description: 'Spotifyアプリを開いてからもう一度お試しください', variant: 'destructive' })
      }
    } catch (e) {
      console.error('再生エラー:', e)
      if (retryCount < 2) {
        console.log('例外エラー、リトライします')
        setTimeout(() => handlePlay(item, retryCount + 1), 1000 * (retryCount + 1))
        return
      }
      toast({ title: '再生エラー', description: '予期しないエラーが発生しました', variant: 'destructive' })
    }
  }

  // currentUserIdが設定された後にloadCountsを呼び出す
  useEffect(() => {
    if (currentUserId && items.length > 0) {
      console.log('currentUserId設定後、loadCountsを呼び出します（useEffect）')
      loadCounts(items)
    }
  }, [currentUserId, items])

  useEffect(() => {
    // コメント・いいね数の更新イベントをリッスン
    const handleCommentAdded = (e?: any) => {
      // 楽観的に対象アイテムのコメント数だけ+1（即時反映）
      try {
        const targetId = e?.detail?.shelfItemId as string | undefined
        if (targetId) {
          setCommentCounts(prev => ({ ...prev, [targetId]: (prev[targetId] || 0) + 1 }))
        }
      } catch {}
      // 直後に正確な値で再取得
      if (currentUserId && items.length > 0) {
        loadCounts(items)
      }
    }
    
    const handleLikeToggled = () => {
      if (currentUserId && items.length > 0) {
        loadCounts(items)
      }
    }
    
    const handleCommentDeleted = (e?: any) => {
      // 楽観的に対象アイテムのコメント数だけ-1（即時反映）
      try {
        const targetId = e?.detail?.shelfItemId as string | undefined
        if (targetId) {
          setCommentCounts(prev => ({ ...prev, [targetId]: Math.max(0, (prev[targetId] || 0) - 1) }))
        }
      } catch {}
      // 直後に正確な値で再取得
      if (currentUserId && items.length > 0) {
        loadCounts(items)
      }
    }

    window.addEventListener('comment:added', handleCommentAdded as any)
    window.addEventListener('comment:deleted', handleCommentDeleted as any)
    window.addEventListener('like:toggled', handleLikeToggled)

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
        
        // currentUserIdを設定してからloadCountsを呼び出し
        if (user?.id) {
          console.log('currentUserId設定後、loadCountsを呼び出します')
        }

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
        
        // いいね数とコメント数を取得（currentUserIdが設定された後）
        if (user?.id) {
          console.log('currentUserId設定後、loadCountsを呼び出します')
          await loadCounts(baseItems)
        } else {
          console.log('currentUserIdが未設定のため、loadCountsをスキップします')
        }

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

    return () => {
      window.removeEventListener('comment:added', handleCommentAdded as any)
      window.removeEventListener('comment:deleted', handleCommentDeleted as any)
      window.removeEventListener('like:toggled', handleLikeToggled)
    }
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
        window.dispatchEvent(new CustomEvent('spotify:reauth-required'))
        toast({ title: 'Spotifyに再ログインしてください' })
        return
      }

      const pauseRes = await fetch('https://api.spotify.com/v1/me/player/pause', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })

      if (pauseRes.status === 401) {
        window.dispatchEvent(new CustomEvent('spotify:reauth-required'))
        toast({ title: 'Spotifyに再ログインしてください' })
        return
      }

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
        <Button asChild variant="outline" size="sm" className="text-white bg-[#1a1a1a] border-[#1a1a1a] hover:bg-[#333333] hover:text-white">
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
                    onClick={() => handleItemClick(item)}
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
                                if (currentUserId === shelf?.user_id) {
                                  // 自分のギャラリーの場合、いいねした人の一覧を表示
                                  if (!likedUsers[item.id]) {
                                    loadLikedUsers(item.id)
                                  }
                                  setShowLikedUsers(showLikedUsers === item.id ? null : item.id)
                                } else {
                                  // フレンドギャラリーの場合、いいねを実行
                                  handleLike(item.id)
                                }
                              }}
                              className="flex items-center gap-1 text-xs text-white transition-colors"
                            >
                              <Heart className={`h-4 w-4 ${userLikes[item.id] ? 'fill-red-500 text-red-500' : 'text-white hover:text-pink-400'}`} />
                              <span>{likeCounts[item.id] || 0}</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedItemId(item.id)
                                setCommentModalOpen(true)
                              }}
                              className="flex items-center gap-1 text-xs text-white hover:-translate-y-1 transition-transform duration-200 ease-out"
                            >
                              <MessageCircle className="h-4 w-4" />
                              <span>{(() => {
                                const count = commentCounts[item.id] || 0;
                                console.log(`表示するコメント数: ${item.id} = ${count}`);
                                return count;
                              })()}</span>
                            </button>
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
      
      {/* コメントモーダル */}
      {selectedItemId && (
        <CommentModal
          open={commentModalOpen}
          onOpenChange={setCommentModalOpen}
          shelfItemId={selectedItemId}
          currentUserId={currentUserId}
        />
      )}

      {/* いいねした人の一覧 */}
      {showLikedUsers && likedUsers[showLikedUsers] && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-4 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium">いいねした人</h3>
              <button
                onClick={() => setShowLikedUsers(null)}
                className="text-muted-foreground hover:text-white"
              >
                ×
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {likedUsers[showLikedUsers].map((user) => (
                <div key={user.id} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback>{user.display_name[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-white">{user.display_name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* アイテム詳細モーダル */}
      {selectedItem && (
        <Dialog open={itemDetailOpen} onOpenChange={setItemDetailOpen}>
          <DialogContent className="sm:max-w-[520px] pb-3 bg-[#1a1a1a] text-white [&>button]:text-[#666666] [&>button:hover]:text-red-500 [&>button]:bg-transparent [&>button:hover]:bg-transparent">
            <div className="relative">
              <DialogHeader>
                <DialogTitle className="flex-1 min-w-0 text-white pr-8 mb-2">{selectedItem.title}</DialogTitle>
              </DialogHeader>
              <div className="flex gap-2 -mt-1">
                {/* アルバムアート */}
                <div className="flex-shrink-0">
                  <div className="w-32 h-32 bg-[#333333] rounded-lg overflow-hidden">
                    {selectedItem.image_url ? (
                      <img 
                        src={selectedItem.image_url} 
                        alt={selectedItem.title}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="h-8 w-8 text-[#666666]" />
                      </div>
                    )}
                  </div>
                </div>
                
                {/* メタデータ */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-[#666666]">アーティスト</label>
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => {
                              if (currentUserId === shelf?.user_id) {
                                // 自分のギャラリーの場合はいいねしたユーザーを表示
                                setShowLikedUsers(selectedItem.id)
                              } else {
                                // フレンドのギャラリーの場合はいいねをトグル
                                handleLike(selectedItem.id)
                              }
                            }}
                            className="flex items-center gap-2 text-sm text-[#666666] hover:text-white transition-colors"
                          >
                            <Heart className={`h-4 w-4 ${userLikes[selectedItem.id] ? 'fill-red-500 text-red-500' : ''}`} />
                            {likeCounts[selectedItem.id] || 0}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedItemId(selectedItem.id)
                              setCommentModalOpen(true)
                            }}
                            className="flex items-center gap-2 text-sm text-[#666666] hover:text-white transition-colors"
                          >
                            <MessageCircle className="h-4 w-4" />
                            {commentCounts[selectedItem.id] || 0}
                          </button>
                        </div>
                      </div>
                      <p className="text-base text-white truncate">{selectedItem.artist}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-[#666666]">アルバム</label>
                    <p className="text-base text-white">{selectedItem.album || selectedItem.title}</p>
                    {/* メモ表示 */}
                    {selectedItem.memo && (
                      <div className="flex items-center gap-2 mt-2">
                        <StickyNote className="h-5 w-5 text-gray-500" />
                        <div className="text-base text-white underline">{selectedItem.memo}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* 左右の矢印ナビゲーション */}
            <button
              type="button"
              onClick={handlePrevious}
              disabled={!hasPrevious}
              aria-label="前の曲"
              className={`absolute top-1/2 -translate-y-1/2 -left-1 text-4xl leading-none select-none w-8 h-8 grid place-items-center transition-colors ${hasPrevious ? 'text-gray-500 hover:text-[#999999]' : 'text-gray-300 cursor-not-allowed'}`}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!hasNext}
              aria-label="次の曲"
              className={`absolute top-1/2 -translate-y-1/2 -right-1 text-4xl leading-none select-none w-8 h-8 grid place-items-center transition-colors ${hasNext ? 'text-gray-500 hover:text-[#999999]' : 'text-gray-300 cursor-not-allowed'}`}
            >
              ›
            </button>
            
            <hr className="border-[#333333] -mt-2" />
            
            <DialogFooter className="flex justify-start items-center -mt-4">
              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  className="group flex items-center overflow-hidden w-10 h-10 hover:w-36 transition-all duration-300 rounded-full border-0 bg-gray-200 hover:bg-gray-300 text-gray-700 px-1.5 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                  onClick={() => window.open(`https://open.spotify.com/${selectedItem.spotify_type}/${selectedItem.spotify_id}`, '_blank')}
                  aria-label="Spotifyで開く"
                >
                  <span className="flex items-center justify-center text-foreground ml-0.75">
                    <ExternalLink className="h-5 w-5" />
                  </span>
                  <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    Spotifyで開く
                  </span>
                </button>
                <button
                  type="button"
                  className="group flex items-center overflow-hidden w-10 h-10 hover:w-40 transition-all duration-300 rounded-full border-0 bg-gray-200 hover:bg-gray-300 text-gray-700 px-1.5 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                  onClick={() => {
                    const url = `https://open.spotify.com/${selectedItem.spotify_type}/${selectedItem.spotify_id}`
                    navigator.clipboard.writeText(url)
                    toast({
                      title: "リンクをコピーしました",
                      description: "Spotifyのリンクがクリップボードにコピーされました",
                    })
                  }}
                  aria-label="リンクをコピー"
                >
                  <span className="flex items-center justify-center text-foreground ml-0.75">
                    <Share2 className="h-5 w-5" />
                  </span>
                  <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    リンクをコピー
                  </span>
                </button>
                <button
                  type="button"
                  className="group flex items-center overflow-hidden w-10 h-10 hover:w-20 transition-all duration-300 rounded-full border-0 bg-gray-200 hover:bg-gray-300 text-gray-700 px-1.5 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                  onClick={() => {
                    // 再生機能は実装しない
                  }}
                  disabled
                  aria-label="再生"
                >
                  <span className="flex items-center justify-center text-foreground ml-0.75">
                    <Play className="h-5 w-5" />
                  </span>
                  <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    再生
                  </span>
                </button>
                <button
                  type="button"
                  className="group flex items-center overflow-hidden w-10 h-10 hover:w-28 transition-all duration-300 rounded-full border-0 bg-gray-200 hover:bg-gray-300 text-gray-700 px-1.5 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                  onClick={() => {
                    // 一時停止機能は実装しない
                  }}
                  disabled
                  aria-label="一時停止"
                >
                  <span className="flex items-center justify-center text-foreground ml-0.75">
                    <Pause className="h-5 w-5" />
                  </span>
                  <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    一時停止
                  </span>
                </button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
