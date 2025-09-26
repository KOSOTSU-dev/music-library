"use client"

import { Button } from "@/components/ui/button"
import { signInWithSpotify } from "@/lib/auth"
import { useState } from "react"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    try {
      setLoading(true)
      await signInWithSpotify()
      // signInWithOAuth はクライアントで呼ぶと自動でリダイレクトします
    } catch (e) {
      console.error(e)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <Button onClick={handleLogin} disabled={loading}>
        {loading ? "リダイレクト中..." : "Spotifyでログイン"}
      </Button>
    </main>
  )
}
