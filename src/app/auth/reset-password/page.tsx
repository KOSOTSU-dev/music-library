"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { updatePassword } from "@/lib/auth"
import { Button } from "@/components/ui/button"

type Status = "checking" | "ready" | "error" | "success"

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>("checking")

  useEffect(() => {
    // URLパラメータからエラーを確認
    const errorParam = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    if (errorParam) {
      let errorMessage = 'パスワードリセットリンクに問題があります。'
      
      if (errorParam === 'otp_expired' || errorParam === 'access_denied') {
        errorMessage = 'パスワードリセットリンクが無効または期限切れです。新しいリセットメールを送信してください。'
      } else if (errorDescription) {
        errorMessage = decodeURIComponent(errorDescription)
      }
      
      setError(errorMessage)
      setStatus("error")
      return
    }

    // URLハッシュからトークンを取得してセッションを確認（フォールバック）
    const checkSession = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (error) {
          setError('セッションの確認に失敗しました。リンクが無効または期限切れの可能性があります。')
          setStatus("error")
          return
        }
      } else {
        // ハッシュがない場合、既存のセッションを確認
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setError('セッションが見つかりません。パスワードリセットリンクからアクセスしてください。')
          setStatus("error")
          return
        }
      }

      setStatus("ready")
    }

    checkSession()
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('パスワードが一致しません。')
      return
    }

    if (password.length < 6) {
      setError('パスワードは6文字以上で設定してください。')
      return
    }

    setLoading(true)

    try {
      await updatePassword(password)
      setStatus("success")
      setTimeout(() => {
        router.push('/app')
      }, 2000)
    } catch (e: any) {
      setError(e?.message || 'パスワードの更新に失敗しました。')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl bg-[#111111] border border-[#333333] p-6 space-y-4">
        <h1 className="text-2xl font-bold">パスワードをリセット</h1>
        
        {status === "checking" && (
          <p className="text-sm text-gray-400">リセットリンクを確認しています...</p>
        )}

        {status === "ready" && (
          <p className="text-sm text-green-400">リンクを確認しました。新しいパスワードを入力してください。</p>
        )}

        {status === "success" ? (
          <div className="space-y-4">
            <p className="text-green-400">パスワードが正常に更新されました。アプリに戻ります...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm text-gray-300">
                新しいパスワード
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={status !== "ready"}
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333333] rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirm-password" className="text-sm text-gray-300">
                パスワード（確認）
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                disabled={status !== "ready"}
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333333] rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="space-y-2">
                <p className="text-sm text-red-400">{error}</p>
                {error.includes('期限切れ') || error.includes('無効') ? (
                  <p className="text-xs text-gray-400">
                    パスワードリセットメールは1時間以内に有効です。新しいメールを送信するには、ログインページから「パスワードを忘れた場合」を再度お試しください。
                  </p>
                ) : null}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !!error || status !== "ready"}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "更新中..." : "パスワードを更新"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/')}
              className="w-full border-[#333333] text-gray-300 hover:bg-[#333333]"
            >
              トップページに戻る
            </Button>
          </form>
        )}
      </div>
    </main>
  )
}

