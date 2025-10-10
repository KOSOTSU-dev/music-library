"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Shield, RefreshCw } from "lucide-react"
import Link from "next/link"
import GlobalPlayer from "@/components/GlobalPlayer"
import { signInWithSpotify } from "@/lib/auth"

interface User {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  is_public: boolean
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<User | null>(null)
  const [highlightReauth, setHighlightReauth] = useState(false)

  // プロフィール情報を読み込み
  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(data)
    }

    loadProfile()
  }, [])

  useEffect(() => {
    // ルートからの通知で強調
    const f = typeof window !== 'undefined' ? localStorage.getItem('spotify:reauth-required') : null
    if (f === '1') {
      setHighlightReauth(true)
      // 表示後3秒で自然に消す
      const t = setTimeout(() => setHighlightReauth(false), 3000)
      return () => clearTimeout(t)
    }
  }, [])

  return (
    <div className="relative min-h-screen">
      <div className="max-w-2xl mx-auto p-6 pb-24 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/app">
            <ArrowLeft className="h-4 w-4 mr-2" />
            ホームに戻る
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">設定</h1>
      </div>

      {/* プロフィール設定はマイページに移動 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            プロフィール設定
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              プロフィール設定はフレンドページのマイページタブで行えます
            </p>
            <Button asChild>
              <Link href="/app/friends">
                フレンドページへ移動
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* アカウント情報 */}
      <Card>
        <CardHeader>
          <CardTitle>アカウント情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Spotifyアカウント</div>
              <div className="text-sm text-muted-foreground">音楽データの取得に使用</div>
            </div>
            <div className="text-sm text-muted-foreground">連携済み</div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">アカウント作成日</div>
              <div className="text-sm text-muted-foreground">
                {profile?.created_at && new Date(profile.created_at).toLocaleDateString('ja-JP')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Spotify再ログイン */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Spotify連携の再ログイン
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              再生や検索でエラーが出る場合は、Spotify連携を再ログインしてください。
            </p>
            <Button
              onClick={() => {
                void signInWithSpotify()
              }}
              className={`relative ${highlightReauth ? 'ring-2 ring-red-500 animate-pulse' : ''}`}
            >
              <span className={`${highlightReauth ? 'animate-bounce' : ''}`}>Spotifyに再ログイン</span>
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
      <GlobalPlayer currentShelfItems={[]} />
    </div>
  )
}
