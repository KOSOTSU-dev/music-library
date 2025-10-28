"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight } from "lucide-react"
import { Share2, GripVertical, MessageCircle, Trash2, ExternalLink, Copy, StickyNote, Heart, Link as LinkIcon, Users, Settings, Music, PanelLeftClose, PanelLeftOpen, Plus, Pen, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import GlobalPlayer from "@/components/GlobalPlayer"
import { Toaster } from "@/components/ui/toaster"
import { SpotifyReauthAction } from "@/components/ui/toast"
import { showSpotifyReauthToast } from "@/hooks/use-toast"
import { useToast } from "@/hooks/use-toast"
import { useGlobalPlayer } from "@/hooks/useGlobalPlayer"
import CommentModal from '@/components/comments/CommentModal'
import { signOut } from "@/lib/auth"
import { createShelf, reorderShelves, updateShelfItemMemo } from "./actions"
import { getLikeCount, getCommentCount, getLikes, getComments, toggleLike, addComment, deleteComment } from "./comments-likes-actions"
import { getPendingFriendRequestsCount } from "./friends-actions"
import { motion } from "framer-motion"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Shelf {
  id: string
  user_id: string
  name: string
  description: string | null
  is_public: boolean
  sort_order: number
  created_at: string
  updated_at: string
  icon_url: string | null
}

function ShelfCreateForm({ compact = false }: { compact?: boolean }) {
  const [pending, setPending] = useState(false)
  const [expand, setExpand] = useState(false)
  const [lastSubmitTime, setLastSubmitTime] = useState(0)
  const [lastEnterTime, setLastEnterTime] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  
  const handleClose = () => {
    setIsAnimating(true)
    // アニメーション完了後に状態を変更
    setTimeout(() => {
      setExpand(false)
      setIsAnimating(false)
    }, 500) // 0.5秒後に作成ボタンに切り替え
  }
  
  const handleSubmit = async (formData: FormData) => {
    // 重複送信を防ぐ（500ms以内の連続送信をブロック）
    const now = Date.now()
    if (now - lastSubmitTime < 500) {
      return
    }
    
    // 既に処理中の場合は無視
    if (pending) {
      return
    }
    
    setLastSubmitTime(now)
    setPending(true)
    
    try {
      const res = await createShelf(formData) as any
      if (res?.error) {
        // エラーはtoastで表示
        console.error('Shelf creation error:', res.error)
        return
      }
      if (res?.shelf) {
        const shelf = res.shelf as { id: string; name: string }
        const addEvent = new CustomEvent('shelf:added', { detail: shelf })
        window.dispatchEvent(addEvent)
        setExpand(false) // 作成後にフォームを閉じる
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-2">
      {compact ? (
        <>
          <div className="flex justify-center mt-2">
            <button type="button" className="w-9 h-9 rounded-full bg-black text-white grid place-items-center hover:bg-gray-900" onClick={() => setExpand(true)} aria-label="棚を作成">
              <Plus className="h-5 w-5" />
            </button>
          </div>
          <Dialog open={expand} onOpenChange={setExpand}>
            <DialogContent className="sm:max-w-[360px]">
              <DialogHeader>
                <DialogTitle>棚を作成</DialogTitle>
                <DialogDescription>新しい棚を作成して楽曲を整理します</DialogDescription>
              </DialogHeader>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input 
                    name="name" 
                    placeholder="新しいギャラリー名" 
                    className="w-full rounded px-3 py-2 pr-12 text-base bg-black text-white outline-none border border-gray-600 focus:border-white" 
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setExpand(false)
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const form = document.createElement('form')
                      const input = document.querySelector('input[name="name"]') as HTMLInputElement
                      if (input && input.value.trim()) {
                        const formData = new FormData()
                        formData.set('name', input.value.trim())
                        await handleSubmit(formData)
                      }
                    }}
                    disabled={pending}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-1 rounded-full text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    style={{ backgroundColor: '#333333' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#666666' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#333333' }}
                  >
                    {pending ? '...' : '作成'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full bg-gray-600 text-white flex items-center justify-center hover:bg-gray-500"
                >
                  ✕
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <div className="flex items-center gap-2">
          {/* expanding input */}
          <div className={`transition-all duration-300 ease-out overflow-hidden ${expand ? 'w-64 sm:w-80 opacity-100' : 'w-0 opacity-0'} `}>
            <div className="relative">
              <input
                name="name"
                placeholder="新しいギャラリー名"
                className="w-full rounded px-3 py-2 pr-12 text-base bg-black text-white outline-none border border-gray-600 focus:border-white"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') handleClose()
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const now = Date.now()
                    // 2回目のエンター以降は2秒間隔で制限
                    if (now - lastEnterTime < 2000) {
                      return
                    }
                    setLastEnterTime(now)
                    const input = e.currentTarget as HTMLInputElement
                    if (input.value.trim()) {
                      const formData = new FormData()
                      formData.set('name', input.value.trim())
                      handleSubmit(formData)
                    }
                  }
                }}
                autoFocus={expand}
              />
              <button
                type="button"
                onClick={async () => {
                  const input = document.querySelector('input[name="name"]') as HTMLInputElement
                  if (input && input.value.trim()) {
                    const formData = new FormData()
                    formData.set('name', input.value.trim())
                    await handleSubmit(formData)
                  }
                }}
                disabled={pending}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-1 rounded-full text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ backgroundColor: '#333333' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#666666' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#333333' }}
              >
                {pending ? '...' : '作成'}
              </button>
            </div>
          </div>
          {/* toggle button */}
          <button
            type="button"
            onClick={() => {
              if (expand || isAnimating) {
                handleClose()
              } else {
                setExpand(true)
              }
            }}
            className="flex items-center justify-center w-10 h-10 rounded-full text-white transition-colors"
            style={{ backgroundColor: '#333333' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#4d4d4d' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#333333' }}
            aria-label={(expand || isAnimating) ? '作成を閉じる' : '作成を開く'}
          >
            {(expand || isAnimating) ? (
              <span className="inline-block transition-transform duration-300">✕</span>
            ) : (
              <span className="inline-block transition-transform duration-300">＋</span>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export default function AppHome() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [currentShelfItems, setCurrentShelfItems] = useState<any[]>([])
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0)
  const [needsReauth, setNeedsReauth] = useState(false)
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null)
  const [compactShelves, setCompactShelves] = useState<boolean>(false)
  const [commentModalOpen, setCommentModalOpen] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const router = useRouter()
  const { currentTrack, setCurrentShelfItems: setGlobalShelfItems } = useGlobalPlayer()

  useEffect(() => {
    // compact mode restore
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('ui:compact-shelves')
      if (v === '1') setCompactShelves(true)
    }
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/')
        return
      }
      setUser(session.user)
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('avatar_url')
          .eq('id', session.user.id)
          .single()
        if (profile?.avatar_url) setAvatarUrl(profile.avatar_url)
      } catch {}
      setLoading(false)
      
      // フレンド申請数を取得
      const pendingCount = await getPendingFriendRequestsCount()
      setPendingFriendRequests(pendingCount.count)
    }
    init()

    // プロフィール画像更新の即時反映
    const onAvatar = (e: any) => {
      const url = e.detail?.avatar_url
      if (url) setAvatarUrl(url)
    }
    window.addEventListener('user:avatar-updated', onAvatar)
    init()
    return () => {
      window.removeEventListener('user:avatar-updated', onAvatar)
    }
  }, [router])

  useEffect(() => {
    // 認証成功時の処理
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('auth_success') === 'true') {
        // 認証成功時はlocalStorageをクリア
        localStorage.removeItem('spotify:reauth-required')
        setNeedsReauth(false)
        // URLパラメータをクリア
        const newUrl = new URL(window.location.href)
        newUrl.searchParams.delete('auth_success')
        window.history.replaceState({}, '', newUrl.toString())
        return
      }
      
      // restore persisted flag
      const f = localStorage.getItem('spotify:reauth-required')
      if (f === '1') setNeedsReauth(true)
    }
    const onRequire = () => {
      setNeedsReauth(true)
      try { localStorage.setItem('spotify:reauth-required', '1') } catch {}
    }
    const onCleared = () => {
      setNeedsReauth(false)
      try { localStorage.removeItem('spotify:reauth-required') } catch {}
    }
    const onSettingsOpen = async () => {
      // 画面遷移時に有効トークンがあるなら消す
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = (session as any)?.provider_token || (session as any)?.providerToken
        if (token) {
          onCleared()
        }
      } catch {}
    }
    window.addEventListener('spotify:reauth-required', onRequire as EventListener)
    window.addEventListener('spotify:reauth-cleared', onCleared as EventListener)
    window.addEventListener('route:settings-open', onSettingsOpen as EventListener)
    return () => {
      window.removeEventListener('spotify:reauth-required', onRequire as EventListener)
      window.removeEventListener('spotify:reauth-cleared', onCleared as EventListener)
      window.removeEventListener('route:settings-open', onSettingsOpen as EventListener)
    }
  }, [])


  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white grid place-items-center">
        <p>読み込み中...</p>
      </main>
    )
  }



  // 棚内の前の曲を再生（1.5秒以内の連続クリックで前の曲、そうでなければ曲の最初へ）
  const handleShelfPrevious = async () => {
    if (!currentTrack || !currentShelfItems.length) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.provider_token) return

    const now = Date.now()
    const timeSinceLastClick = now - lastPreviousClick

    if (timeSinceLastClick < 1500) {
      // 1.5秒以内の連続クリック：前の曲へ
      const currentTrackId = currentTrack.id
      const currentIndex = currentShelfItems.findIndex(item => 
        `spotify:${item.spotify_type}:${item.spotify_id}` === currentTrack.uri
      )

      let prevItem
      if (currentIndex === -1 || currentIndex === 0) {
        // 見つからないか最初の曲の場合は最後の曲へ
        prevItem = currentShelfItems[currentShelfItems.length - 1]
      } else {
        // 前の曲へ
        prevItem = currentShelfItems[currentIndex - 1]
      }

      if (prevItem) {
        const isTrack = prevItem.spotify_type === 'track'
        const body = isTrack 
          ? { uris: [`spotify:track:${prevItem.spotify_id}`] }
          : { context_uri: `spotify:${prevItem.spotify_type}:${prevItem.spotify_id}` }
        
        await fetch('https://api.spotify.com/v1/me/player/play', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${session.provider_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
      }
    } else {
      // 1.5秒以上経過：曲の最初へ
      await fetch('https://api.spotify.com/v1/me/player/seek?position_ms=0', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${session.provider_token}` }
      })
    }

    setLastPreviousClick(now)
  }

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleProgressBarClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    if (!currentTrack) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.provider_token) return

    const progressBar = event.target as HTMLDivElement
    if (!progressBar) return

    const rect = progressBar.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, clickX / rect.width))
    const seekTimeMs = Math.floor(percentage * currentTrack.duration_ms)

    console.log('Seek debug:', {
      clickX,
      rectWidth: rect.width,
      percentage,
      seekTimeMs,
      duration: currentTrack.duration_ms
    })

    try {
      const response = await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${seekTimeMs}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${session.provider_token}` }
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Seek failed:', response.status, errorText)
      } else {
        console.log('Seek successful')
      }
    } catch (error) {
      console.error('Seek error:', error)
    }
  }

  return (
    <div className="relative min-h-screen bg-black">
      <main className="px-4 pt-3 pb-32">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-2xl font-bold text-white">Music Library</h1>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="relative group text-white hover:text-gray-200 hover:scale-110 hover:bg-transparent transition-all duration-200 [&>svg]:!h-[1.6rem] [&>svg]:!w-[1.6rem]">
              <Link href="/app/friends">
                <Users />
                {pendingFriendRequests > 0 && (
                  <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs">
                    {pendingFriendRequests}
                  </Badge>
                )}
                <span className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none bg-transparent">
                  フレンド
                </span>
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon" className="group relative text-white hover:text-gray-200 hover:scale-110 hover:bg-transparent transition-all duration-200 [&>svg]:!h-[1.6rem] [&>svg]:!w-[1.6rem]">
              <Link href="/app/settings" onClick={() => window.dispatchEvent(new CustomEvent('route:settings-open'))}>
                <Settings />
                {needsReauth && (
                  <span className="absolute -top-1 -right-1 inline-block h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                )}
                <span className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none bg-transparent">
                  設定
                </span>
              </Link>
            </Button>
            <Link href="/app/friends?tab=mypage" className="ml-1.5">
              <Avatar className="h-10 w-10 cursor-pointer transition-all duration-200 hover:scale-110 hover:shadow-lg hover:ring-2 hover:ring-blue-400 hover:ring-opacity-50">
                <AvatarImage src={avatarUrl || user?.user_metadata?.picture || user?.user_metadata?.avatar_url || undefined} />
                <AvatarFallback>
                  {user?.user_metadata?.full_name?.[0] || user?.email?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>

        <div className={`${compactShelves ? 'grid grid-cols-[64px_1fr]' : 'grid grid-cols-12'} gap-2`}>
          {/* Left: Shelves */}
          <aside className={`${compactShelves ? '' : 'col-span-3'} ${compactShelves ? 'px-2 py-3' : 'p-3'} rounded-md h-[calc(100vh-5rem)] overflow-y-auto`} style={{ backgroundColor: '#1a1a1a', width: compactShelves ? 64 : undefined }}>
            <div className={`flex items-center mb-3 ${compactShelves ? 'justify-end' : 'justify-between'}`}>
              {!compactShelves && <h2 className="font-semibold text-white">マイギャラリー</h2>}
              <button
                type="button"
                className="text-base px-0 py-0 flex items-center gap-2 transition-colors hover:text-white focus:text-white focus:outline-none"
                style={{ color: '#b3b3b3' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ffffff' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#b3b3b3' }}
                onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#b3b3b3' }}
                onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#b3b3b3' }}
                onClick={() => {
                  setCompactShelves(v => {
                    const nv = !v
                    try { localStorage.setItem('ui:compact-shelves', nv ? '1' : '0') } catch {}
                    return nv
                  })
                }}
                aria-label="サイドバー幅切替"
                title={compactShelves ? '通常表示にする' : '細い表示にする'}
              >
                {compactShelves ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
              </button>
            </div>
            <ShelfList 
              shelves={shelves}
              setShelves={setShelves}
              selectedShelfId={selectedShelfId}
              setSelectedShelfId={setSelectedShelfId}
              compact={compactShelves}
              onShelfSelect={(id) => {
                const event = new CustomEvent('shelf:selected', { detail: { shelfId: id } })
                window.dispatchEvent(event)
              }} 
            />
            <ShelfCreateForm compact={compactShelves} />
          </aside>

          {/* Center: Shelf View with Search */}
          <section className={`${compactShelves ? '' : 'col-span-9'} pt-1 pr-3 pb-3 pl-3 min-h-[300px] rounded-md`} style={{ backgroundColor: '#1a1a1a' }}>
            <div className="flex justify-between items-start mb-3 mt-2">
              <h2 className="font-semibold flex items-baseline gap-4 flex-1 min-w-0">
                <span className="text-6xl font-semibold truncate text-white">{selectedShelfId ? shelves.find(s => s.id === selectedShelfId)?.name || '棚ビュー' : '棚ビュー'}</span>
            <span className="text-base text-muted-foreground flex-shrink-0">{currentShelfItems.length} 曲</span>
            </h2>
            <SearchPanel />
            </div>
            <ShelfView onShelfItemsChange={setCurrentShelfItems} currentTrack={currentTrack} toast={toast} user={user} />
          </section>
        </div>
      </main>

      <GlobalPlayer currentShelfItems={currentShelfItems} onShelfItemsChange={setGlobalShelfItems} />
      <Toaster />
    </div>
  )
}

function ShelfList({ 
  shelves, 
  setShelves, 
  selectedShelfId, 
  setSelectedShelfId, 
  onShelfSelect,
  compact
}: { 
  shelves: Shelf[]
  setShelves: (shelves: Shelf[]) => void
  selectedShelfId: string | null
  setSelectedShelfId: (id: string | null) => void
  onShelfSelect: (id: string) => void,
  compact: boolean
}) {
  const [editingShelfId, setEditingShelfId] = useState<string | null>(null)
  const [icons, setIcons] = useState<Record<string, string>>({})
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    shelfId: string | null
    shelfName: string
  }>({ open: false, shelfId: null, shelfName: '' })
  const [deleteItemDialog, setDeleteItemDialog] = useState<{
    open: boolean
    itemId: string | null
    itemName: string
  }>({ open: false, itemId: null, itemName: '' })

  // load icons from database
  useEffect(() => {
    const loadIcons = async () => {
      try {
        const { data: shelvesData } = await supabase
          .from('shelves')
          .select('id, icon_url')
          .not('icon_url', 'is', null)
        
        if (shelvesData) {
          const iconsMap: Record<string, string> = {}
          shelvesData.forEach(shelf => {
            if (shelf.icon_url) {
              iconsMap[shelf.id] = shelf.icon_url
            }
          })
          setIcons(iconsMap)
        }
      } catch (error) {
        console.error('Failed to load shelf icons from database:', error)
        // フォールバック: localStorageから読み込み
        try {
          const raw = localStorage.getItem('shelf:icons')
          if (raw) setIcons(JSON.parse(raw))
        } catch {}
      }
    }
    
    loadIcons()
  }, [])

  const setIcon = async (id: string, url: string) => {
    try {
      console.log('Saving icon for shelf:', id, 'URL:', url)
      
      // データベースに保存
      const { data, error } = await supabase
        .from('shelves')
        .update({ icon_url: url })
        .eq('id', id)
        .select()
      
      if (error) {
        console.error('Failed to save shelf icon to database:', error)
        // フォールバック: localStorageに保存
        setIcons(prev => {
          const next = { ...prev, [id]: url }
          try { 
            localStorage.setItem('shelf:icons', JSON.stringify(next)) 
          } catch (e) {
            console.error('Failed to save to localStorage:', e)
          }
          return next
        })
        return
      }
      
      console.log('Icon saved successfully to database:', data)
      
      // ローカル状態を更新
      setIcons(prev => ({ ...prev, [id]: url }))
    } catch (error) {
      console.error('Failed to save shelf icon:', error)
      // フォールバック: localStorageに保存
      setIcons(prev => {
        const next = { ...prev, [id]: url }
        try { 
          localStorage.setItem('shelf:icons', JSON.stringify(next)) 
        } catch (e) {
          console.error('Failed to save to localStorage:', e)
        }
        return next
      })
    }
  }

  const handleDeleteShelf = async () => {
    if (!deleteDialog.shelfId) return
    
    try {
      const fd = new FormData()
      fd.set('id', deleteDialog.shelfId)
      const { deleteShelf } = await import('./actions')
      await deleteShelf(fd)
      setShelves((prev) => prev.filter((s) => s.id !== deleteDialog.shelfId))
      // アイコンも削除
      setIcons(prev => {
        const next = { ...prev }
        delete next[deleteDialog.shelfId!]
        return next
      })
      setDeleteDialog({ open: false, shelfId: null, shelfName: '' })
    } catch (error) {
      console.error('Failed to delete shelf:', error)
    }
  }

  const handleDeleteItem = async () => {
    if (!deleteItemDialog.itemId) return
    
    try {
      const fd = new FormData()
      fd.set('id', deleteItemDialog.itemId)
      const { deleteShelfItem } = await import('./actions')
      await deleteShelfItem(fd)
      // 楽曲削除イベントを発火
      window.dispatchEvent(new CustomEvent('shelf:item-deleted', { 
        detail: { itemId: deleteItemDialog.itemId } 
      }))
      setDeleteItemDialog({ open: false, itemId: null, itemName: '' })
    } catch (error) {
      console.error('Failed to delete item:', error)
    }
  }

  // load item counts per shelf
  useEffect(() => {
    const loadCounts = async () => {
      const entries = await Promise.all(
        (shelves || []).map(async (s) => {
          try {
            const { count } = await supabase
              .from('shelf_items')
              .select('*', { head: true, count: 'exact' })
              .eq('shelf_id', s.id)
            return [s.id, count || 0] as const
          } catch {
            return [s.id, 0] as const
          }
        })
      )
      const map: Record<string, number> = {}
      for (const [id, c] of entries) map[id] = c
      setCounts(map)
    }
    if (shelves.length) {
      void loadCounts()
    }
  }, [shelves])

  // 棚名の更新イベントをリッスン
  useEffect(() => {
    const handleShelfUpdate = (e: CustomEvent) => {
      const { shelfId, newName } = e.detail
      // 既存順序を維持したまま名称のみ置換
      setShelves(prevShelves => {
        return prevShelves.map(shelf =>
          shelf.id === shelfId ? { ...shelf, name: newName } : shelf
        )
      })
    }

    window.addEventListener('shelf:updated', handleShelfUpdate as EventListener)
    return () => {
      window.removeEventListener('shelf:updated', handleShelfUpdate as EventListener)
    }
  }, [setShelves])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { 
        distance: 12,
        delay: 150,
        tolerance: 8
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('shelves')
        .select('id, name, sort_order')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })
      setShelves(data || [])
      if (data?.[0] && !selectedShelfId) {
        setSelectedShelfId(data[0].id)
        onShelfSelect(data[0].id)
      }
    }
    load()
    const onAdded = (e: any) => {
      setShelves((prev) => [...prev, e.detail])
    }
    window.addEventListener('shelf:added', onAdded)
    return () => window.removeEventListener('shelf:added', onAdded)
  }, [])

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (active.id !== over?.id) {
      setShelves((shelves) => {
        const oldIndex = shelves.findIndex((shelf) => shelf.id === active.id)
        const newIndex = shelves.findIndex((shelf) => shelf.id === over?.id)
        
        // 縦方向の移動のみ許可（インデックスの順序が変わっているかチェック）
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
          return shelves
        }
        
        const newShelves = arrayMove(shelves, oldIndex, newIndex)
        
        // サーバーに並び順を保存
        const shelfIds = newShelves.map(shelf => shelf.id)
        const fd = new FormData()
        fd.set('shelfIds', JSON.stringify(shelfIds))
        
        // 非同期でサーバー更新（楽観的更新）
        import('./actions').then(({ reorderShelves }) => {
          reorderShelves(fd)
        })
        
        return newShelves
      })
    }
  }

  const handleDragMove = (event: any) => {
    // 横方向のドラッグを制限（ドロップ位置計算には影響しないよう調整）
    if (event.delta && event.delta.x !== 0) {
      event.delta.x = 0
    }
  }

  return (
    <>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
        onDragMove={handleDragMove}
    >
      <SortableContext items={shelves.map(shelf => shelf.id)} strategy={verticalListSortingStrategy}>
          <ul className={`space-y-1 ${compact ? 'flex flex-col items-center' : ''}`}>
          {shelves.map((shelf) => (
            <SortableShelfItem
              key={shelf.id}
              shelf={shelf}
              isSelected={selectedShelfId === shelf.id}
                iconUrl={icons[shelf.id]}
                onIconChange={setIcon}
                compact={compact}
                count={counts[shelf.id] || 0}
              onSelect={() => {
                setSelectedShelfId(shelf.id)
                onShelfSelect(shelf.id)
              }}
                onDelete={() => {
                  setDeleteDialog({
                    open: true,
                    shelfId: shelf.id,
                    shelfName: shelf.name
                  })
                }}
                editingShelfId={editingShelfId}
                setEditingShelfId={setEditingShelfId}
            />
          ))}
        {shelves.length === 0 && (
          <li className="text-xs text-muted-foreground">まだ棚がありません</li>
        )}
        </ul>
      </SortableContext>
    </DndContext>
      
      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        onConfirm={handleDeleteShelf}
        title="ギャラリーを削除"
        description="このギャラリーを削除しますか？この操作は取り消せません。"
        itemName={deleteDialog.shelfName}
      />
      
      <DeleteConfirmDialog
        open={deleteItemDialog.open}
        onOpenChange={(open) => setDeleteItemDialog(prev => ({ ...prev, open }))}
        onConfirm={handleDeleteItem}
        title="楽曲を削除"
        description="この楽曲を削除しますか？この操作は取り消せません。"
        itemName={deleteItemDialog.itemName}
      />
    </>
  )
}

