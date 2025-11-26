"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Shield, LogOut } from "lucide-react"
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

  const handleLogout = async () => {
    if (confirm('ログアウトしますか？')) {
      await supabase.auth.signOut()
      window.location.href = '/'
    }
  }

  return (
    <div className="relative min-h-screen bg-black">
      <div className="max-w-2xl mx-auto p-6 pb-24 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="sm" className="bg-[#666666] text-white border-[#666666] hover:bg-[#4d4d4d] hover:text-white">
          <Link href="/app">
            <ArrowLeft className="h-4 w-4 mr-2" />
            ホームに戻る
          </Link>
        </Button>
        <h1 className="text-3xl font-bold text-white">設定</h1>
      </div>


      {/* アカウント情報 */}
      <Card className="bg-[#1a1a1a] border-[#333333]">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white">アカウント情報</CardTitle>
          <Button
            onClick={handleLogout}
            className="bg-[#666666] text-white hover:bg-[#4d4d4d]"
          >
            <LogOut className="h-4 w-4 mr-2" />
            ログアウト
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-white">アカウント作成日</div>
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
