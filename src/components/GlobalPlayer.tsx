"use client"

import { useEffect, useState, useRef } from "react"
import { useGlobalPlayer } from "@/hooks/useGlobalPlayer"

interface GlobalPlayerProps {
  currentShelfItems?: any[]
  onShelfItemsChange?: (items: any[]) => void
}

export default function GlobalPlayer({ currentShelfItems = [] }: GlobalPlayerProps) {
  const {
    currentTrack,
    setCurrentTrack,
    setCurrentShelfItems,
  } = useGlobalPlayer()

  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // currentShelfItemsが変更されたらグローバル状態を更新
  useEffect(() => {
    if (currentShelfItems.length > 0) {
      setCurrentShelfItems(currentShelfItems)
    }
  }, [currentShelfItems, setCurrentShelfItems])

  // カスタムイベントリスナー
  useEffect(() => {
    const handleTrackPlaying = (e: CustomEvent) => {
      const { spotify_id, spotify_type, title, artist, album, image_url, duration_ms, shelfItems, id } = e.detail
      
      // spotify_idとspotify_typeが存在する場合は埋め込みプレイヤーのURLを設定
      const trackId = spotify_id || id
      const trackType = spotify_type || 'track'
      
      if (trackId && trackType) {
        // 埋め込みプレイヤーのURLを設定（autoplay=trueで自動再生）
        const url = `https://open.spotify.com/embed/${trackType}/${trackId}?utm_source=generator&autoplay=true&theme=0`
        setEmbedUrl(url)
      } else {
        // spotify_idがない場合はembedUrlをクリア
        setEmbedUrl(null)
      }
      
      setCurrentTrack({
        id: trackId || id,
        name: title,
        artists: [{ name: artist }],
        album: { images: [{ url: image_url }] },
        duration_ms: duration_ms || 0,
        uri: trackId && trackType ? `spotify:${trackType}:${trackId}` : undefined
      })
      
      // フレンドの棚から再生した場合は、その棚の楽曲リストを設定
      if (shelfItems && Array.isArray(shelfItems)) {
        setCurrentShelfItems(shelfItems)
      }
    }

    window.addEventListener('track:playing', handleTrackPlaying as EventListener)
    return () => {
      window.removeEventListener('track:playing', handleTrackPlaying as EventListener)
    }
  }, [setCurrentTrack, setCurrentShelfItems])

  if (!currentTrack) return null

  return (
    <div className="w-full flex justify-center">
      {/* 埋め込みプレイヤー */}
      {embedUrl && (
        <div className="w-full max-w-4xl relative px-4 md:px-8 py-2">
          {/* 背景（Spotifyグリーン） */}
          <div
            className="absolute inset-x-0 inset-y-1 rounded-full bg-[#1DB954] shadow-[0_15px_40px_rgba(0,0,0,0.45)]"
            style={{ zIndex: -2 }}
          />
          {/* 埋め込みプレイヤー */}
          <div className="relative px-3 md:px-5 z-0 overflow-hidden">
            <iframe
              ref={iframeRef}
              src={embedUrl}
              width="100%"
              height="80"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              scrolling="no"
              className="bg-transparent rounded-none border border-transparent relative z-10"
            />
          <div className="absolute inset-0 rounded-none border border-transparent pointer-events-none" style={{ zIndex: 5 }} />
          </div>
        </div>
      )}
    </div>
  )
}
