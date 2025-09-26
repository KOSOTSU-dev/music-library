"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight } from "lucide-react"
import { Share2, GripVertical, MessageCircle, Trash2, ExternalLink, Copy, StickyNote, Heart, Link as LinkIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import GlobalPlayer from "@/components/GlobalPlayer"
import { useGlobalPlayer } from "@/hooks/useGlobalPlayer"
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
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function ShelfCreateForm() {
  const [pending, setPending] = useState(false)
  
  const handleSubmit = async (formData: FormData) => {
    setPending(true)
    try {
      const res = await createShelf(formData) as any
      if (res?.error) {
        alert(res.error)
        return
      }
      if (res?.shelf) {
        const shelf = res.shelf as { id: string; name: string }
        const addEvent = new CustomEvent('shelf:added', { detail: shelf })
        window.dispatchEvent(addEvent)
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <form action={handleSubmit} className="mt-4 flex gap-2">
      <input name="name" placeholder="新しい棚名" className="flex-1 border rounded px-2 py-1 text-base" />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? '作成中...' : '作成'}
      </Button>
    </form>
  )
}

export default function AppHome() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [currentShelfItems, setCurrentShelfItems] = useState<any[]>([])
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0)
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null)
  const router = useRouter()
  const { currentTrack, setCurrentShelfItems: setGlobalShelfItems } = useGlobalPlayer()

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/')
        return
      }
      setUser(session.user)
      setLoading(false)
      
      // フレンド申請数を取得
      const pendingCount = await getPendingFriendRequestsCount()
      setPendingFriendRequests(pendingCount.count)
    }
    init()
  }, [router])


  if (loading) {
    return (
      <main className="p-8">
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
    <div className="relative min-h-screen">
      <main className="p-4 pb-24">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Music Library</h1>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="relative">
              <Link href="/app/friends">
                フレンド
                {pendingFriendRequests > 0 && (
                  <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs">
                    {pendingFriendRequests}
                  </Badge>
                )}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/app/settings">設定</Link>
            </Button>
            <Link href="/app/friends?tab=mypage" className="ml-0.75">
              <Avatar className="h-10 w-10 cursor-pointer transition-all duration-200 hover:scale-110 hover:shadow-lg hover:ring-2 hover:ring-blue-400 hover:ring-opacity-50">
                <AvatarImage src={user?.user_metadata?.picture || user?.user_metadata?.avatar_url} />
                <AvatarFallback>
                  {user?.user_metadata?.full_name?.[0] || user?.email?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Left: Shelves */}
          <aside className="col-span-3 p-3 border rounded-lg">
            <h2 className="font-semibold mb-3">棚</h2>
            <ShelfList 
              shelves={shelves}
              setShelves={setShelves}
              selectedShelfId={selectedShelfId}
              setSelectedShelfId={setSelectedShelfId}
              onShelfSelect={(id) => {
                const event = new CustomEvent('shelf:selected', { detail: { shelfId: id } })
                window.dispatchEvent(event)
              }} 
            />
            <ShelfCreateForm />
          </aside>

          {/* Center: Shelf View */}
          <section className="col-span-6 p-3 border rounded-lg min-h-[300px]">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <span>{selectedShelfId ? shelves.find(s => s.id === selectedShelfId)?.name || '棚ビュー' : '棚ビュー'}</span>
              <span className="text-sm text-muted-foreground">{currentShelfItems.length} 件のアイテム</span>
            </h2>
            <ShelfView onShelfItemsChange={setCurrentShelfItems} currentTrack={currentTrack} />
          </section>

          {/* Right: Search */}
          <aside className="col-span-3 p-3 border rounded-lg min-h-[300px]">
            <h2 className="font-semibold mb-3">検索</h2>
            <SearchPanel />
          </aside>
        </div>
      </main>

      <GlobalPlayer currentShelfItems={currentShelfItems} onShelfItemsChange={setGlobalShelfItems} />
    </div>
  )
}