function SortableShelfItem({ 
  shelf, 
  isSelected, 
  onSelect, 
  onDelete,
  compact,
  iconUrl,
  onIconChange,
  count,
  editingShelfId,
  setEditingShelfId
}: { 
  shelf: { id: string; name: string; sort_order: number }
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  compact: boolean
  iconUrl?: string
  onIconChange: (id: string, url: string) => void
  count: number
  editingShelfId: string | null
  setEditingShelfId: (id: string | null) => void
}) {
  const [showButtons, setShowButtons] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isEditingIcon, setIsEditingIcon] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState(shelf.name)
  const [editIconUrl, setEditIconUrl] = useState(iconUrl)
  const [lastEnterTime, setLastEnterTime] = useState(0)
  
  const isCurrentlyEditing = editingShelfId === shelf.id || showEditModal

  const handleEdit = async () => {
    if (editName.trim() === '') return

    const fd = new FormData()
    fd.set('id', shelf.id)
    fd.set('name', editName.trim())

    try {
      const { updateShelf } = await import('./actions')
      const result = await updateShelf(fd)
      if (result?.shelf) {
        // 棚名を更新
        shelf.name = result.shelf.name
        setIsEditing(false)
        setIsEditingIcon(false)
        setEditingShelfId(null)
        // 親コンポーネントに変更を通知
        window.dispatchEvent(new CustomEvent('shelf:updated', {
          detail: { shelfId: shelf.id, newName: result.shelf.name, sortOrder: (result as any)?.shelf?.sort_order }
        }))
      }
    } catch (error) {
      console.error('棚名の更新に失敗しました:', error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 日本語IMEの変換確定Enterは無視
    const anyEvt = e.nativeEvent as any
    if (anyEvt?.isComposing) return
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      const now = Date.now()
      // 500ms以内の連続Enterで確定
      if (now - lastEnterTime < 500) {
        handleEdit()
        setLastEnterTime(0)
      } else {
        setLastEnterTime(now)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setIsEditing(false)
      setIsEditingIcon(false)
      setEditingShelfId(null)
      setEditName(shelf.name)
      setLastEnterTime(0)
    }
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: shelf.id })

  const style = {
    // 横方向の移動を制限（縦方向のみ）
    transform: isDragging ? `translateY(${transform?.y || 0}px)` : CSS.Transform.toString(transform),
    transition: isDragging ? 'background-color 120ms ease' : (compact ? 'background-color 120ms ease, transform 200ms ease' : 'background-color 120ms ease, transform 200ms ease'),
    opacity: isDragging ? 0.5 : 1,
  }
  
  // 編集中はドラッグを無効化
  const dragListeners = isCurrentlyEditing ? {} : listeners
  const dragAttributes = isCurrentlyEditing ? {} : attributes

  const triggerIconUpload = () => {
    const input = document.getElementById(`icon-input-${shelf.id}`) as HTMLInputElement | null
    input?.click()
  }



  const handleIconFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      if (showEditModal) {
        setEditIconUrl(dataUrl)
      } else {
        onIconChange(shelf.id, dataUrl)
      }
    }
    reader.readAsDataURL(file)
    
    // reset value to allow re-selecting same file later
    e.target.value = ''
  }

  // 行外クリックで編集終了
  const rowRef = useRef<HTMLLIElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!isEditing) return
    const onDown = (e: MouseEvent) => {
      if (!rowRef.current) return
      const target = e.target as Node
      if (!rowRef.current.contains(target)) {
        setIsEditing(false)
        setIsEditingIcon(false)
        setEditingShelfId(null)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [isEditing])

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    if (!showButtons) return
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current && !menuRef.current.contains(target)) {
        setShowButtons(false)
      }
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [showButtons])

  return (
    <li 
      ref={(el) => { setNodeRef(el as any); rowRef.current = el }}
      style={{ 
        ...style,
        // 背景色はクラスで制御（hoverが効くように）
        backgroundColor: isSelected && compact ? 'transparent' : undefined,
        // 横方向の移動を制限
        transform: isDragging ? `translateY(${transform?.y || 0}px)` : CSS.Transform.toString(transform)
      }}
      className={`flex items-center justify-between ${compact ? 'px-1 py-1' : 'px-2 py-1'} text-base rounded cursor-grab active:cursor-grabbing transition-colors duration-200 ease-in-out ${isSelected && !compact ? 'bg-[#4d4d4d] hover:!bg-[#333333] hover:!text-white' : ''} ${!isSelected && !compact ? 'hover:bg-[#333333] hover:text-white' : ''}`}
      data-shelf-selected={isSelected}
      data-shelf-id={shelf.id}
      {...dragAttributes}
      {...dragListeners}
    >
      <div className={`flex items-center ${compact ? 'gap-0.5' : 'gap-2'} flex-1 min-w-0`} onClick={onSelect} title={compact ? shelf.name : undefined}>
        {/* Icon/avatar */}
        <div 
          className={`shrink-0 relative ${compact && isSelected ? 'ring-2 ring-white rounded-lg' : ''} ${compact ? 'hover:scale-110 transition-transform duration-200 ease-out' : ''}`}
          onClick={(e) => {
            // 細い時は棚選択を許可するため、stopPropagationしない
            if (!compact) {
              e.stopPropagation();
            }
          }}
        >
          {iconUrl ? (
            <img
              src={iconUrl}
              alt=""
              className={`${compact ? 'h-9 w-9' : 'h-8 w-8'} rounded-lg object-cover cursor-default`}
              onPointerDown={(e) => { if (!compact) e.stopPropagation() }}
              onMouseDown={(e) => { if (!compact) e.stopPropagation() }}
              onClick={(e) => {
                e.preventDefault();
                // 細い時は棚選択を許可するため、stopPropagationしない
                if (!compact) {
                  e.stopPropagation();
                }
              }}
              title={undefined}
            />
          ) : (
            <div
              className={`${compact ? 'h-9 w-9' : 'h-8 w-8'} rounded-lg flex items-center justify-center text-white cursor-default`}
              style={{ backgroundColor: '#24b324', fontSize: compact ? '12px' : '14px', paddingBottom: shelf.name?.[0]?.match(/[A-Z]/) ? '1px' : '2px' }}
              onPointerDown={(e) => { if (!compact) e.stopPropagation() }}
              onMouseDown={(e) => { if (!compact) e.stopPropagation() }}
              onClick={(e) => {
                e.preventDefault();
                // 細い時は棚選択を許可するため、stopPropagationしない
                if (!compact) {
                  e.stopPropagation();
                }
              }}
              title={undefined}
            >
              {shelf.name?.[0] || '棚'}
      </div>
          )}
          {isEditingIcon && (
            <div className="absolute inset-0 rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Pen className="h-3 w-3 text-white" />
      </div>
          )}
          {/* コンパクト時: ホバーで右下にペンボタン（モーダル起動） */}
          {compact && (
            <button
              type="button"
              onClick={(e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                setEditName(shelf.name);
                setEditIconUrl(iconUrl);
                setShowEditModal(true) 
              }}
              onPointerDown={(e) => {
                e.stopPropagation()
              }}
              onPointerUp={(e) => {
                e.stopPropagation()
              }}
              onMouseDown={(e) => {
                e.stopPropagation()
              }}
              className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 grid place-items-center z-10"
              aria-label="編集"
            >
              <Pen className="h-3 w-3" />
            </button>
          )}
        </div>
        <input id={`icon-input-${shelf.id}`} type="file" accept="image/*" className="hidden" onChange={handleIconFile} />
        {!compact && (
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className={`truncate text-white h-5 leading-5`} style={{ fontFamily: 'inherit' }}>{shelf.name}</div>
            <div className="text-xs text-muted-foreground">{count} 曲</div>
          </div>
        )}
      </div>
      
      {!compact && (
        <div className="relative" ref={menuRef}>
          {showButtons && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="absolute right-0 top-full mt-1 z-10 py-0 min-w-[60px] rounded-sm overflow-hidden"
              style={{ backgroundColor: '#333333' }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setEditName(shelf.name)
                  setEditIconUrl(iconUrl)
                  setShowEditModal(true)
                  setShowButtons(false)
                }}
                className="w-full px-2 py-1 text-sm text-white bg-transparent hover:!bg-[#4d4d4d] transition-colors hover:rounded-t-sm"
              >
                編集
              </button>
              <div className="border-t" style={{ borderColor: '#1a1a1a' }}></div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('Delete button clicked')
          onDelete()
                  setShowButtons(false)
                }}
                className="w-full px-2 py-1 text-sm text-white bg-transparent hover:!bg-red-600 transition-colors hover:rounded-b-sm"
              >
                削除
              </button>
            </motion.div>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              console.log('Dropdown button clicked, toggling buttons')
              setShowButtons(!showButtons)
            }}
            className={`p-2 text-white hover:bg-gray-800 rounded transition-colors`}
            aria-label="メニューを開く"
          >
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showButtons ? 'rotate-180' : ''}`} />
          </button>
        </div>
      )}
      {/* 編集モーダル（細い時・通常時共通） */}
      <Dialog open={showEditModal} onOpenChange={(open) => { 
        setShowEditModal(open); 
        if (!open) {
          setIsEditingIcon(false);
          setEditIconUrl(iconUrl); // リセット
        }
      }}>
          <DialogContent className="sm:max-w-[420px] bg-[#1a1a1a] border-none [&>button]:bg-transparent [&>button]:text-gray-400 [&>button]:hover:text-white [&>button]:hover:bg-transparent [&>button]:focus:outline-none [&>button]:focus:ring-0 [&>button]:border-none [&>button]:shadow-none">
            <DialogHeader>
              <DialogTitle className="text-white">棚を編集</DialogTitle>
              <DialogDescription>棚の名前とアイコンを変更します</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-3">
              <div className="relative group">
                {editIconUrl ? (
                  <img src={editIconUrl} alt="" className="h-16 w-16 rounded-lg object-cover cursor-pointer border border-white" onClick={(e) => { e.preventDefault(); e.stopPropagation(); triggerIconUpload() }} />
                ) : (
                  <div className="h-16 w-16 rounded-lg grid place-items-center text-white cursor-pointer border border-white" style={{ backgroundColor: '#696969' }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); triggerIconUpload() }}>{editName?.[0] || '棚'}</div>
                )}
                <div className="absolute inset-0 rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <Pen className="h-4 w-4 text-white" />
                </div>
                <input id={`icon-input-${shelf.id}`} type="file" accept="image/*" className="hidden" onChange={handleIconFile} />
                {/* アイコン削除ボタン */}
                {editIconUrl && (
                  <button
                    type="button"
                    onClick={(e) => { 
                      e.preventDefault(); 
                      e.stopPropagation(); 
                      setEditIconUrl(undefined);
                    }}
                    className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600 transition-colors"
                    aria-label="アイコンを削除"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { 
                    if (e.key === 'Enter') {
                      const now = Date.now()
                      if (now - lastEnterTime < 500) {
                        // 2回連続でEnterが押された場合のみ保存
                        handleEdit(); 
                        setShowEditModal(false);
                        setLastEnterTime(0)
                      } else {
                        setLastEnterTime(now)
                      }
                    }
                  }}
                  className="w-full border-none bg-transparent text-white outline-none text-base font-medium"
                  placeholder="棚名"
                  autoFocus
                />
                <div className="text-xs text-muted-foreground mt-1">{count} 曲</div>
              </div>
            </div>
            <DialogFooter className="justify-between">
              <Button onClick={() => { 
                // モーダル内の変更を保存
                if (editIconUrl !== undefined) {
                  if (editIconUrl) {
                    onIconChange(shelf.id, editIconUrl)
                  } else {
                    // アイコンが削除された場合
                    onIconChange(shelf.id, '')
                  }
                }
                handleEdit(); 
                setShowEditModal(false); 
                setIsEditingIcon(false);
                setEditIconUrl(iconUrl); // リセット
              }} 
              className="group relative text-white bg-transparent hover:bg-transparent transition-all duration-300 focus:outline-none focus:ring-0 border-none p-0"
              style={{ backgroundColor: 'transparent' }}>
                <span className="relative z-10">保存</span>
                <div className="absolute bottom-1 left-0 w-0 h-0.5 bg-white transition-all duration-300 ease-out group-hover:w-full"></div>
        </Button>
              <Button 
                onClick={() => { onDelete(); setShowEditModal(false); setIsEditingIcon(false); setEditIconUrl(undefined); }}
                className="group relative text-[#dc2626] bg-transparent hover:bg-transparent transition-all duration-300 focus:outline-none focus:ring-0 border-none p-0"
                style={{ backgroundColor: 'transparent' }}>
                <span className="relative z-10">削除</span>
                <div className="absolute bottom-1 left-0 w-0 h-0.5 bg-[#dc2626] transition-all duration-300 ease-out group-hover:w-full"></div>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
    </li>
  )
}

function SearchPanel() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<any[]>([])
  const [adding, setAdding] = useState<string | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [notifiedAuthMissing, setNotifiedAuthMissing] = useState(false)
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)
  const { toast } = useToast()

  // ドロップダウン外をクリックした時に閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.search-dropdown')) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  // コンポーネントのアンマウント時にタイムアウトをクリア
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }
    }
  }, [searchTimeout])

  // 入力時に認証切れを検知して通知（多重通知を抑制）
  const checkAuthAndNotify = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.provider_token
      if (!token) {
        if (!notifiedAuthMissing) {
          window.dispatchEvent(new CustomEvent('spotify:reauth-required'))
          toast({ title: 'Spotifyに再ログインしてください' })
          setNotifiedAuthMissing(true)
        }
        return false
      }
      // トークンが復帰していれば通知状態を解除
      if (notifiedAuthMissing) setNotifiedAuthMissing(false)
      return true
    } catch {
      return false
    }
  }

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    
    // 既存のタイムアウトをクリア
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }
    
    if (v.trim()) {
      void checkAuthAndNotify()
      
      // 500ms後に自動検索を実行
      const timeout = setTimeout(async () => {
        await performSearch(v)
      }, 500)
      setSearchTimeout(timeout)
    } else {
      setNotifiedAuthMissing(false)
      setResults([])
      setIsDropdownOpen(false)
    }
  }

  const performSearch = async (searchQuery: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.provider_token
    if (!searchQuery.trim()) return
    if (!token) {
      window.dispatchEvent(new CustomEvent('spotify:reauth-required'))
      toast({ title: 'Spotifyに再ログインしてください' })
      return
    }

    const params = new URLSearchParams({ q: searchQuery, type: 'track', limit: '10' })
    const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('spotify:reauth-required'))
      toast({ title: 'Spotifyに再ログインしてください' })
      return
    }
    const json = await res.json()
    const list = (json['tracks']?.items || []).map((it: any) => ({
      id: it.id,
      name: it.name,
      artists: (it.artists || []).map((a: any) => a.name).join(', '),
      album: it.album?.name || '',
      image: it.album?.images?.[0]?.url || null,
      type: 'track',
    }))
    setResults(list)
    setIsDropdownOpen(true)
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault()
    await performSearch(query)
  }

  async function addToShelf(r: any) {
    console.log('addToShelf called for:', r.name)
    setAdding(r.id)
    
    // 現在選択されている棚を取得
    const currentShelf = document.querySelector('[data-shelf-selected="true"]')
    console.log('currentShelf found:', currentShelf)
    if (!currentShelf) { 
      console.log('No shelf selected')
      setAdding(null)
      toast({
        title: '棚を選択してください',
        description: '楽曲を追加するには、まず棚を選択してください。',
        variant: 'destructive'
      })
      return 
    }
    const shelfId = currentShelf.getAttribute('data-shelf-id')
    console.log('shelfId:', shelfId)
    if (!shelfId) { 
      console.log('No shelfId found')
      setAdding(null)
      toast({
        title: '棚を選択してください',
        description: '楽曲を追加するには、まず棚を選択してください。',
        variant: 'destructive'
      })
      return 
    }
    
    const fd = new FormData()
    fd.set('shelfId', shelfId)
    fd.set('spotifyType', 'track')
    fd.set('spotifyId', r.id)
    fd.set('title', r.name)
    fd.set('artist', r.artists || '')
    fd.set('album', r.album || '')
    if (r.image) fd.set('imageUrl', r.image)
    const { addShelfItem } = await import('./actions')
    // @ts-ignore
    const res = await addShelfItem(fd)
    setAdding(null)
    if (res?.item) {
      // 中央の棚ビューへ反映するイベント発火（shelf_idを含める）
      window.dispatchEvent(new CustomEvent('shelf:item-added', { 
        detail: { ...res.item, shelf_id: shelfId } 
      }))
      // 追加後はドロップダウンを閉じない（検索結果エリア外をクリックするまで開いたまま）
    }
  }

  return (
    <div className="relative search-dropdown">
      <form onSubmit={onSearch}>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={handleInputChange}
            placeholder="追加したい曲名を入力"
            className="rounded px-2 py-1 text-base w-64 bg-black text-white border-none focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
          />
          <Button type="submit" size="sm" className="text-white hover:!bg-[#4d4d4d] focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 transition-all duration-200 !border-0 shadow-none" style={{ backgroundColor: '#333333', border: 'none' }}>検索</Button>
        </div>
      </form>

      {isDropdownOpen && results.length > 0 && (
        <div className="absolute top-full left-0 border rounded-xl shadow-lg z-10 max-h-96 overflow-hidden mt-1 bg-black w-[340px] max-w-[75vw]" style={{ borderColor: '#1a1a1a' }}>
          <div className="relative">
            <ul className="space-y-2 py-2 px-2.5 max-h-96 overflow-auto no-scrollbar">
        {results.map((r) => (
                <li key={r.id} className="flex items-center gap-3 border rounded-lg p-2.5 bg-[#1a1a1a] hover:bg-[#222222] transition-colors" style={{ borderColor: '#2a2a2a' }}>
                  {r.image ? <img src={r.image} alt="" className="h-10 w-10 rounded object-cover" /> : <div className="h-10 w-10 rounded" style={{ backgroundColor: '#1a1a1a' }} />}
            <div className="flex-1 min-w-0">
                    <div className="truncate text-base font-medium text-white">{r.name}</div>
                    <div className="truncate text-xs text-gray-400">曲・{r.artists}</div>
            </div>
                  <Button size="sm" onClick={() => addToShelf(r)} disabled={adding === r.id} className="text-white px-3 py-1 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 transition-all duration-200 border-none" style={{ backgroundColor: '#333333' }}>
                    {adding === r.id ? '追加中...' : '追加'}
            </Button>
          </li>
        ))}
      </ul>
          </div>
        </div>
      )}
    </div>
  )
}

function ShelfView({ onShelfItemsChange, currentTrack, toast, user }: { onShelfItemsChange: (items: any[]) => void, currentTrack?: any, toast: any, user: any }) {
  const [selectedShelfId, setSelectedShelfId] = useState<string>("")
  const [items, setItems] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [activeItem, setActiveItem] = useState<any | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    const onShelfSelect = (e: any) => {
      console.log('Shelf selected:', e.detail.shelfId)
      setSelectedShelfId(e.detail.shelfId)
    }
    window.addEventListener('shelf:selected', onShelfSelect)
    return () => {
      window.removeEventListener('shelf:selected', onShelfSelect)
    }
  }, [])

  useEffect(() => {
    const onItemAdded = (e: any) => {
      console.log('Item added:', e.detail, 'Current shelf:', selectedShelfId)
      // 現在選択中の棚にアイテムが追加された場合のみ更新
      if (e.detail.shelf_id === selectedShelfId) {
        console.log('Adding item to current shelf view')
        // 現在のitemsを参照して新しいアイテムを追加
        setItems((currentItems) => {
          const newItems = [...currentItems, e.detail]
          // 次のレンダリングサイクルでグローバル状態を更新
          setTimeout(() => onShelfItemsChange(newItems), 0)
          return newItems
        })
      }
    }

    window.addEventListener('shelf:item-added', onItemAdded)
    return () => {
      window.removeEventListener('shelf:item-added', onItemAdded)
    }
  }, [selectedShelfId, onShelfItemsChange])

  useEffect(() => {
    if (!selectedShelfId) return
    const load = async () => {
      const { data } = await supabase
        .from('shelf_items')
        .select('*')
        .eq('shelf_id', selectedShelfId)
        .order('position', { ascending: true })
      console.log('ホーム画面 - 取得したアイテム:', (data || []).map(item => ({
        id: item.id,
        title: item.title,
        artist: item.artist,
        album: item.album,
        image_url: item.image_url,
        spotify_id: item.spotify_id
      })))
      setItems(data || [])
      onShelfItemsChange(data || [])
    }
    load()

    // リアルタイムで棚アイテムの変更を監視（削除と並び替えのみ）
    const channel = supabase
      .channel('shelf_items_changes')
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'shelf_items',
          filter: `shelf_id=eq.${selectedShelfId}`
        },
        () => {
          load() // 削除があったら再読み込み
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shelf_items',
          filter: `shelf_id=eq.${selectedShelfId}`
        },
        () => {
          load() // 並び替えがあったら再読み込み
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedShelfId, onShelfItemsChange])

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (active.id !== over?.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over?.id)
        const newItems = arrayMove(items, oldIndex, newIndex)
        
        // グローバルプレイヤーの再生順序を更新
        setTimeout(() => onShelfItemsChange(newItems), 0)
        
        // サーバーに並び順を保存
        const itemIds = newItems.map(item => item.id)
        const fd = new FormData()
        fd.set('shelfId', selectedShelfId)
        fd.set('itemIds', JSON.stringify(itemIds))
        
        // 非同期でサーバー更新（楽観的更新）
        import('./actions').then(({ reorderShelfItems }) => {
          reorderShelfItems(fd)
        })
        
        return newItems
      })
    }
  }

  if (!selectedShelfId) {
    return <div className="text-base text-muted-foreground">棚を選択してください</div>
  }

  return (
    <div className="space-y-4">
      {/* 件数表示はヘッダーへ移動 */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map(item => item.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {items.map((item) => {
              const isCurrentlyPlaying = currentTrack && 
                `spotify:${item.spotify_type}:${item.spotify_id}` === currentTrack.uri
              return (
                <div key={item.id} className="relative">
                  <SortableAlbumCover 
                    item={item} 
                    isCurrentlyPlaying={isCurrentlyPlaying}
                    onClick={() => { setActiveItem(item); setOpen(true) }} 
                    toast={toast} 
                  />
                </div>
              )
            })}
          </div>
        </SortableContext>
      </DndContext>
      <ItemDetailDialog 
        open={open} 
        onOpenChange={setOpen} 
        item={activeItem} 
        onDeleted={() => {
          const newItems = items.filter((i) => i.id !== activeItem?.id)
          setItems(newItems)
          onShelfItemsChange(newItems)
        }}
        shelfItems={items}
        onItemChange={(item) => setActiveItem(item)}
        user={user}
      />
      
      {items.length === 0 && (
        <div className="text-base text-muted-foreground text-center py-8">
          この棚にはまだアイテムがありません
        </div>
      )}
    </div>
  )
}

function SortableAlbumCover({ item, onClick, isCurrentlyPlaying, toast }: { item: any, onClick?: () => void, isCurrentlyPlaying?: boolean, toast: any }) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 1000 : 1,
  }

  const handleDeleteItem = async () => {
    try {
      const fd = new FormData()
      fd.set('id', item.id)
      const { deleteShelfItem } = await import('./actions')
      await deleteShelfItem(fd)
      // 楽曲削除イベントを発火
      window.dispatchEvent(new CustomEvent('shelf:item-deleted', { 
        detail: { itemId: item.id } 
      }))
      setShowDeleteDialog(false)
    } catch (error) {
      console.error('Failed to delete item:', error)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group cursor-grab active:cursor-grabbing ${isDragging ? 'absolute inset-0' : ''}`}
    >
      <motion.div 
        onClick={onClick} 
        className={`relative transform transition-all duration-200 ${
          isDragging 
            ? 'scale-110 rotate-2 shadow-2xl' 
            : isOver 
              ? 'scale-105 rotate-1' 
              : 'group-hover:scale-105 group-hover:rotate-1'
        }`}
        style={{
          ...style,
          ...(isDragging && {
            scale: 1.1,
            y: -10,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            zIndex: 1000
          }),
          ...(isOver && {
            scale: 1.05
          })
        }}
        animate={isCurrentlyPlaying ? {
          y: [-6, 6, -6],
          scale: [1, 1.08, 1],
          boxShadow: 'none'
        } : {
          y: 0,
          scale: 1,
          boxShadow: 'none'
        }}
        transition={isCurrentlyPlaying ? {
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        } : {
          duration: 0.5,
          ease: "easeOut"
        }}
      >
        {/* 画像コンテナ */}
        <div className="relative rounded-lg" style={{ backgroundColor: '#1a1a1a' }}>
        {item.image_url ? (
          <img 
            src={item.image_url} 
            alt={item.title}
              className="w-full aspect-square object-cover rounded-lg"
          />
        ) : (
            <div className="w-full aspect-square bg-muted rounded-lg flex items-center justify-center">
              <div className="text-muted-foreground text-xs text-center p-2">
              {item.title}
            </div>
          </div>
        )}
          {isCurrentlyPlaying && (
            <div className="absolute top-1.5 left-1.5 bg-black/60 rounded-full p-1.5 shadow-md">
              <Music className="h-4 w-4 text-white" />
            </div>
          )}
          {/* Hover overlay: only on image area */}
          <div className="pointer-events-none absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="absolute inset-0 rounded-lg bg-black/30" />
            {/* Delete button in top-right corner */}
            <button
              className="pointer-events-auto absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-transparent hover:bg-transparent flex items-center justify-center shadow-none transition-colors"
              title="削除"
              onClick={(e) => {
                e.stopPropagation()
                setShowDeleteDialog(true)
              }}
            >
              <Trash2 className="h-4 w-4 text-red-500 transition-transform duration-100 hover:scale-125" strokeWidth={2} />
            </button>
            <div className="absolute inset-0 flex items-end justify-center pb-1 px-1">
              <div className="pointer-events-auto flex items-center gap-1 w-full max-w-full justify-center">
                <button
                  className="h-6 w-6 rounded-full bg-white/80 hover:bg-white text-black flex items-center justify-center shadow-sm flex-shrink-0"
                  title="外部で開く"
                  onClick={(e) => { e.stopPropagation(); const url = item.spotify_type && item.spotify_id ? `https://open.spotify.com/${item.spotify_type}/${item.spotify_id}` : undefined; if (url) window.open(url, '_blank') }}
                >
                  <ExternalLink className="h-3 w-3" />
                </button>
                <button
                  className="h-6 w-6 rounded-full bg-white/80 hover:bg-white text-black flex items-center justify-center shadow-sm flex-shrink-0"
                  title="リンクをコピー"
                  onClick={(e) => { e.stopPropagation(); const url = item.spotify_type && item.spotify_id ? `https://open.spotify.com/${item.spotify_type}/${item.spotify_id}` : ''; if (url) { navigator.clipboard?.writeText(url); toast({ title: 'リンクをコピーしました' }) } }}
                >
                  <LinkIcon className="h-3 w-3" />
                </button>
                <button
                  className="h-6 w-6 rounded-full bg-white/80 hover:bg-white text-black flex items-center justify-center shadow-sm flex-shrink-0"
                  title="再生"
                  onClick={async (e) => { e.stopPropagation();
                    const { data: { session } } = await supabase.auth.getSession();
                    const accessToken = (session as any)?.provider_token || (session as any)?.providerToken
                    if (!accessToken) { 
                      window.dispatchEvent(new CustomEvent('spotify:reauth-required'))
                      toast({ title: 'Spotifyに再ログインしてください' })
                      return 
                    }
                    try {
                      // デバイス確認
                      const devRes = await fetch('https://api.spotify.com/v1/me/player/devices', {
                        headers: { Authorization: `Bearer ${accessToken}` }
                      })
                      const devJson = await devRes.json()
                      const devices = (devJson?.devices || []) as Array<{ id: string; is_active: boolean }>
                      if (!devices.length) {
                        toast({ title: '再生可能なSpotifyデバイスが見つかりません', description: 'Spotifyアプリを起動してください', variant: 'destructive' })
                        return
                      }
                      if (!devices.some(d => d.is_active)) {
                        const target = devices[0]
                        await fetch('https://api.spotify.com/v1/me/player', {
                          method: 'PUT',
                          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                          body: JSON.stringify({ device_ids: [target.id], play: false })
                        })
                      }

                      const body = { uris: [`spotify:track:${item.spotify_id}`] }
                      const res = await fetch('https://api.spotify.com/v1/me/player/play', {
                        method: 'PUT',
                        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                      })

                      if (!res.ok) {
                        const txt = await res.text()
                        console.error('Play error:', txt)
                        toast({ title: '再生に失敗しました', variant: 'destructive' })
                        return
                      }

                      window.dispatchEvent(new CustomEvent('track:playing', { detail: { id: item.id, title: item.title, artist: item.artist, album: item.album, image_url: item.image_url, duration_ms: item.duration_ms, shelfItems: undefined } }))
                    } catch (err) {
                      console.error('Play error:', err)
                      toast({ title: '再生に失敗しました', variant: 'destructive' })
                    }
                  }}
                >
                  <Play className="h-3 w-3" />
                </button>
                <button
                  className="h-6 w-6 rounded-full bg-white/80 hover:bg-white text-black flex items-center justify-center shadow-sm flex-shrink-0"
                  title="一時停止"
                  onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('player:pause')) }}
                >
                  <Pause className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-1 px-2 py-1">
          <div className="text-xs font-medium truncate text-white">{item.title}</div>
          <div className="text-xs text-muted-foreground truncate">{item.artist}</div>
        </div>
      </motion.div>
      
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteItem}
        title="楽曲を削除"
        description="この楽曲を削除しますか？この操作は取り消せません。"
        itemName={item?.title}
      />
    </div>
  )
}

