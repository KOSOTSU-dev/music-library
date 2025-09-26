"use client"

import { useState, useEffect, createContext, useContext } from "react"
import { supabase } from "@/lib/supabase"

interface Track {
  id: string
  name: string
  artists: Array<{ name: string }>
  album: { images: Array<{ url: string }> }
  duration_ms: number
  uri?: string
}

interface GlobalPlayerState {
  currentTrack: Track | null
  isPlaying: boolean
  playbackProgress: number
  currentShelfItems: any[]
  lastPreviousClick: number
  setCurrentTrack: (track: Track | null) => void
  setIsPlaying: (playing: boolean) => void
  setPlaybackProgress: (progress: number) => void
  setCurrentShelfItems: (items: any[]) => void
  setLastPreviousClick: (time: number) => void
}

const GlobalPlayerContext = createContext<GlobalPlayerState | null>(null)

export function GlobalPlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackProgress, setPlaybackProgress] = useState(0)
  const [currentShelfItems, setCurrentShelfItems] = useState<any[]>([])
  const [lastPreviousClick, setLastPreviousClick] = useState<number>(0)

  // 再生状態をチェック
  const checkPlaybackState = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = (session as any)?.provider_token || (session as any)?.providerToken
      if (!accessToken) return

      const res = await fetch('https://api.spotify.com/v1/me/player', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })

      if (res.status === 204) {
        setIsPlaying(false)
        return
      }

      if (res.ok) {
        const text = await res.text()
        if (text) {
          const data = JSON.parse(text)
          if (data.is_playing) {
            setIsPlaying(true)
            setPlaybackProgress(data.progress_ms || 0)
            setCurrentTrack(data.item)
          } else {
            setIsPlaying(false)
          }
        }
      }
    } catch (error) {
      console.error('Playback state check failed:', error)
    }
  }

  // カスタムイベントリスナー
  useEffect(() => {
    const handleTrackPlaying = (e: CustomEvent) => {
      const { id, title, artist, album, image_url, duration_ms } = e.detail
      setCurrentTrack({
        id,
        name: title,
        artists: [{ name: artist }],
        album: { images: [{ url: image_url }] },
        duration_ms: duration_ms || 0,
        uri: `spotify:track:${id}`
      })
      setIsPlaying(true)
    }

    window.addEventListener('track:playing', handleTrackPlaying as EventListener)
    return () => {
      window.removeEventListener('track:playing', handleTrackPlaying as EventListener)
    }
  }, [])

  // 定期的に再生状態をチェック
  useEffect(() => {
    const interval = setInterval(checkPlaybackState, 1000)
    return () => clearInterval(interval)
  }, [])

  const value = {
    currentTrack,
    isPlaying,
    playbackProgress,
    currentShelfItems,
    lastPreviousClick,
    setCurrentTrack,
    setIsPlaying,
    setPlaybackProgress,
    setCurrentShelfItems,
    setLastPreviousClick
  }

  return (
    <GlobalPlayerContext.Provider value={value}>
      {children}
    </GlobalPlayerContext.Provider>
  )
}

export function useGlobalPlayer() {
  const context = useContext(GlobalPlayerContext)
  if (!context) {
    throw new Error('useGlobalPlayer must be used within a GlobalPlayerProvider')
  }
  return context
}