function ShelfList({ 
  shelves, 
  setShelves, 
  selectedShelfId, 
  setSelectedShelfId, 
  onShelfSelect 
}: { 
  shelves: Shelf[]
  setShelves: (shelves: Shelf[]) => void
  selectedShelfId: string | null
  setSelectedShelfId: (id: string | null) => void
  onShelfSelect: (id: string) => void 
}) {

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
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
  }, [selectedShelfId, onShelfSelect])

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (active.id !== over?.id) {
      setShelves((shelves) => {
        const oldIndex = shelves.findIndex((shelf) => shelf.id === active.id)
        const newIndex = shelves.findIndex((shelf) => shelf.id === over?.id)
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={shelves.map(shelf => shelf.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-1">
          {shelves.map((shelf) => (
            <SortableShelfItem
              key={shelf.id}
              shelf={shelf}
              isSelected={selectedShelfId === shelf.id}
              onSelect={() => {
                setSelectedShelfId(shelf.id)
                onShelfSelect(shelf.id)
              }}
              onDelete={async () => {
                const fd = new FormData()
                fd.set('id', shelf.id)
                const { deleteShelf } = await import('./actions')
                await deleteShelf(fd)
                setShelves((prev) => prev.filter((s) => s.id !== shelf.id))
              }}
            />
          ))}
        {shelves.length === 0 && (
          <li className="text-xs text-muted-foreground">まだ棚がありません</li>
        )}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function SortableShelfItem({ 
  shelf, 
  isSelected, 
  onSelect, 
  onDelete 
}: { 
  shelf: { id: string; name: string; sort_order: number }
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: shelf.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <li 
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between text-base px-2 py-1 rounded hover:bg-muted cursor-grab active:cursor-grabbing ${isSelected ? 'bg-muted' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center gap-2 flex-1" onClick={onSelect}>
        <span className="flex-1">{shelf.name}</span>
      </div>
      <form
        onClick={(e) => e.stopPropagation()}
        action={async () => {
          if (!confirm('この棚を削除しますか？この操作は取り消せません。')) return
          onDelete()
        }}
      >
        <Button type="submit" size="sm" variant="ghost" className="h-6 px-2 text-red-500">
          削除
        </Button>
      </form>
    </li>
  )
}

function SearchPanel() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<any[]>([])
  const [adding, setAdding] = useState<string | null>(null)
  const [shelves, setShelves] = useState<Array<{ id: string; name: string }>>([])
  const [selectedShelfId, setSelectedShelfId] = useState<string>("")

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('shelves')
        .select('id, name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
      setShelves(data || [])
      if (data?.[0]) setSelectedShelfId(data[0].id)
    }
    load()
  }, [])

  async function onSearch(e: React.FormEvent) {
    e.preventDefault()
    const token = await (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      return session?.provider_token
    })()
    if (!token || !query) return

    const params = new URLSearchParams({ q: query, type: 'track', limit: '10' })
    const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
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
  }

  async function addToShelf(r: any) {
    setAdding(r.id)
    if (!selectedShelfId) { setAdding(null); return }
    const fd = new FormData()
    fd.set('shelfId', selectedShelfId)
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
        detail: { ...res.item, shelf_id: selectedShelfId } 
      }))
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onSearch} className="space-y-2">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="キーワードを検索"
            className="flex-1 border rounded px-2 py-1 text-base"
          />
          <Button type="submit" size="sm">検索</Button>
        </div>
        <select
          value={selectedShelfId}
          onChange={(e) => setSelectedShelfId(e.target.value)}
          className="w-full border rounded px-2 py-1 text-base"
        >
          <option value="">棚を選択</option>
          {shelves.map((shelf) => (
            <option key={shelf.id} value={shelf.id}>{shelf.name}</option>
          ))}
        </select>
      </form>

      <ul className="space-y-2 max-h-[420px] overflow-auto">
        {results.map((r) => (
          <li key={r.id} className="flex items-center gap-2 border rounded p-2">
            {r.image ? <img src={r.image} alt="" className="h-10 w-10 rounded object-cover" /> : <div className="h-10 w-10 bg-muted rounded" />}
            <div className="flex-1 min-w-0">
              <div className="truncate text-base font-medium">{r.name}</div>
              <div className="truncate text-xs text-muted-foreground">{r.artists}</div>
            </div>
            <Button size="sm" onClick={() => addToShelf(r)} disabled={adding === r.id || !selectedShelfId}>
              {adding === r.id ? '追加中...' : '棚に追加'}
            </Button>
          </li>
        ))}
        {!results.length && (
          <li className="text-xs text-muted-foreground">検索結果はまだありません</li>
        )}
      </ul>
    </div>
  )
}

