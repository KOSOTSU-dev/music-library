"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Play, Pause, SkipBack, SkipForward, X, ExternalLink, Trash2, Copy, Move } from "lucide-react"
import { Share2, GripVertical } from "lucide-react"
import GlobalPlayer from "@/components/GlobalPlayer"
import { signOut } from "@/lib/auth"
import { createShelf, reorderShelves } from "./actions"
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
      window.location.reload()
    } catch (error) {
      alert('棚の作成に失敗しました')
    } finally {
      setPending(false)
    }
  }

  return (
    <form action={handleSubmit} className="space-y-2">
      <input 
        name="name" 
        placeholder="新しい棚の名前" 
        className="w-full px-2 py-1 text-sm border rounded"
        required 
      />
      <input 
        name="description" 
        placeholder="説明（任意）" 
        className="w-full px-2 py-1 text-sm border rounded"
      />
      <Button type="submit" size="sm" disabled={pending} className="w-full">
        {pending ? '作成中...' : '棚を作成'}
      </Button>
    </form>
  )
}

export default function AppHome() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [currentTrack, setCurrentTrack] = useState<any>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentShelfItems, setCurrentShelfItems] = useState<any[]>([])
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0)
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }
      setUser(session.user)

      // フレンド申請数を取得
      const countResult = await getPendingFriendRequestsCount()
      setPendingFriendRequests(countResult.count)

      // 棚一覧を取得
      const { data: shelvesData } = await supabase
        .from('shelves')
        .select('*')
        .eq('user_id', session.user.id)
        .order('sort_order', { ascending: true })

      setShelves(shelvesData || [])
      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => {
    const checkPlaybackState = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.provider_token) return

      try {
        const res = await fetch('https://api.spotify.com/v1/me/player', {
          headers: { Authorization: `Bearer ${session.provider_token}` }
        })

        if (res.status === 204) {
          setIsPlaying(false)
          return
        }

        if (res.ok) {
          const text = await res.text()
          if (text) {
            const data = JSON.parse(text)
            if (data.is_playing) {
              setIsPlaying(true)
              setCurrentTrack(data.item)
            } else {
              setIsPlaying(false)
            }
          }
        }
      } catch (error) {
        console.error('Playback state check failed:', error)
      }
    }

    const interval = setInterval(checkPlaybackState, 1000)
    return () => clearInterval(interval)
  }, [])

  // カスタムイベントリスナー
  useEffect(() => {
    const onItemAdded = (e: CustomEvent) => {
      if (e.detail.shelf_id === selectedShelfId) {
        setCurrentShelfItems((currentItems) => {
          const newItems = [...currentItems, e.detail]
          return newItems
        })
      }
    }
    
    const handleTrackPlaying = (e: CustomEvent) => {
      const { id, title, artist, album, image_url, duration_ms } = e.detail
      setCurrentTrack({
        id,
        title,
        artist,
        album,
        image_url,
        duration_ms: duration_ms || 0
      })
      setIsPlaying(true)
    }

    window.addEventListener('shelf:item-added', onItemAdded)
    window.addEventListener('track:playing', handleTrackPlaying as EventListener)
    return () => {
      window.removeEventListener('shelf:item-added', onItemAdded)
      window.removeEventListener('track:playing', handleTrackPlaying as EventListener)
    }
  }, [selectedShelfId])

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white grid place-items-center p-4">
        <p>読み込み中...</p>
      </main>
    )
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
            <Link href="/app/friends?tab=mypage" className="ml-1">
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
            <h2 className="font-semibold mb-3">
              {selectedShelfId ? shelves.find(s => s.id === selectedShelfId)?.name || '棚ビュー' : '棚ビュー'}
            </h2>
            <ShelfView onShelfItemsChange={setCurrentShelfItems} currentTrack={currentTrack} />
          </section>

          {/* Right: Search */}
          <aside className="col-span-3 p-3 border rounded-lg">
            <SearchPanel />
          </aside>
        </div>
      </main>

      <GlobalPlayer currentShelfItems={currentShelfItems} onShelfItemsChange={setCurrentShelfItems} />
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
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
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
        reorderShelves(fd)
        
        return newShelves
      })
    }
  }

  return (
    <div className="space-y-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={shelves.map(shelf => shelf.id)} strategy={verticalListSortingStrategy}>
          {shelves.map((shelf) => (
            <SortableShelfItem
              key={shelf.id}
              shelf={shelf}
              isSelected={selectedShelfId === shelf.id}
              onSelect={() => {
                setSelectedShelfId(shelf.id)
                onShelfSelect(shelf.id)
              }}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
}

function SortableShelfItem({ 
  shelf, 
  isSelected, 
  onSelect 
}: { 
  shelf: Shelf
  isSelected: boolean
  onSelect: () => void
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
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-2 border rounded cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{shelf.name}</div>
          {shelf.description && (
            <div className="text-sm text-gray-500">{shelf.description}</div>
          )}
        </div>
        <GripVertical className="h-4 w-4 text-gray-400" />
      </div>
    </div>
  )
}

function ShelfView({ onShelfItemsChange, currentTrack }: { onShelfItemsChange: (items: any[]) => void, currentTrack: any }) {
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null)
  const [items, setItems] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [activeItem, setActiveItem] = useState<any>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    const handleShelfSelect = (e: CustomEvent) => {
      setSelectedShelfId(e.detail.shelfId)
    }

    window.addEventListener('shelf:selected', handleShelfSelect as EventListener)
    return () => {
      window.removeEventListener('shelf:selected', handleShelfSelect as EventListener)
    }
  }, [])

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
        image_url: item.image_url,
        spotify_id: item.spotify_id
      })))
      setItems(data || [])
      onShelfItemsChange(data || [])
    }
    load()

    const channel = supabase
      .channel('shelf_items_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shelf_items',
          filter: `shelf_id=eq.${selectedShelfId}`
        },
        (payload) => {
          console.log('新しいアイテムが追加されました:', payload)
          const newItem = payload.new
          setItems((currentItems) => {
            const newItems = [...currentItems, newItem]
            setTimeout(() => onShelfItemsChange(newItems), 0)
            return newItems
          })
        }
      )
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
    return <div className="text-sm text-muted-foreground">棚を選択してください</div>
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {items.length} 件のアイテム
      </div>
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
      />
      {items.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-8">
          この棚にはまだアイテムがありません
        </div>
      )}
    </div>
  )
}

