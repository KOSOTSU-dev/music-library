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
// Test comment for auto-deploy