function ItemDetailDialog({ open, onOpenChange, item, onDeleted, shelfItems, onItemChange, user }: { open: boolean, onOpenChange: (v:boolean)=>void, item: any | null, onDeleted: () => void, shelfItems: any[], onItemChange: (item: any) => void, user: any }) {
  // Hooks must be called unconditionally and in the same order
  const [isLoading, setIsLoading] = useState(false)
  const [memo, setMemo] = useState("")
  const [isMemoOpen, setIsMemoOpen] = useState(false)
  const [isMemoLoading, setIsMemoLoading] = useState(false)
  const [showLikesModal, setShowLikesModal] = useState(false)
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [commentModalOpen, setCommentModalOpen] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [likeCount, setLikeCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)
  const [likes, setLikes] = useState<any[]>([])
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [isLoadingCounts, setIsLoadingCounts] = useState(false)
  const { toast } = useToast()

  // Get current item index and navigation functions
  const currentIndex = item && shelfItems ? shelfItems.findIndex(shelfItem => shelfItem.id === item.id) : -1
  const hasPrevious = currentIndex > 0
  const hasNext = currentIndex < (shelfItems?.length || 0) - 1

  const handlePrevious = () => {
    if (hasPrevious && shelfItems) {
      onItemChange(shelfItems[currentIndex - 1])
    }
  }

  const handleNext = () => {
    if (hasNext && shelfItems) {
      onItemChange(shelfItems[currentIndex + 1])
    }
  }

  // Initialize memo when item changes
  useEffect(() => {
    if (item) {
      setMemo(item.memo || "")
      setIsMemoOpen(false) // Reset memo input state when item changes
      loadCounts()
    }
  }, [item])

  // Reset memo input state when modal closes
  useEffect(() => {
    if (!open) {
      setIsMemoOpen(false)
    }
  }, [open])

  const loadCounts = async () => {
    if (!item) return
    
    setIsLoadingCounts(true)
    try {
      const [likeResult, commentResult] = await Promise.all([
        getLikeCount(item.id),
        getCommentCount(item.id)
      ])
      
      if (likeResult.count !== undefined) {
        setLikeCount(likeResult.count)
      }
      if (commentResult.count !== undefined) {
        setCommentCount(commentResult.count)
      }
    } catch (error) {
      console.error('Failed to load counts:', error)
    } finally {
      setIsLoadingCounts(false)
    }
  }


  const handleShowLikes = async () => {
    if (!item) return
    
    setShowLikesModal(true)
    try {
      const result = await getLikes(item.id)
      console.log('いいね取得結果:', result)
      if (result.likes && Array.isArray(result.likes)) {
        setLikes(result.likes)
        console.log('いいね数:', result.likes.length)
      } else {
        console.log('いいねデータがありません')
        setLikes([])
      }
    } catch (error) {
      console.error('Failed to load likes:', error)
      setLikes([])
    }
  }

  const handleShowComments = async () => {
    if (!item) return
    console.log('コメント表示開始:', { itemId: item.id, userId: user?.id })
    setSelectedItemId(item.id)
    setCommentModalOpen(true)
  }

  if (!item) return null
  async function handleDelete() {
    const fd = new FormData()
    fd.set('id', item.id)
    const { deleteShelfItem } = await import('./actions')
    // @ts-ignore
    const res = await deleteShelfItem(fd)
    if (!res?.error) {
      onDeleted()
      onOpenChange(false)
    }
  }
  async function handlePlay(retryCount = 0) {
    setIsLoading(true)
    try {
      console.log(`ホーム再生試行 ${retryCount + 1}回目:`, item.title)
      
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.provider_token
      if (!token) {
        console.log('アクセストークンが見つかりません')
        window.dispatchEvent(new CustomEvent('spotify:reauth-required'))
        toast({ title: 'Spotifyに再ログインしてください' })
        return
      }
      
      console.log('アクセストークン取得成功')
      
      // アクティブデバイスが無いと404が返るため、デバイスを確認して必要なら転送を試みる
      const devRes = await fetch('https://api.spotify.com/v1/me/player/devices', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const devJson = await devRes.json()
      const devices = (devJson?.devices || []) as Array<{ id: string; is_active: boolean }>
      
      console.log('デバイス一覧:', devices.length, '個のデバイス')
      
      if (!devices.length) {
        console.log('デバイスが見つかりません')
        toast({ title: '再生可能なSpotifyデバイスが見つかりません', description: 'Spotifyアプリを起動してください', variant: 'destructive' })
        return
      } else if (!devices.some(d => d.is_active)) {
        console.log('アクティブデバイスが見つからないため、デバイス転送を実行')
        const target = devices[0]
        const transferRes = await fetch('https://api.spotify.com/v1/me/player', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_ids: [target.id], play: false })
        })
        
        if (transferRes.ok) {
          console.log('デバイス転送成功、アクティブデバイス状態を確認します')
          // デバイス転送後にアクティブデバイスの状態を確認
          let deviceActive = false
          let attempts = 0
          const maxAttempts = 5
          
          while (!deviceActive && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000))
            attempts++
            console.log(`アクティブデバイス確認試行 ${attempts}/${maxAttempts}`)
            
            const checkDevicesRes = await fetch('https://api.spotify.com/v1/me/player/devices', {
              headers: { Authorization: `Bearer ${token}` }
            })
            const checkDevicesJson = await checkDevicesRes.json()
            const checkDevices = (checkDevicesJson?.devices || []) as Array<{ id: string; is_active: boolean }>
            
            deviceActive = checkDevices.some(d => d.is_active)
            console.log('アクティブデバイス状態:', deviceActive)
          }
          
          if (!deviceActive) {
            console.log('デバイス転送が完了しませんでした、リトライします')
            if (retryCount < 2) {
              setTimeout(() => handlePlay(retryCount + 1), 1000 * (retryCount + 1))
              return
            }
          }
        } else {
          console.log('デバイス転送失敗:', transferRes.status)
          if (retryCount < 2) {
            setTimeout(() => handlePlay(retryCount + 1), 1000 * (retryCount + 1))
            return
          }
        }
      } else {
        console.log('アクティブデバイスが見つかりました')
      }
      
      // トラックの場合はuris、アルバム/プレイリストの場合はcontext_uriを使用
      const isTrack = item.spotify_type === 'track'
      const body = isTrack 
        ? { uris: [`spotify:track:${item.spotify_id}`] }
        : { context_uri: `spotify:${item.spotify_type}:${item.spotify_id}` }
      
      console.log('再生開始:', item.spotify_id, 'isTrack:', isTrack)
      const response = await fetch(`https://api.spotify.com/v1/me/player/play`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      
      console.log('再生レスポンス:', response.status, response.statusText)
      
      if (response.status === 401) {
        console.log('認証エラー、再認証が必要')
        window.dispatchEvent(new CustomEvent('spotify:reauth-required'))
        toast({ title: 'Spotifyに再ログインしてください' })
        return
      }
      
      if (response.status === 404) {
        console.log('デバイスが見つからない、リトライします')
        if (retryCount < 2) {
          console.log(`${1000 * (retryCount + 1)}ms後にリトライします`)
          setTimeout(() => handlePlay(retryCount + 1), 1000 * (retryCount + 1))
          return
        } else {
          console.log('リトライ回数上限に達しました')
          toast({ title: 'エラー', description: 'デバイスが見つかりません。Spotifyアプリを開いてください。', variant: 'destructive' })
          return
        }
      }
      
      if (!response.ok) {
        const error = await response.text()
        console.log('再生失敗:', response.status, response.statusText)
        console.log('エラー詳細:', error)
        
        // 初回再生時の一般的な問題（デバイス未準備）の場合はリトライ
        if (response.status === 400 && retryCount < 2) {
          console.log('初回再生エラー、リトライします')
          setTimeout(() => handlePlay(retryCount + 1), 1000 * (retryCount + 1))
          return
        }
        
        toast({ title: '再生に失敗しました', description: 'Spotifyアプリを開いてからもう一度お試しください', variant: 'destructive' })
      } else {
        console.log('再生成功')
      }
    } catch (error) {
      console.error('Play error:', error)
      if (retryCount < 2) {
        console.log('例外エラー、リトライします')
        setTimeout(() => handlePlay(retryCount + 1), 1000 * (retryCount + 1))
        return
      }
      toast({ title: '再生エラー', description: '予期しないエラーが発生しました', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }
  async function handlePause() {
    setIsLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.provider_token
      if (!token) {
        window.dispatchEvent(new CustomEvent('spotify:reauth-required'))
        toast({ title: 'Spotifyに再ログインしてください' })
        return
      }
      
      const response = await fetch(`https://api.spotify.com/v1/me/player/pause`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })
      
      if (!response.ok) {
        const error = await response.text()
        console.error('Pause error:', error)
        toast({ title: '一時停止に失敗しました', variant: 'destructive' })
      }
    } catch (error) {
      console.error('Pause error:', error)
      toast({ title: '一時停止に失敗しました', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }
  // 次へ / 前へ は一旦未実装
  // デバイス更新ロジックは不要
  function spotifyUrl() {
    return `https://open.spotify.com/${item.spotify_type}/${item.spotify_id}`
  }

  async function handleMemoSave() {
    if (memo.length > 15) {
      // メモの文字数制限エラーはtoastで表示
      console.error("メモは15文字以内で入力してください")
      return
    }

    setIsMemoLoading(true)
    const fd = new FormData()
    fd.set('itemId', item.id)
    fd.set('memo', memo)
    
    const res = await updateShelfItemMemo(fd)
    setIsMemoLoading(false)
    
    if (res?.error) {
      // エラーはtoastで表示
      console.error('Memo save error:', res.error)
    } else {
      setIsMemoOpen(false)
      // Update the item with the new memo
      item.memo = memo
    }
  }
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[520px] pb-3 bg-[#1a1a1a] text-white [&>button]:text-[#666666] [&>button:hover]:text-red-500 [&>button]:bg-transparent [&>button:hover]:bg-transparent">
          <div className="relative">
            <DialogHeader>
              <DialogTitle className="flex-1 min-w-0 text-white">{item.title}</DialogTitle>
              <DialogDescription>楽曲の詳細情報と操作</DialogDescription>
            </DialogHeader>
            <div className="flex gap-4">
              {item.image_url ? (
                <img src={item.image_url} alt="" className="w-40 h-40 object-cover rounded" />
              ) : (
                <div className="w-40 h-40 rounded bg-muted" />
              )}
              <div className="flex-1 min-w-0 space-y-1 text-white">
                <div className="flex items-start justify-between min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-base text-muted-foreground">アーティスト</div>
                    <div className="text-base truncate">{item.artist}</div>
                  </div>
                  <div className="flex items-center gap-3 -mt-1 flex-shrink-0 ml-2">
                    <button
                      onClick={handleShowLikes}
                      className="flex items-center gap-1 text-base transition-colors group"
                      disabled={isLoadingCounts}
                    >
                      <Heart className="h-5 w-5 text-white group-hover:text-[#ff80d5] transition-colors" />
                      <span className={likeCount > 0 ? "text-white" : "text-muted-foreground"}>{likeCount}</span>
                    </button>
                    <button
                      onClick={handleShowComments}
                      className="flex items-center gap-1 text-base transition-all group"
                      disabled={isLoadingCounts}
                    >
                      <MessageCircle className="h-5 w-5 text-white transform group-hover:-translate-y-0.5 transition-transform" />
                      <span className={commentCount > 0 ? "text-white" : "text-muted-foreground"}>{commentCount}</span>
                    </button>
                  </div>
                </div>
                {item.album ? (
                  <>
                    <div className="text-base text-muted-foreground mt-2">アルバム</div>
                    <div className="text-base truncate">{item.album}</div>
                  </>
                ) : (
                  <>
                    <div className="text-base text-muted-foreground mt-2">アルバム</div>
                    <div className="text-base truncate text-muted-foreground">アルバム情報なし</div>
                  </>
                )}
                {item.memo && (
                  <div className="flex items-center gap-2 mt-2">
                    <StickyNote className="h-5 w-5 text-gray-500" />
                    <div className="text-base text-white underline">{item.memo}</div>
                  </div>
                )}
              </div>
            </div>

            {/* arrows inside modal at vertical center */}
            <button
              type="button"
              onClick={handlePrevious}
              disabled={!hasPrevious}
              aria-label="前の曲"
              className={`absolute top-1/2 -translate-y-1/2 left-0 -translate-x-[calc(50%+12px)] text-4xl leading-none select-none w-8 h-8 grid place-items-center transition-colors ${hasPrevious ? 'text-gray-500 hover:text-gray-700' : 'text-gray-300 cursor-not-allowed'}`}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!hasNext}
              aria-label="次の曲"
              className={`absolute top-1/2 -translate-y-1/2 right-0 translate-x-[calc(50%+12px)] text-4xl leading-none select-none w-8 h-8 grid place-items-center transition-colors ${hasNext ? 'text-gray-500 hover:text-gray-700' : 'text-gray-300 cursor-not-allowed'}`}
            >
              ›
            </button>
          </div>
          {!isMemoOpen && <hr className="border-[#333333] -mb-2" />}
          
          {/* メモ入力欄 */}
          {isMemoOpen && (
            <div className="mb-2 p-2 bg-[#1a1a1a] border border-[#333333] rounded-lg">
              <div className="mb-2">
                <label className="text-sm font-medium text-white">メモ</label>
              </div>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="メモを入力してください（15文字以内）"
                maxLength={15}
                className="w-full p-2 border border-[#333333] bg-[#1a1a1a] text-white rounded-md focus:outline-none focus:ring-2 focus:ring-[#666666] focus:border-transparent transition-colors placeholder:text-[#666666]"
              />
              <div className="flex items-center justify-between mt-2">
                <div className="text-xs text-[#666666]">
                  {memo.length}/15文字
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleMemoSave}
                    disabled={isMemoLoading}
                    className="px-3 py-1.5 text-sm bg-[#666666] text-white rounded-md hover:bg-[#4d4d4d] disabled:opacity-50 transition-colors"
                  >
                    {isMemoLoading ? '保存中...' : '保存'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMemoOpen(false)}
                    className="px-3 py-1.5 text-sm bg-[#333333] text-white rounded-md hover:bg-[#4d4d4d] transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="!justify-between items-start gap-2 flex-wrap w-full -mt-2 pb-1">
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                className="group flex items-center overflow-hidden w-10 h-10 hover:w-40 transition-all duration-300 rounded-full border-0 bg-gray-200 hover:bg-gray-300 text-gray-700 px-1.5 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                onClick={() => window.open(spotifyUrl(), '_blank', 'noopener,noreferrer')}
                aria-label="Spotifyで開く"
              >
                <span className="flex items-center justify-center text-foreground ml-0.75">
                  <ExternalLink className="h-5 w-5" />
                </span>
                <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  Spotifyで開く
                </span>
              </button>
              <button
                type="button"
                className="group flex items-center overflow-hidden w-10 h-10 hover:w-42 transition-all duration-300 rounded-full border-0 bg-gray-200 hover:bg-gray-300 text-gray-700 px-1.5 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                onClick={() => navigator.clipboard.writeText(spotifyUrl())}
                aria-label="リンクをコピー"
              >
                <span className="flex items-center justify-center text-foreground ml-0.75">
                  <LinkIcon className="h-5 w-5" />
                </span>
                <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  リンクをコピー
                </span>
              </button>
              <button
                type="button"
                className="group flex items-center overflow-hidden w-10 h-10 hover:w-24 transition-all duration-300 rounded-full border-0 bg-gray-200 hover:bg-gray-300 text-gray-700 px-1.5 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                onClick={() => setIsMemoOpen(true)}
                disabled={isMemoOpen}
                aria-label="メモ"
              >
                <span className="flex items-center justify-center text-foreground ml-0.75">
                  <StickyNote className="h-5 w-5" />
                </span>
                <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  メモ
                </span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="group flex items-center overflow-hidden w-10 h-10 hover:w-24 transition-all duration-300 rounded-full border-0 bg-gray-200 hover:bg-gray-300 text-gray-700 px-1.5 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                  onClick={handlePlay}
                  disabled={isLoading}
                  aria-label="再生"
                >
                  <span className="flex items-center justify-center text-foreground ml-0.75">
                    <Play className="h-5 w-5" />
                  </span>
                  <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    再生
                  </span>
                </button>
                <button
                  type="button"
                  className="group flex items-center overflow-hidden w-10 h-10 hover:w-32 transition-all duration-300 rounded-full border-0 bg-gray-200 hover:bg-gray-300 text-gray-700 px-1.5 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                  onClick={handlePause}
                  disabled={isLoading}
                  aria-label="一時停止"
                >
                  <span className="flex items-center justify-center text-foreground ml-0.75">
                    <Pause className="h-5 w-5" />
                  </span>
                  <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    一時停止
                  </span>
                </button>
              </div>
            </div>
            <button
              type="button"
              className="group flex items-center overflow-hidden w-10 h-10 hover:w-24 transition-all duration-300 rounded-full border-0 bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-700 px-1.5 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              onClick={() => setShowDeleteDialog(true)}
              aria-label="削除"
            >
              <span className="flex items-center justify-center text-red-600 ml-1">
                <Trash2 className="h-[1.3rem] w-[1.3rem] text-red-500 transition-transform duration-100 hover:scale-125" strokeWidth={2} />
              </span>
              <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                削除
              </span>
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    {/* いいね一覧モーダル */}
    <Dialog open={showLikesModal} onOpenChange={setShowLikesModal}>
      <DialogContent 
        className="sm:max-w-[400px] bg-[#1a1a1a] border-[#333333] text-white [&>button]:text-[#666666] [&>button:hover]:text-red-500 [&>button]:bg-transparent [&>button:hover]:bg-transparent [&>button]:border-none [&>button:hover]:border-none [&>button]:outline-none [&>button:focus]:outline-none [&>button:focus-visible]:outline-none [&>button]:ring-0 [&>button:focus]:ring-0 [&>button:focus-visible]:ring-0 [&>button]:shadow-none [&>button:focus]:shadow-none [&>button:focus-visible]:shadow-none"
        style={{
          '& button': {
            outline: 'none !important',
            border: 'none !important',
            boxShadow: 'none !important',
            ring: 'none !important',
            '&:focus': {
              outline: 'none !important',
              border: 'none !important',
              boxShadow: 'none !important',
              ring: 'none !important'
            },
            '&:focus-visible': {
              outline: 'none !important',
              border: 'none !important',
              boxShadow: 'none !important',
              ring: 'none !important'
            }
          }
        }}
      >
        <style jsx>{`
          button {
            outline: none !important;
            border: none !important;
            box-shadow: none !important;
            ring: none !important;
          }
          button:focus {
            outline: none !important;
            border: none !important;
            box-shadow: none !important;
            ring: none !important;
          }
          button:focus-visible {
            outline: none !important;
            border: none !important;
            box-shadow: none !important;
            ring: none !important;
          }
        `}</style>
        <DialogHeader>
          <DialogTitle>いいねした人</DialogTitle>
          <DialogDescription>この楽曲にいいねしたユーザー一覧</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {console.log('いいね一覧表示 - likes:', likes, 'length:', likes.length)}
          {likes.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              まだいいねがありません
            </div>
          ) : (
            likes.map((like) => (
              <div key={like.id} className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={like.users.avatar_url || undefined} />
                  <AvatarFallback>
                    {like.users.display_name?.charAt(0) || like.users.username?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Link 
                    href={`/app/friends/${like.users.id}`}
                    className="text-base font-medium text-white hover:text-blue-400 transition-colors block"
                    onClick={() => setShowLikesModal(false)}
                  >
                    {like.users.display_name || like.users.username}
                  </Link>
                  <div className="text-xs text-muted-foreground">@{like.users.username}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* コメント一覧モーダル */}
    <Dialog open={showCommentsModal} onOpenChange={setShowCommentsModal}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>コメント</DialogTitle>
          <DialogDescription>この楽曲へのコメント一覧</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {comments.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              まだコメントがありません
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={comment.users.avatar_url || undefined} />
                  <AvatarFallback>
                    {comment.users.display_name?.charAt(0) || comment.users.username?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base font-medium">{comment.users.display_name || comment.users.username}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(comment.created_at).toLocaleDateString('ja-JP', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="text-base">{comment.content}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
      
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={async () => {
          setIsLoading(true)
          try {
            await handleDelete()
            onOpenChange(false)
            setShowDeleteDialog(false)
          } catch (error) {
            console.error('Delete failed:', error)
          } finally {
            setIsLoading(false)
          }
        }}
        title="楽曲を削除"
        description="この楽曲を削除しますか？この操作は取り消せません。"
        itemName={item?.title}
        isLoading={isLoading}
      />
      
      {/* コメントモーダル */}
      {selectedItemId && (
        <CommentModal
          open={commentModalOpen}
          onOpenChange={setCommentModalOpen}
          shelfItemId={selectedItemId}
          currentUserId={user?.id}
        />
      )}
    </>
  )
}
