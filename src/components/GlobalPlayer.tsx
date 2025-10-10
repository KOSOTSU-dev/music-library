"use client"

import { useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Play, Pause, SkipBack, SkipForward } from "lucide-react"
import { useGlobalPlayer } from "@/hooks/useGlobalPlayer"

interface GlobalPlayerProps {
  currentShelfItems?: any[]
  onShelfItemsChange?: (items: any[]) => void
}

export default function GlobalPlayer({ currentShelfItems = [], onShelfItemsChange }: GlobalPlayerProps) {
  const {
    currentTrack,
    isPlaying,
    playbackProgress,
    currentShelfItems: globalShelfItems,
    lastPreviousClick,
    setCurrentTrack,
    setIsPlaying,
    setPlaybackProgress,
    setCurrentShelfItems,
    setLastPreviousClick
  } = useGlobalPlayer()

  // currentShelfItemsが変更されたらグローバル状態を更新
  useEffect(() => {
    if (currentShelfItems.length > 0) {
      setCurrentShelfItems(currentShelfItems)
    }
  }, [currentShelfItems, setCurrentShelfItems])

  // カスタムイベントリスナー
  useEffect(() => {
    const handleTrackPlaying = (e: CustomEvent) => {
      const { id, title, artist, album, image_url, duration_ms, shelfItems } = e.detail
      setCurrentTrack({
        id,
        name: title,
        artists: [{ name: artist }],
        album: { images: [{ url: image_url }] },
        duration_ms: duration_ms || 0,
        uri: `spotify:track:${id}`
      })
      setIsPlaying(true)
      setPlaybackProgress(0)
      
      // フレンドの棚から再生した場合は、その棚の楽曲リストを設定
      if (shelfItems && Array.isArray(shelfItems)) {
        setCurrentShelfItems(shelfItems)
      }
    }

    const handlePlayerPause = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = (session as any)?.provider_token || (session as any)?.providerToken
        if (accessToken) {
          await fetch('https://api.spotify.com/v1/me/player/pause', {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${accessToken}` }
          })
        }
      } catch {}
      setIsPlaying(false)
    }

    window.addEventListener('track:playing', handleTrackPlaying as EventListener)
    window.addEventListener('player:pause', handlePlayerPause as EventListener)
    return () => {
      window.removeEventListener('track:playing', handleTrackPlaying as EventListener)
      window.removeEventListener('player:pause', handlePlayerPause as EventListener)
    }
  }, [setCurrentTrack, setIsPlaying, setCurrentShelfItems])

  const handleGlobalPlayPause = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = (session as any)?.provider_token || (session as any)?.providerToken
      if (!accessToken) return

      const endpoint = isPlaying ? 'pause' : 'play'
      const res = await fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })

      if (res.ok) {
        setIsPlaying(!isPlaying)
      }
    } catch (error) {
      console.error('Play/pause failed:', error)
    }
  }

  const handleShelfPrevious = async () => {
    if (!currentTrack || !globalShelfItems.length) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = (session as any)?.provider_token || (session as any)?.providerToken
      if (!accessToken) return

      const now = Date.now()
      const timeSinceLastClick = now - lastPreviousClick

      if (timeSinceLastClick < 1500) {
        // 1.5秒以内の連続クリック：前の曲へ
        const currentIndex = globalShelfItems.findIndex(item => 
          `spotify:${item.spotify_type}:${item.spotify_id}` === currentTrack.uri
        )

        let prevItem
        if (currentIndex === -1 || currentIndex === 0) {
          // 見つからないか最初の曲の場合は最後の曲へ
          prevItem = globalShelfItems[globalShelfItems.length - 1]
        } else {
          // 前の曲へ
          prevItem = globalShelfItems[currentIndex - 1]
        }

        if (prevItem) {
          const isTrack = prevItem.spotify_type === 'track'
          const body = isTrack 
            ? { uris: [`spotify:track:${prevItem.spotify_id}`] }
            : { context_uri: `spotify:${prevItem.spotify_type}:${prevItem.spotify_id}` }
          
          await fetch('https://api.spotify.com/v1/me/player/play', {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          })
        }
      } else {
        // 1.5秒以上経過：曲の最初へ
        await fetch('https://api.spotify.com/v1/me/player/seek?position_ms=0', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}` }
        })
      }

      setLastPreviousClick(now)
    } catch (error) {
      console.error('Previous track failed:', error)
    }
  }

  const handleShelfNext = async () => {
    if (!currentTrack || !globalShelfItems.length) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = (session as any)?.provider_token || (session as any)?.providerToken
      if (!accessToken) return

      // 現在の曲の位置を取得
      const currentIndex = globalShelfItems.findIndex(item => 
        `spotify:${item.spotify_type}:${item.spotify_id}` === currentTrack.uri
      )

      let nextItem
      if (currentIndex === -1 || currentIndex === globalShelfItems.length - 1) {
        // 見つからないか最後の曲の場合は最初の曲へ
        nextItem = globalShelfItems[0]
      } else {
        // 次の曲へ
        nextItem = globalShelfItems[currentIndex + 1]
      }

      if (nextItem) {
        const isTrack = nextItem.spotify_type === 'track'
        const body = isTrack 
          ? { uris: [`spotify:track:${nextItem.spotify_id}`] }
          : { context_uri: `spotify:${nextItem.spotify_type}:${nextItem.spotify_id}` }
        
        await fetch('https://api.spotify.com/v1/me/player/play', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
      }
    } catch (error) {
      console.error('Next track failed:', error)
    }
  }

  const handleProgressBarClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    if (!currentTrack) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = (session as any)?.provider_token || (session as any)?.providerToken
      if (!accessToken) return

      const progressBar = event.target as HTMLDivElement
      if (!progressBar) return

      const rect = progressBar.getBoundingClientRect()
      const clickX = event.clientX - rect.left
      const percentage = Math.max(0, Math.min(1, clickX / rect.width))
      const seekTimeMs = Math.floor(percentage * currentTrack.duration_ms)

      const res = await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${seekTimeMs}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })

      if (res.ok) {
        setPlaybackProgress(seekTimeMs)
      }
    } catch (error) {
      console.error('Seek failed:', error)
    }
  }

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (!currentTrack) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 py-3 pl-4 pr-0 text-white">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full">
        {/* 左側: 曲情報（左端寄せ） */}
        <div className="flex items-center gap-4 min-w-0 justify-self-start">
          <img 
            src={currentTrack.album?.images?.[0]?.url || '/placeholder-album.png'} 
            alt={currentTrack.name}
            className="w-20 h-20 rounded object-cover"
          />
          <div className="min-w-0">
            <div className="text-white font-medium truncate">{currentTrack.name}</div>
            <div className="text-gray-400 text-sm truncate">
              {currentTrack.artists?.map((a: any) => a.name).join(', ')}
            </div>
          </div>
        </div>

        {/* 中央: コントロール（中央固定） */}
        <div className="flex flex-col items-center gap-2 justify-self-center">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-gray-300 hover:bg-white hover:text-black h-11 w-11 rounded-full" onClick={handleShelfPrevious}>
              <SkipBack className="h-7 w-7" fill="currentColor" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white hover:bg-white hover:text-black h-12 w-12 rounded-full [&>svg]:!h-[1.6rem] [&>svg]:!w-[1.6rem]"
              onClick={handleGlobalPlayPause}
            >
              {isPlaying 
                ? <Pause fill="currentColor" />
                : <Play fill="currentColor" />}
            </Button>
            <Button variant="ghost" size="icon" className="text-gray-300 hover:bg-white hover:text-black h-11 w-11 rounded-full" onClick={handleShelfNext}>
              <SkipForward className="h-7 w-7" fill="currentColor" />
            </Button>
          </div>
          
          {/* プログレスバー */}
          <div className="flex items-center gap-2 w-64">
            <span className="text-xs text-gray-300 w-8">{formatTime(playbackProgress)}</span>
            <div 
              className="flex-1 bg-gray-700 rounded-full h-1 cursor-pointer hover:bg-gray-600 transition-colors relative"
              onClick={handleProgressBarClick}
            >
              <div 
                className="bg-white rounded-full h-1 transition-all duration-200 pointer-events-none" 
                style={{ width: `${(playbackProgress / (currentTrack.duration_ms || 1)) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-300 w-8">{formatTime(currentTrack.duration_ms || 0)}</span>
          </div>
        </div>

        {/* 右側: 余白（バランス用） */}
        <div className="justify-self-end" />
      </div>
    </div>
  )
}
