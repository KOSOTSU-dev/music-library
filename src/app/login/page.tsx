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
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-16 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        {/* 左カラム: 説明 */}
        <section className="space-y-5">
          <h1 className="text-3xl font-bold">Music Library</h1>
          <p className="text-gray-300 leading-relaxed">
            このアプリは、お気に入りの楽曲を棚で整理・共有し、フレンドのギャラリーに
            いいねやコメントでリアクションできるコレクションアプリです。ダークテーマの
            UI とドラッグ&ドロップで直感的に操作できます。
          </p>
          <div className="rounded-lg bg-[#111111] border border-[#333333] p-5 space-y-3">
            <h2 className="font-semibold">ゲストで試す（推奨）</h2>
            <div className="text-sm text-gray-200">
              <div>メール: <span className="font-mono">guest.kosotsu@outlook.jp</span></div>
              <div>パスワード: <span className="font-mono">1234abcd!!</span></div>
            </div>
            <ol className="text-sm text-gray-400 list-decimal pl-5 space-y-1">
              <li>
                まず
                {' '}
                <a
                  href="https://www.microsoft.com/ja-jp/microsoft-365/outlook/email-and-calendar-software-microsoft-outlook"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-400 hover:text-blue-300"
                >
                  Outlook にログイン
                </a>
                し、上記メールの受信を確認できる状態にします。
              </li>
              <li>次に Spotify を上記メール・パスワードでログインします。</li>
              <li>Spotify の認証メールが届くので、Outlook で認証を完了してください。</li>
              <li>その後、下の「Spotifyでログイン」からアプリに入れます。</li>
            </ol>
          </div>
        </section>

        {/* 右カラム: ボタン群 */}
        <section className="flex flex-col items-center gap-4 lg:justify-center">
          <div className="w-full max-w-sm rounded-xl bg-[#111111] border border-[#333333] p-6 space-y-4">
            <h2 className="text-lg font-semibold">ログイン</h2>
            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => handleLogin(forceSpotifyReauth)} 
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
              <p className="text-sm text-gray-400">
                別のアカウントでログインするため、Spotifyの認証画面にリダイレクトします。
              </p>
            )}
          </div>
        </section>
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
