import { useState, useCallback, useEffect } from "react"

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: "default" | "destructive"
}

// グローバルな状態管理
let globalToasts: Toast[] = []
let globalListeners: ((toasts: Toast[]) => void)[] = []

const notifyListeners = () => {
  globalListeners.forEach(listener => listener([...globalToasts]))
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(globalToasts)

  // リスナーを登録
  useEffect(() => {
        const listener = (newToasts: Toast[]) => setToasts(newToasts)
    globalListeners.push(listener)
    return () => {
      globalListeners = globalListeners.filter(l => l !== listener)
    }
  }, [])

        const toast = useCallback(({ title, description, variant = "default" }: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast = { id, title, description, variant }
    
    globalToasts = [...globalToasts, newToast]
    notifyListeners()
    
    // 自動で削除（1.5秒後にフェードアウト開始）
    setTimeout(() => {
      globalToasts = globalToasts.filter(t => t.id !== id)
      notifyListeners()
    }, 1500)
        }, [])

  const dismiss = useCallback((toastId: string) => {
    globalToasts = globalToasts.filter(t => t.id !== toastId)
    notifyListeners()
  }, [])

        return { toast, dismiss, toasts }
}

// 便利関数: 再ログイントースト（どこからでも呼べる）
export async function showSpotifyReauthToast() {
  const id = Math.random().toString(36).substr(2, 9)
  const newToast = {
    id,
    title: 'Spotifyに再ログインしてください',
    description: 'ボタンを押すと再ログインが始まります',
    variant: 'default' as const,
  }
  globalToasts = [...globalToasts, newToast]
  notifyListeners()
  // 自動消去はしない（ユーザー操作を待つ）
  return id
}
