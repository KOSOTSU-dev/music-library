"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Shield } from "lucide-react"
import Link from "next/link"
import GlobalPlayer from "@/components/GlobalPlayer"

interface User {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  is_public: boolean
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<User | null>(null)

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
      </div>
      <GlobalPlayer currentShelfItems={[]} />
    </div>
  )
}
