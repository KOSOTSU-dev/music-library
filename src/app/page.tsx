"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      try {
        // URLハッシュのaccess_tokenを処理しつつセッションを取得
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Session error:', error)
          setHasSession(false)
          return
        }
        
        setHasSession(!!session)
        if (session) {
          router.replace('/app')
        }
      } catch (error) {
        console.error('Session check failed:', error)
        setHasSession(false)
      }
    }
    
    init()
    
    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.replace('/app')
      } else if (event === 'SIGNED_OUT') {
        setHasSession(false)
      }
    })
    
    return () => subscription.unsubscribe()
  }, [router])

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-16 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        {/* 左: 説明とゲスト情報 */}
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
              <li>まず Outlook にログインし、上記メールの受信を確認できる状態にします。</li>
              <li>次に Spotify を上記メール・パスワードでログインします。</li>
              <li>Spotify の認証メールが届くので、Outlook で認証を完了してください。</li>
              <li>その後、下の「Spotifyでログイン」からアプリに入れます。</li>
            </ol>
          </div>
        </section>

        {/* 右: ログインボタン */}
        <section className="flex flex-col items-center gap-4 lg:justify-center">
          <div className="w-full max-w-sm rounded-xl bg-[#111111] border border-[#333333] p-6 space-y-4">
            <h2 className="text-lg font-semibold">ログイン</h2>
            <div className="text-sm text-gray-400">セッション: {hasSession === null ? '確認中...' : hasSession ? 'あり' : 'なし'}</div>
            <Button asChild className="bg-green-500 hover:bg-green-600 text-white">
              <Link href="/login">Spotifyでログイン</Link>
            </Button>
            {/* 別のアカウントでログインは非表示 */}
          </div>
        </section>
      </div>
    </main>
  )
}
// Test comment for auto-deploy