function SortableAlbumCover({ item, isCurrentlyPlaying, onClick }: { item: any, isCurrentlyPlaying: boolean, onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`aspect-[3/4] bg-gradient-to-b from-gray-200 to-gray-300 rounded-lg cursor-pointer relative overflow-hidden ${
        isCurrentlyPlaying ? 'ring-4 ring-green-400' : ''
      }`}
      onClick={onClick}
      animate={isCurrentlyPlaying ? {
        y: [0, -8, 0],
        scale: [1, 1.05, 1],
        boxShadow: [
          '0 0 0 0 rgba(34, 197, 94, 0)',
          '0 0 0 10px rgba(34, 197, 94, 0.3)',
          '0 0 0 0 rgba(34, 197, 94, 0)'
        ]
      } : {}}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
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
      
      {/* ホバー時の再生ボタン */}
      <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 hover:opacity-100">
        <Button size="icon" variant="secondary" className="w-12 h-12 rounded-full">
          <Play className="h-6 w-6" />
        </Button>
      </div>
    </motion.div>
  )
}

function ItemDetailDialog({ open, onOpenChange, item, onDeleted }: { open: boolean, onOpenChange: (open: boolean) => void, item: any, onDeleted: () => void }) {
  const [isLoading, setIsLoading] = useState(false)

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>楽曲詳細</span>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* アルバムアート */}
          <div className="flex justify-center">
            <div className="w-48 h-48 bg-gradient-to-b from-gray-200 to-gray-300 rounded-lg overflow-hidden">
              {item.image_url ? (
                <img 
                  src={item.image_url} 
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-gray-500 text-center p-4">
                    {item.title}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 楽曲情報 */}
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">{item.title}</h3>
            <p className="text-gray-600">{item.artist}</p>
            {item.album && <p className="text-sm text-gray-500">{item.album}</p>}
          </div>

          {/* アクションボタン */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm">
              <Play className="h-4 w-4 mr-2" />
              再生
            </Button>
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Spotify
            </Button>
            <Button variant="outline" size="sm">
              <Copy className="h-4 w-4 mr-2" />
              複製
            </Button>
            <Button variant="outline" size="sm">
              <Move className="h-4 w-4 mr-2" />
              移動
            </Button>
          </div>

          {/* 削除ボタン */}
          <Button 
            variant="destructive" 
            size="sm" 
            className="w-full"
            onClick={async () => {
              if (confirm('この楽曲を削除しますか？')) {
                setIsLoading(true)
                try {
                  const fd = new FormData()
                  fd.set('itemId', item.id)
                  const { deleteShelfItem } = await import('./actions')
                  await deleteShelfItem(fd)
                  onDeleted()
                  onOpenChange(false)
                } catch (error) {
                  alert('削除に失敗しました')
                } finally {
                  setIsLoading(false)
                }
              }
            }}
            disabled={isLoading}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isLoading ? '削除中...' : '削除'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SearchPanel() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const handleSearch = async () => {
    if (!query.trim()) return

    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = (session as any)?.provider_token || (session as any)?.providerToken

      if (!accessToken) {
        alert('Spotifyにログインしてください')
        return
      }

      const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      setResults(data.tracks.items)
    } catch (error) {
      console.error('Search error:', error)
      alert('検索に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleAddToShelf = async (track: any) => {
    const event = new CustomEvent('shelf:item-added', {
      detail: {
        shelf_id: 'selected_shelf_id', // 実際の実装では選択された棚のIDを使用
        title: track.name,
        artist: track.artists.map((a: any) => a.name).join(', '),
        album: track.album.name,
        spotify_id: track.id,
        spotify_type: 'track',
        image_url: track.album.images[0]?.url,
        position: 0
      }
    })
    window.dispatchEvent(event)
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">楽曲検索</h2>
      
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="楽曲名、アーティスト名..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 px-2 py-1 text-sm border rounded"
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={loading} size="sm">
          {loading ? '検索中...' : '検索'}
        </Button>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {results.map((track) => (
          <div key={track.id} className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50">
            <img 
              src={track.album.images[0]?.url || '/placeholder-album.png'} 
              alt={track.name}
              className="w-10 h-10 rounded object-cover"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{track.name}</div>
              <div className="text-xs text-gray-500 truncate">
                {track.artists.map((a: any) => a.name).join(', ')}
              </div>
            </div>
            <Button 
              size="sm" 
              onClick={() => handleAddToShelf(track)}
              className="flex-shrink-0"
            >
              追加
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

interface Shelf {
  id: string
  name: string
  description?: string
  user_id: string
  is_public: boolean
  sort_order: number
  created_at: string
  updated_at: string
}
