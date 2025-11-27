"use client"

import { Suspense } from "react"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { signInWithEmail, signUpWithEmail, signInAnonymously, resetPasswordForEmail } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

function AppScreenshot({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-lg overflow-hidden border border-[#333333] bg-black/40 ${className}`}>
      <div
        className="relative w-full aspect-[1633/768]"
        style={{ maxHeight: 520 }}
      >
        <Image
          src="/app-screenshot.png"
          alt="Music Library アプリのスクリーンショット"
          fill
          sizes="(min-width: 1024px) 640px, (min-width: 801px) 40vw, 0px"
          className="object-contain"
          unoptimized
          priority
        />
      </div>
    </div>
  )
}

function LoginPageContent() {
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const translateAuthError = (rawMessage?: string) => {
    if (!rawMessage) return "エラーが発生しました。時間をおいて再度お試しください。"
    const message = rawMessage.toLowerCase()
    if (message.includes("invalid login credentials")) {
      return "メールアドレスまたはパスワードが正しくありません。"
    }
    if (message.includes("email not confirmed")) {
      return "メールアドレスの確認が完了していません。受信メールから認証を行ってください。"
    }
    if (message.includes("user already registered")) {
      return "このメールアドレスは既に登録されています。ログインまたはパスワードの再設定を行ってください。"
    }
    if (message.includes("password should be at least") || message.includes("weak password")) {
      return "パスワードは6文字以上で設定してください。"
    }
    if (message.includes("rate limit")) {
      return "操作が集中しています。少し時間を置いてから再度お試しください。"
    }
    return `エラー: ${rawMessage}`
  }

  useEffect(() => {
    // URLパラメータにcodeがある場合（パスワードリセットやOAuth認証のコールバック）
    const code = searchParams.get('code')
    const type = searchParams.get('type')
    
    if (code) {
      // codeがある場合は、/auth/callbackで処理
      // typeパラメータも一緒に渡す（パスワードリセットの場合はtype=recovery）
      const callbackUrl = type 
        ? `/auth/callback?code=${code}&type=${type}`
        : `/auth/callback?code=${code}`
      router.replace(callbackUrl)
      return
    }

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          router.replace("/app")
        }
      } catch {}
    }
    checkSession()
  }, [router, searchParams])

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, username || undefined)
      } else {
        await signInWithEmail(email, password)
      }
      router.push("/app")
    } catch (e: any) {
      setError(translateAuthError(e?.message))
      setLoading(false)
    }
  }

  const handleGuestLogin = async () => {
    setError(null)
    setLoading(true)

    try {
      await signInAnonymously()
      router.push("/app")
    } catch (e: any) {
      const errorMessage = e.message || "ゲストログインに失敗しました"
      setError(translateAuthError(errorMessage))
      setLoading(false)

      if (errorMessage.includes("Anonymous sign-ins are disabled") || errorMessage.includes("匿名認証を有効")) {
        console.error("ゲストログインを有効にするには: Supabase Dashboard → Authentication → Providers → Anonymous → Enable Anonymous sign-ins")
      }
      if (errorMessage.includes("CAPTCHA") || errorMessage.includes("captcha")) {
        console.error("CAPTCHA設定を確認: Supabase Dashboard → Authentication → Bot and Abuse Protection → hCaptchaのSecret Keyが正しく設定されているか確認")
      }
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setResetLoading(true)

    try {
      await resetPasswordForEmail(resetEmail)
      setResetSuccess(true)
    } catch (e: any) {
      setError(translateAuthError(e?.message || "パスワードリセットメールの送信に失敗しました"))
      setResetLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="w-full min-h-screen grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-6 px-8 py-12 flex flex-col justify-center">
          <h1 className="text-4xl font-bold" style={{ fontFamily: '"Science Gothic", sans-serif', fontWeight: 600, fontOpticalSizing: "auto", fontStyle: "normal", fontVariationSettings: '"slnt" 0, "wdth" 100, "CTRS" 0', letterSpacing: "0.1em" }}>Music Library</h1>
          <p className="text-gray-300 leading-relaxed">
            このアプリは、お気に入りの楽曲を棚で整理・共有し、フレンドのギャラリーに
            いいねやコメントでリアクションできるコレクションアプリです。ダークテーマの
            UI とドラッグ&ドロップで直感的に操作できます。
          </p>
          <div className="rounded-lg bg-[#111111] border border-[#333333] p-5 space-y-3">
            <h2 className="font-semibold">使い方</h2>
            <ul className="text-sm text-gray-400 list-disc pl-5 space-y-2">
              <li>メールアドレスとパスワードでログインまたは新規登録</li>
              <li>ゲストログインでアカウント作成なしで試すことができます</li>
              <li>楽曲を棚で整理・共有し、フレンドのギャラリーにいいねやコメントでリアクションできます</li>
            </ul>
          </div>
          {/* デスクトップ表示用の画像（1024px以上） */}
          <AppScreenshot className="hidden lg:block" />
        </section>

        <section className="bg-[#080808] flex flex-col items-center justify-center px-8 py-12">
          <div className="w-full max-w-3xl flex flex-col items-center gap-8 max-[1023px]:flex-row max-[1023px]:items-start max-[1023px]:justify-center max-[1023px]:gap-6 max-[800px]:flex-col">
            <div className="w-full max-w-md rounded-2xl bg-[#111111] border border-[#222222] p-8 space-y-5 shadow-xl">
            <h2 className="text-lg font-semibold">{isSignUp ? "新規登録" : "ログイン"}</h2>

            <form onSubmit={handleEmailLogin} className="space-y-4">
              {isSignUp && (
                <div className="space-y-2">
                  <label htmlFor="username" className="text-sm text-gray-300">
                    ユーザー名（任意）
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333333] rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                    placeholder="ユーザー名"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm text-gray-300">
                  メールアドレス
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333333] rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                  placeholder="example@email.com"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm text-gray-300">
                    パスワード
                  </label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => {
                        setResetEmail(email)
                        setShowResetDialog(true)
                        setResetSuccess(false)
                        setError(null)
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      パスワードを忘れた場合
                    </button>
                  )}
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#333333] rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? "処理中..." : isSignUp ? "新規登録" : "ログイン"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#333333]"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-[#111111] text-gray-400">または</span>
              </div>
            </div>

            <Button
              onClick={handleGuestLogin}
              disabled={loading}
              variant="outline"
              className="w-full border-gray-600 text-[#333333] hover:bg-gray-800"
            >
              {loading ? "処理中..." : "ゲストログイン"}
            </Button>

            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError(null)
              }}
              className="w-full text-sm text-gray-400 hover:text-gray-300 text-center"
            >
              {isSignUp ? "既にアカウントをお持ちですか？ログイン" : "アカウントをお持ちでない方は新規登録"}
            </button>
          </div>
          </div>
        </section>
      </div>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="bg-[#1a1a1a] border-[#333333] text-white [&>button]:bg-transparent [&>button]:text-gray-400 [&>button]:hover:text-white [&>button]:hover:bg-transparent [&>button]:focus:outline-none [&>button]:focus:ring-0 [&>button]:border-none [&>button]:shadow-none">
          <DialogHeader>
            <DialogTitle>パスワードリセット</DialogTitle>
            <DialogDescription className="text-gray-400">
              {resetSuccess
                ? "パスワードリセット用のメールを送信しました。メール内のリンクから新しいパスワードを設定してください。"
                : "登録されているメールアドレスを入力してください。パスワードリセット用のリンクを送信します。"}
            </DialogDescription>
          </DialogHeader>
          {!resetSuccess ? (
            <form onSubmit={handleResetPassword} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label htmlFor="reset-email" className="text-sm text-gray-300">
                  メールアドレス
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-[#111111] border border-[#333333] rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                  placeholder="example@email.com"
                />
              </div>
              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowResetDialog(false)
                    setResetEmail("")
                    setError(null)
                  }}
                  className="border-[#333333] text-gray-300 hover:bg-[#333333]"
                >
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  disabled={resetLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {resetLoading ? "送信中..." : "送信"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex justify-end mt-4">
              <Button
                onClick={() => {
                  setShowResetDialog(false)
                  setResetEmail("")
                  setResetSuccess(false)
                  setError(null)
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                閉じる
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black">読み込み中...</div>}>
      <LoginPageContent />
    </Suspense>
  )
}


