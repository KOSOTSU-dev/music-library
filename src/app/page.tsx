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
      // URLハッシュのaccess_tokenを処理しつつセッションを取得
      const { data: { session } } = await supabase.auth.getSession()
      setHasSession(!!session)
      if (session) {
        router.replace('/app')
      }
    }
    init()
  }, [router])

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold">Music Library</h1>
        <div className="text-sm text-gray-500 mb-4">
          セッション: {hasSession === null ? '確認中...' : hasSession ? 'あり' : 'なし'}
        </div>
        <Button asChild>
          <Link href="/login">Spotifyでログイン</Link>
        </Button>
      </div>
    </main>
  )
}