function ShelfView({ onShelfItemsChange, currentTrack }: { onShelfItemsChange: (items: any[]) => void, currentTrack?: any }) {
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {items.map((item) => {
              const isCurrentlyPlaying = currentTrack && 
                `spotify:${item.spotify_type}:${item.spotify_id}` === currentTrack.uri
              return (
                <div key={item.id} className="relative">
                  <SortableAlbumCover 
                    item={item} 
                    isCurrentlyPlaying={isCurrentlyPlaying}
                    onClick={() => { setActiveItem(item); setOpen(true) }} 
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
      />
      
      {items.length === 0 && (
        <div className="text-base text-muted-foreground text-center py-8">
          この棚にはまだアイテムがありません
        </div>
      )}
    </div>
  )
}

function SortableAlbumCover({ item, onClick, isCurrentlyPlaying }: { item: any, onClick?: () => void, isCurrentlyPlaying?: boolean }) {
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
        className={`relative aspect-[3/4] bg-gradient-to-b from-gray-200 to-gray-300 rounded-lg shadow-md transform transition-all duration-200 ${
          isDragging 
            ? 'scale-110 rotate-2 shadow-2xl' 
            : isOver 
              ? 'scale-105 rotate-1' 
              : 'group-hover:scale-105 group-hover:rotate-1 group-hover:brightness-75'
        }`}
        animate={isCurrentlyPlaying ? {
          y: [-12, 12, -12],
          scale: [1, 1.08, 1],
          boxShadow: [
            '0 8px 25px rgba(0, 0, 0, 0.4)',
            '0 20px 45px rgba(0, 0, 0, 0.6)',
            '0 8px 25px rgba(0, 0, 0, 0.4)'
          ]
        } : {
          y: 0,
          scale: 1,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
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
        {/* 波紋エフェクト */}
        {isCurrentlyPlaying && (
          <>
            <motion.div
              className="absolute inset-0 rounded-lg border-2 border-black opacity-60"
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.6, 0.2, 0.6]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0
              }}
            />
            <motion.div
              className="absolute inset-0 rounded-lg border-2 border-black opacity-40"
              animate={{
                scale: [1, 1.15, 1],
                opacity: [0.4, 0.1, 0.4]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5
              }}
            />
            <motion.div
              className="absolute inset-0 rounded-lg border-2 border-black opacity-20"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.2, 0.05, 0.2]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1
              }}
            />
          </>
        )}
        {item.image_url ? (
          <img 
            src={item.image_url} 
            alt={item.title}
            className="w-full h-full object-cover rounded-lg"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-gray-200 to-gray-300 rounded-lg flex items-center justify-center">
            <div className="text-gray-500 text-xs text-center p-2">
              {item.title}
            </div>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-white text-black px-2 py-1 rounded-b-lg">
          <div className="text-xs font-medium truncate">{item.title}</div>
          <div className="text-xs text-muted-foreground truncate">{item.artist}</div>
        </div>
      </motion.div>
    </div>
  )
}

