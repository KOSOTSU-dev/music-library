"use client"

import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { signInWithSpotify } from "@/lib/auth"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function LoginPageContent() {
  const [loading, setLoading] = useState(false)
  const [clearingSession, setClearingSession] = useState(false)
  const searchParams = useSearchParams()
  const forceSpotifyReauth = searchParams.get('force_spotify_reauth') === 'true'
  const router = useRouter()

  const handleLogin = async (forceReauth: boolean = false) => {
    try {
      setLoading(true)
      await signInWithSpotify({ forceReauth })
      // signInWithOAuth はクライアントで呼ぶと自動でリダイレクトします
    } catch (e) {
      console.error(e)
      setLoading(false)
    }
  }

  const handleLoginWithDifferentAccount = async () => {
    try {
      setClearingSession(true)
      // Spotifyの強制再認証を直接開始（ログアウトページへは行かない）
      await signInWithSpotify({ forceReauth: true })
      // フォールバック: 稀に戻って来れない環境向けに数秒後に再試行
      setTimeout(() => {
        // まだこのページに居る場合のみ再試行
        if (typeof window !== 'undefined' && document.visibilityState === 'visible') {
          window.location.href = '/login?force_spotify_reauth=true'
        }
      }, 4000)
    } catch (e) {
      console.error(e)
      setClearingSession(false)
    }
  }

  // forceSpotifyReauth がある場合、自動的にSpotifyの再認証を開始
  useEffect(() => {
    const run = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          // 既にログイン済みなら /app に遷移し、URLのforceパラメータを無視
          router.replace('/app')
          return
        }
        if (forceSpotifyReauth && !loading) {
          await handleLogin(true)
          const t = setTimeout(() => {
            setLoading(false)
          }, 4000)
          return () => clearTimeout(t)
        }
      } catch {}
    }
    run()
  }, [forceSpotifyReauth, loading])

  return (
    <main className="min-h-screen flex items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold text-white">Music Library</h1>
        <div className="flex flex-col gap-2">
          <Button 
            onClick={() => handleLogin(forceSpotifyReauth)} 
            // 自動起動がうまく行かない環境向けに、常に再押下可能にする
            disabled={false}
            className="bg-green-500 hover:bg-green-600 text-white"
          >
            {loading && !forceSpotifyReauth ? "リダイレクト中..." : "Spotifyでログイン"}
          </Button>
          <Button 
            onClick={handleLoginWithDifferentAccount} 
            disabled={clearingSession}
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            {clearingSession ? "セッションクリア中..." : "別のアカウントでログイン"}
          </Button>
        </div>
        {forceSpotifyReauth && (
          <p className="text-sm text-gray-400 text-center max-w-md">
            別のアカウントでログインするため、Spotifyの認証画面にリダイレクトします。
          </p>
        )}
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">読み込み中...</div>}>
      <LoginPageContent />
    </Suspense>
  )
}
