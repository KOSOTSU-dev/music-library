"use client"

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'

function FriendShelfNotFoundContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const isSpotifyAuthRequired = searchParams.get('spotify_auth_required') === 'true'

  useEffect(() => {
    if (isSpotifyAuthRequired) {
      toast({
        title: 'Spotifyに再ログインしてください',
        description: 'フレンドのギャラリーを閲覧するにはSpotify認証が必要です',
        variant: 'destructive'
      })
    }
  }, [isSpotifyAuthRequired, toast])

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">
          {isSpotifyAuthRequired ? 'Spotify認証が必要です' : 'ギャラリーが存在しません'}
        </h1>
        <p className="text-gray-400 mb-6">
          {isSpotifyAuthRequired 
            ? 'フレンドのギャラリーを閲覧するにはSpotifyにログインしてください。'
            : 'このユーザーにはまだ棚が作成されていません。'
          }
        </p>
        <a 
          href="/app/friends" 
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-9 px-4 py-2"
        >
          フレンド一覧に戻る
        </a>
      </div>
    </div>
  )
}

export default function FriendShelfNotFound() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">読み込み中...</div>}>
      <FriendShelfNotFoundContent />
    </Suspense>
  )
}
