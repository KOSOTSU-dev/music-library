"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Search, UserPlus, UserMinus, UserCheck, UserX, Shield, Eye, ArrowLeft, User, Camera, LogOut, Wand2 } from "lucide-react"
import { sendFriendRequest, acceptFriendRequest, rejectFriendRequest, removeFriend, searchUsers, updateProfile, getPendingFriendRequestsCount } from "@/app/app/friends-actions"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { signOut } from "@/lib/auth"
import { setupVirtualFriendRequests, clearVirtualFriendRequests } from "@/app/app/virtual-friend-setup"
import { updateVirtualFriendImages } from "@/app/app/update-virtual-friend-images"
import { addShelvesToVirtualFriends } from "@/app/app/add-shelves-to-virtual-friends"
import { fixVirtualFriendTracks } from "@/app/app/fix-virtual-friend-tracks"
import { fixFriendTracksWithSearch } from "@/app/app/fix-friend-tracks-with-search"
import { useToast } from "@/hooks/use-toast"
import GlobalPlayer from "@/components/GlobalPlayer"

interface UserType {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  is_public: boolean
}

interface Friend {
  id: string
  status: 'pending' | 'accepted' | 'blocked'
  created_at: string
  user: UserType
  friend: UserType
}

function FriendsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "friends")
  const [friends, setFriends] = useState<Friend[]>([])
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([])
  const [searchResults, setSearchResults] = useState<UserType[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [profile, setProfile] = useState<UserType | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const profileFormRef = useRef<HTMLFormElement | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const { toast } = useToast()
  const [deleteDialog, setDeleteDialog] = useState({ open: false, friendId: '', friendName: '' })

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

  // フレンド一覧を読み込み
  useEffect(() => {
    const loadFriends = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // フレンド関係を取得
      const { data } = await supabase
        .from('friends')
        .select(`
          *,
          user:users!friends_user_id_fkey(*),
          friend:users!friends_friend_id_fkey(*)
        `)
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)

      if (data) {
        const friendsList = data.filter(f => f.status === 'accepted')
        const pendingList = data.filter(f => f.status === 'pending')
        
        setFriends(friendsList)
        setPendingRequests(pendingList)
        
        // フレンド申請数を更新
        const pendingCountResult = await getPendingFriendRequestsCount()
        setPendingCount(pendingCountResult.count)
      }
    }

    loadFriends()
  }, [])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    const formData = new FormData()
    formData.set('query', searchQuery)

    try {
      const result = await searchUsers(formData)
      if (result.error) {
        toast({
          title: "エラー",
          description: result.error,
          variant: "destructive"
        })
      } else {
        setSearchResults(result.users || [])
      }
    } catch (error) {
      toast({
        title: "エラー",
        description: "検索に失敗しました",
        variant: "destructive"
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handleSendFriendRequest = async (friendId: string) => {
    setIsLoading(true)
    const formData = new FormData()
    formData.set('friendId', friendId)

    try {
      const result = await sendFriendRequest(formData)
      if (result.error) {
        toast({
          title: "エラー",
          description: result.error,
          variant: "destructive"
        })
      } else {
        toast({
          title: "成功",
          description: "フレンド申請を送信しました"
        })
      }
    } catch (error) {
      toast({
        title: "エラー",
        description: "フレンド申請に失敗しました",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAcceptRequest = async (friendId: string) => {
    setIsLoading(true)
    const formData = new FormData()
    formData.set('friendId', friendId)

    try {
      const result = await acceptFriendRequest(formData)
      if (result.error) {
        toast({
          title: "エラー",
          description: result.error,
          variant: "destructive"
        })
      } else {
        toast({
          title: "成功",
          description: "フレンド申請を承認しました"
        })
        // リストを即時更新（楽観的更新）
        setPendingRequests(prev => prev.filter(req => {
          const requesterId = req.user.id === profile?.id ? req.friend.id : req.user.id
          return requesterId !== friendId
        }))

        // 承認した相手をフレンド一覧へ追加
        setFriends(prev => {
          const req = pendingRequests.find(r => {
            const requesterId = r.user.id === profile?.id ? r.friend.id : r.user.id
            return requesterId === friendId
          })
          if (!req) return prev
          const friendUser = req.user.id === profile?.id ? req.friend : req.user
          const meUser = req.user.id === profile?.id ? req.user : req.friend
          const newFriend: Friend = {
            id: req.id,
            status: 'accepted',
            created_at: new Date().toISOString(),
            user: meUser,
            friend: friendUser,
          }
          // 重複を避ける
          const exists = prev.some(f => (f.user.id === newFriend.user.id && f.friend.id === newFriend.friend.id) || (f.user.id === newFriend.friend.id && f.friend.id === newFriend.user.id))
          return exists ? prev : [...prev, newFriend]
        })

        // 通知数を更新
        setPendingCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      toast({
        title: "エラー",
        description: "承認に失敗しました",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRejectRequest = async (friendId: string) => {
    setIsLoading(true)
    const formData = new FormData()
    formData.set('friendId', friendId)

    try {
      const result = await rejectFriendRequest(formData)
      if (result.error) {
        toast({
          title: "エラー",
          description: result.error,
          variant: "destructive"
        })
      } else {
        toast({
          title: "成功",
          description: "フレンド申請を拒否しました"
        })
        // リストを更新
        setPendingRequests(prev => prev.filter(f => f.friend.id !== friendId))
      }
    } catch (error) {
      toast({
        title: "エラー",
        description: "拒否に失敗しました",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveFriend = async (friendId: string) => {
    setIsLoading(true)
    const formData = new FormData()
    formData.set('friendId', friendId)

    try {
      const result = await removeFriend(formData)
      if (result.error) {
        toast({
          title: "エラー",
          description: result.error,
          variant: "destructive"
        })
      } else {
        toast({
          title: "成功",
          description: "フレンドを削除しました"
        })
        // リストを更新
        setFriends(prev => prev.filter(f => f.friend.id !== friendId && f.user.id !== friendId))
      }
    } catch (error) {
      toast({
        title: "エラー",
        description: "削除に失敗しました",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteClick = (friendId: string, friendName: string) => {
    setDeleteDialog({ open: true, friendId, friendName })
  }

  const handleDeleteConfirm = async () => {
    await handleRemoveFriend(deleteDialog.friendId)
    setDeleteDialog({ open: false, friendId: '', friendName: '' })
  }

  const handleGalleryClick = async (userId: string, username: string) => {
    console.log('ギャラリーボタンクリック:', { userId, username })
    
    // 仮想フレンドかどうかをチェック
    const isVirtualFriend = username.startsWith('virtual_')
    console.log('仮想フレンド判定:', { isVirtualFriend, username })
    
    if (isVirtualFriend) {
      // 仮想フレンドの場合はSpotify認証をチェック
      const { data: { session } } = await supabase.auth.getSession()
      const spotifyToken = session?.provider_token
      console.log('Spotify認証状態:', { hasToken: !!spotifyToken, session: !!session })
      
      if (!spotifyToken) {
        console.log('Spotify認証が切れています - トーストを表示')
        toast({
          title: 'Spotifyに再ログインしてください',
          description: '仮想フレンドのギャラリーを閲覧するにはSpotify認証が必要です',
          variant: 'destructive'
        })
        return
      }
    }
    
    console.log('ギャラリーに遷移します')
    // 認証OKまたは仮想フレンド以外の場合はギャラリーに遷移
    window.location.href = `/app/friends/${userId}/shelf/first`
  }

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!profile) return

    setIsLoading(true)
    const formData = new FormData(e.currentTarget)

    try {
      const result = await updateProfile(formData)
      if (result.error) {
        toast({
          title: "エラー",
          description: result.error,
          variant: "destructive"
        })
      } else {
        // ホームの右上アイコンへ即時反映
        if ((result as any).avatarUrl) {
          try {
            window.dispatchEvent(new CustomEvent('user:avatar-updated', { detail: { avatar_url: (result as any).avatarUrl } }))
          } catch {}
        }
        toast({
          title: "成功",
          description: "プロフィールを更新しました"
        })
        // プロフィールを再読み込み
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single()
          setProfile(data)
        }
      }
    } catch (error) {
      toast({
        title: "エラー",
        description: "更新に失敗しました",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAvatarClick = () => {
    if (avatarInputRef.current) {
      avatarInputRef.current.click()
    }
  }

  const handleSetupVirtualFriends = async () => {
    setIsLoading(true)
    try {
      // まず既存の仮想フレンド申請をクリア
      await clearVirtualFriendRequests()
      
      const { success, message, error } = await setupVirtualFriendRequests()
      if (error) {
        toast({
          title: "エラー",
          description: error,
          variant: "destructive"
        })
      } else {
        toast({
          title: "成功",
          description: message || "仮想フレンド申請をセットアップしました"
        })
        // 申請リストを再読み込み
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data } = await supabase
            .from('friends')
            .select(`
              *,
              user:users!friends_user_id_fkey(*),
              friend:users!friends_friend_id_fkey(*)
            `)
            .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
          if (data) {
            const pendingList = data.filter(f => f.status === 'pending' && f.friend_id === user.id)
            setPendingRequests(pendingList)
            
            // フレンド申請数を更新
            const pendingCountResult = await getPendingFriendRequestsCount()
            setPendingCount(pendingCountResult.count)
          }
        }
      }
    } catch (error) {
      toast({
        title: "エラー",
        description: "仮想フレンド申請のセットアップに失敗しました",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateVirtualFriendImages = async () => {
    console.log('画像URL更新ボタンがクリックされました')
    setIsLoading(true)
    try {
      console.log('updateVirtualFriendImages を呼び出します')
      const result = await updateVirtualFriendImages()
      console.log('updateVirtualFriendImages の結果:', result)
      
      if (result.error) {
        console.error('画像URL更新エラー:', result.error)
        toast({
          title: "エラー",
          description: result.error,
          variant: "destructive"
        })
      } else {
        console.log('画像URL更新成功:', result.message)
        console.log('トースト表示開始')
        toast({
          title: "成功",
          description: result.message || "仮想フレンドの画像URLを更新しました"
        })
        console.log('トースト表示完了')
      }
    } catch (error) {
      console.error('画像URL更新例外:', error)
      toast({
        title: "エラー",
        description: "画像URL更新に失敗しました",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddShelvesToVirtualFriends = async () => {
    console.log('棚追加ボタンがクリックされました')
    setIsLoading(true)
    try {
      console.log('addShelvesToVirtualFriends を呼び出します')
      const result = await addShelvesToVirtualFriends()
      console.log('addShelvesToVirtualFriends の結果:', result)
      
      if (result.error) {
        console.error('棚追加エラー:', result.error)
        toast({
          title: "エラー",
          description: result.error,
          variant: "destructive"
        })
      } else {
        console.log('棚追加成功:', result.message)
        toast({
          title: "成功",
          description: result.message || "仮想フレンドに追加の棚を作成しました"
        })
      }
    } catch (error) {
      console.error('棚追加例外:', error)
      toast({
        title: "エラー",
        description: "棚追加に失敗しました",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleFixVirtualFriendTracks = async () => {
    console.log('楽曲修正ボタンがクリックされました')
    setIsLoading(true)
    try {
      console.log('fixVirtualFriendTracks を呼び出します')
      const result = await fixVirtualFriendTracks()
      console.log('fixVirtualFriendTracks の結果:', result)
      
      if (result.error) {
        console.error('楽曲修正エラー:', result.error)
        toast({
          title: "エラー",
          description: result.error,
          variant: "destructive"
        })
      } else {
        console.log('楽曲修正成功:', result.message)
        toast({
          title: "成功",
          description: result.message || "仮想フレンドの楽曲データを修正しました"
        })
      }
    } catch (error) {
      console.error('楽曲修正例外:', error)
      toast({
        title: "エラー",
        description: "楽曲修正に失敗しました",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleFixFriendTracksWithSearch = async () => {
    console.log('楽曲検索修正ボタンがクリックされました')
    setIsLoading(true)
    try {
      console.log('fixFriendTracksWithSearch を呼び出します')
      const result = await fixFriendTracksWithSearch()
      console.log('fixFriendTracksWithSearch の結果:', result)
      
      if (result.error) {
        console.error('楽曲検索修正エラー:', result.error)
        toast({
          title: "エラー",
          description: result.error,
          variant: "destructive"
        })
      } else {
        console.log('楽曲検索修正成功:', result.message)
        toast({
          title: "成功",
          description: result.message || "楽曲情報を正しく修正しました"
        })
      }
    } catch (error) {
      console.error('楽曲検索修正例外:', error)
      toast({
        title: "エラー",
        description: "楽曲検索修正に失敗しました",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-black">
      <div className="max-w-4xl mx-auto p-6 pb-24 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="sm" className="bg-[#666666] text-white border-[#666666] hover:bg-[#4d4d4d] hover:text-white">
            <Link href="/app">
              <ArrowLeft className="h-4 w-4 mr-2" />
              ホームに戻る
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-white">フレンド</h1>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-[#1a1a1a] p-1 text-white">
          <TabsTrigger value="friends" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#333333] data-[state=active]:text-white data-[state=active]:shadow-sm hover:bg-[#333333] hover:text-white text-white w-auto">
            フレンド
          </TabsTrigger>
          <TabsTrigger value="requests" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#333333] data-[state=active]:text-white data-[state=active]:shadow-sm hover:bg-[#333333] hover:text-white text-white w-auto">
            申請
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="mypage" className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[#333333] data-[state=active]:text-white data-[state=active]:shadow-sm hover:bg-[#333333] hover:text-white text-white w-auto">
            マイページ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="space-y-4">
          {/* 検索フォーム */}
          <Card className="bg-[#1a1a1a] border-[#333333]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Search className="h-5 w-5" />
                ユーザー検索
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="ユーザー名で検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="bg-black border-[#333333] text-white placeholder:text-[#999999] focus:border-[#4d4d4d]"
                />
                <Button onClick={handleSearch} disabled={isSearching} className="bg-[#666666] text-white hover:bg-[#4d4d4d]">
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h3 className="font-medium text-white">検索結果</h3>
                  <div className="grid gap-2">
                    {searchResults.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-3 border border-[#333333] rounded-lg bg-[#1a1a1a]">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback>{user.display_name[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-white">{user.display_name}</div>
                            <div className="text-sm text-muted-foreground">@{user.username}</div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendFriendRequest(user.id)}
                          disabled={isLoading}
                          className="bg-[#666666] text-white border-[#666666] hover:bg-[#4d4d4d] hover:text-white"
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          申請
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#1a1a1a] border-[#333333]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <UserCheck className="h-5 w-5" />
                フレンド一覧 ({friends.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {friends.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  フレンドがいません。検索タブでユーザーを見つけてフレンド申請を送信しましょう。
                </p>
              ) : (
                <div className="grid gap-4">
                  {friends.map((friend) => {
                    const friendUser = friend.user.id === profile?.id ? friend.friend : friend.user
                    return (
                      <div key={friend.id} className="flex items-center justify-between p-4 border border-[#333333] rounded-lg bg-[#1a1a1a]">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={friendUser.avatar_url || undefined} />
                            <AvatarFallback>{friendUser.display_name[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-white">{friendUser.display_name}</div>
                            <div className="text-sm text-muted-foreground">@{friendUser.username}</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleGalleryClick(friendUser.id, friendUser.username)}
                            className="bg-[#666666] text-white border-[#666666] hover:bg-[#4d4d4d] hover:text-[#e6e6e6]"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            ギャラリー
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteClick(friendUser.id, friendUser.display_name || friendUser.username)}
                            disabled={isLoading}
                            className="bg-[#666666] text-white border-[#666666] hover:bg-[#4d4d4d] hover:text-[#e6e6e6]"
                          >
                            <UserMinus className="h-4 w-4 mr-2" />
                            削除
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card className="bg-[#1a1a1a] border-[#333333]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <UserPlus className="h-5 w-5" />
                フレンド申請 ({pendingRequests.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingRequests.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    新しいフレンド申請はありません。
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button 
                      onClick={handleSetupVirtualFriends} 
                      disabled={isLoading}
                      variant="outline"
                      className="bg-[#666666] text-white border-[#666666] hover:bg-[#4d4d4d] hover:text-white"
                    >
                      <Wand2 className="h-4 w-4 mr-2" />
                      仮想フレンド申請を作成
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4">
                  {pendingRequests.map((request) => {
                    const requester = request.user.id === profile?.id ? request.friend : request.user
                    return (
                      <div key={request.id} className="flex items-center justify-between p-4 border border-[#333333] rounded-lg bg-[#1a1a1a]">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={requester.avatar_url || undefined} />
                            <AvatarFallback>{requester.display_name[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-white">{requester.display_name}</div>
                            <div className="text-sm text-muted-foreground">@{requester.username}</div>
                            <Badge variant="secondary">申請中</Badge>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAcceptRequest(requester.id)}
                            disabled={isLoading}
                            className="bg-[#666666] text-white border-[#666666] hover:bg-[#4d4d4d] hover:text-white"
                          >
                            <UserCheck className="h-4 w-4 mr-2" />
                            承認
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRejectRequest(requester.id)}
                            disabled={isLoading}
                            className="bg-[#666666] text-white border-[#666666] hover:bg-[#4d4d4d] hover:text-white"
                          >
                            <UserX className="h-4 w-4 mr-2" />
                            拒否
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mypage" className="space-y-4">
          <Card className="bg-[#1a1a1a] border-[#333333]">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <User className="h-5 w-5" />
                  マイページ
                </div>
                <form action={signOut}>
                  <Button type="submit" variant="outline" size="sm" className="bg-[#666666] text-white border-[#666666] hover:bg-[#4d4d4d]">
                    <LogOut className="h-4 w-4 mr-2" />
                    ログアウト
                  </Button>
                </form>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profile && (
                <form ref={profileFormRef} onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                        <Avatar className="h-16 w-16 transition-all duration-200 group-hover:scale-105">
                          <AvatarImage src={profile.avatar_url ? `${profile.avatar_url}?v=${Date.now()}` : undefined} />
                          <AvatarFallback>{profile.display_name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <Camera className="h-6 w-6 text-white" />
                        </div>
                      </div>
                      <div>
                        <div className="font-medium text-white">{profile.display_name}</div>
                        <div className="text-sm text-muted-foreground">@{profile.username}</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* 隠しファイル入力 */}
                  <input
                    ref={(el) => { avatarInputRef.current = el }}
                    name="avatar"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.currentTarget.files && e.currentTarget.files[0]
                      if (file) {
                        // 自動送信してすぐ反映
                        profileFormRef.current?.requestSubmit()
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    アバター画像をクリックして変更できます。JPG、PNG、GIF形式に対応（最大5MB）
                  </p>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">表示名</label>
                    <Input
                      name="displayName"
                      defaultValue={profile.display_name}
                      placeholder="表示名を入力（空欄可）"
                      className="bg-black border-[#333333] text-white placeholder:text-[#999999] focus:border-[#4d4d4d]"
                    />
                    <p className="text-xs text-muted-foreground">
                      他のユーザーに表示される名前です。空欄の場合はユーザー名が表示されます。
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">ユーザー名</label>
                    <Input
                      name="username"
                      defaultValue={profile.username}
                      required
                      placeholder="ユーザー名を入力"
                      className="bg-black border-[#333333] text-white placeholder:text-[#999999] focus:border-[#4d4d4d]"
                    />
                    <p className="text-xs text-muted-foreground">
                      3-20文字で入力してください。他のユーザーが検索で見つける際に使用されます。
                    </p>
                  </div>

                  
                  <Button type="submit" disabled={isLoading} className="w-full bg-[#666666] text-white hover:bg-[#4d4d4d]">
                    {isLoading ? "更新中..." : "プロフィールを更新"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
      </div>
      <GlobalPlayer currentShelfItems={[]} />
      
      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        onConfirm={handleDeleteConfirm}
        title="フレンドを削除"
        description="このフレンドを削除しますか？この操作は取り消せません。"
        itemName={deleteDialog.friendName}
      />
    </div>
  )
}

export default function FriendsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white grid place-items-center p-4">読み込み中...</div>}>
      <FriendsPageContent />
    </Suspense>
  )
}