function ItemDetailDialog({ open, onOpenChange, item, onDeleted, shelfItems, onItemChange }: { open: boolean, onOpenChange: (v:boolean)=>void, item: any | null, onDeleted: () => void, shelfItems: any[], onItemChange: (item: any) => void }) {
  // Hooks must be called unconditionally and in the same order
  const [isLoading, setIsLoading] = useState(false)
  const [memo, setMemo] = useState("")
  const [isMemoOpen, setIsMemoOpen] = useState(false)
  const [isMemoLoading, setIsMemoLoading] = useState(false)
  const [showLikesModal, setShowLikesModal] = useState(false)
  const [showCommentsModal, setShowCommentsModal] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)
  const [likes, setLikes] = useState<any[]>([])
  const [comments, setComments] = useState<any[]>([])
  const [isLoadingCounts, setIsLoadingCounts] = useState(false)

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
      loadCounts()
    }
  }, [item])

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
      if (result.likes) {
        setLikes(result.likes)
      }
    } catch (error) {
      console.error('Failed to load likes:', error)
    }
  }

  const handleShowComments = async () => {
    if (!item) return
    
    setShowCommentsModal(true)
    try {
      const result = await getComments(item.id)
      if (result.comments) {
        setComments(result.comments)
      }
    } catch (error) {
      console.error('Failed to load comments:', error)
    }
  }

  if (!item) return null
  async function handleDelete() {
    if (!confirm('この曲を削除しますか？この操作は取り消せません。')) return
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
  async function handlePlay() {
    setIsLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.provider_token
      if (!token) {
        alert('Spotify認証が必要です')
        return
      }
      // アクティブデバイスが無いと404が返るため、デバイスを確認して必要なら転送を試みる
      const devRes = await fetch('https://api.spotify.com/v1/me/player/devices', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const devJson = await devRes.json()
      const devices = (devJson?.devices || []) as Array<{ id: string; is_active: boolean }>
      if (!devices.length) {
        alert('再生可能なSpotifyデバイスが見つかりません。Spotifyアプリを起動してください。')
      } else if (!devices.some(d => d.is_active)) {
        const target = devices[0]
        await fetch('https://api.spotify.com/v1/me/player', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_ids: [target.id], play: false })
        })
      }
      
      // トラックの場合はuris、アルバム/プレイリストの場合はcontext_uriを使用
      const isTrack = item.spotify_type === 'track'
      const body = isTrack 
        ? { uris: [`spotify:track:${item.spotify_id}`] }
        : { context_uri: `spotify:${item.spotify_type}:${item.spotify_id}` }
      
      const response = await fetch(`https://api.spotify.com/v1/me/player/play`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      
      if (!response.ok) {
        const error = await response.text()
        console.error('Play error:', error)
        alert('再生に失敗しました')
      }
    } catch (error) {
      console.error('Play error:', error)
      alert('再生に失敗しました')
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
        alert('Spotify認証が必要です')
        return
      }
      
      const response = await fetch(`https://api.spotify.com/v1/me/player/pause`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })
      
      if (!response.ok) {
        const error = await response.text()
        console.error('Pause error:', error)
        alert('一時停止に失敗しました')
      }
    } catch (error) {
      console.error('Pause error:', error)
      alert('一時停止に失敗しました')
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
    if (memo.length > 20) {
      alert("メモは20文字以内で入力してください")
      return
    }

    setIsMemoLoading(true)
    const fd = new FormData()
    fd.set('itemId', item.id)
    fd.set('memo', memo)
    
    const res = await updateShelfItemMemo(fd)
    setIsMemoLoading(false)
    
    if (res?.error) {
      alert(res.error)
    } else {
      setIsMemoOpen(false)
      // Update the item with the new memo
      item.memo = memo
    }
  }
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[520px] pb-3">
          <div className="relative">
            <DialogHeader>
              <DialogTitle className="flex-1 min-w-0">{item.title}</DialogTitle>
            </DialogHeader>
            <div className="flex gap-4">
              {item.image_url ? (
                <img src={item.image_url} alt="" className="w-40 h-40 object-cover rounded" />
              ) : (
                <div className="w-40 h-40 rounded bg-muted" />
              )}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-base text-muted-foreground">アーティスト</div>
                    <div className="text-base truncate">{item.artist}</div>
                  </div>
                  <div className="flex items-center gap-3 -mt-1">
                    <button
                      onClick={handleShowLikes}
                      className="flex items-center gap-1 text-base text-muted-foreground hover:text-foreground transition-colors"
                      disabled={isLoadingCounts}
                    >
                      <Heart className="h-5 w-5" />
                      <span>{likeCount}</span>
                    </button>
                    <button
                      onClick={handleShowComments}
                      className="flex items-center gap-1 text-base text-muted-foreground hover:text-foreground transition-colors"
                      disabled={isLoadingCounts}
                    >
                      <MessageCircle className="h-5 w-5" />
                      <span>{commentCount}</span>
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
                    <div className="text-base text-black underline">{item.memo}</div>
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
          {!isMemoOpen && <hr className="border-gray-200 -mb-2" />}
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
              onClick={handleDelete}
              aria-label="削除"
            >
              <span className="flex items-center justify-center text-red-600 ml-0.75">
                <Trash2 className="h-5 w-5" />
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
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>いいねした人</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-60 overflow-y-auto">
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
                  <div className="text-base font-medium">{like.users.display_name || like.users.username}</div>
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
    </>
  )
}
