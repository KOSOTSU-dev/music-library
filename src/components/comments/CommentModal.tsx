'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Heart, MessageCircle, Trash2, Send } from 'lucide-react'
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Comment {
  id: string
  content: string
  created_at: string
  user: {
    id: string
    display_name: string
    avatar_url: string | null
  }
  likes_count: number
  user_liked: boolean
}

interface CommentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shelfItemId: string
  currentUserId: string | null
}

export default function CommentModal({ open, onOpenChange, shelfItemId, currentUserId }: CommentModalProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [lastEnterTime, setLastEnterTime] = useState(0)
  const [me, setMe] = useState<{ display_name: string; avatar_url: string | null } | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const loadProfile = async () => {
      if (!currentUserId) return
      try {
        const { data } = await supabase
          .from('users')
          .select('display_name, avatar_url')
          .eq('id', currentUserId)
          .single()
        if (data) setMe({ display_name: data.display_name, avatar_url: data.avatar_url })
      } catch {}
    }
    loadProfile()
  }, [currentUserId])

  // コメントを取得
  const fetchComments = async () => {
    try {
      console.log('コメント取得開始:', { shelfItemId })
      
      // まずコメントを取得（ユーザー結合は別クエリで解決）
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .eq('shelf_item_id', shelfItemId)
        .order('likes_count', { ascending: false })
        .order('created_at', { ascending: false })

      console.log('コメント取得結果:', { commentsData, commentsError })

      if (commentsError) {
        console.error('コメント取得エラー:', commentsError)
        return
      }

      if (!commentsData) {
        console.log('コメントデータがnullです')
        return
      }

      console.log('取得したコメント数:', commentsData.length)

      // 空配列の場合は、既存のコメントを保持
      if (commentsData.length === 0) {
        console.log('コメントデータが空です。既存のコメントを保持します。')
        return
      }

      // ユーザー情報をまとめて取得
      const userIds = Array.from(new Set(commentsData.map(c => c.user_id)))
      let profiles: Record<string, { display_name: string; avatar_url: string | null }> = {}
      if (userIds.length) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, display_name, avatar_url')
          .in('id', userIds)
        if (usersData) {
          for (const u of usersData) profiles[u.id] = { display_name: u.display_name, avatar_url: u.avatar_url }
        }
      }

      const withUser = commentsData.map((c: any) => ({
        ...c,
        user: {
          id: c.user_id,
          display_name: profiles[c.user_id]?.display_name || 'ユーザー',
          avatar_url: profiles[c.user_id]?.avatar_url || null
        }
      }))

      // 各コメントのいいね状態を取得（comment_likesテーブルが存在しない場合はスキップ）
      const commentsWithLikes = await Promise.all(
        withUser.map(async (comment) => {
          try {
            const { data: likesData } = await supabase
              .from('comment_likes')
              .select('user_id')
              .eq('comment_id', comment.id)

            return {
              ...comment,
              user_liked: likesData?.some(like => like.user_id === currentUserId) || false
            }
          } catch (error) {
            // comment_likesテーブルが存在しない場合はデフォルト値を使用
            console.log('comment_likesテーブルが存在しません:', error)
            return {
              ...comment,
              user_liked: false
            }
          }
        })
      )

      setComments(commentsWithLikes)
    } catch (error) {
      console.error('コメント取得エラー:', error)
    }
  }

  // コメントを投稿
  const handleSubmitComment = async () => {
    if (!newComment.trim() || !currentUserId) return

    setLoading(true)
    try {
      const content = newComment.trim()
      console.log('コメント投稿開始:', { shelfItemId, currentUserId, content })
      
      const { data, error } = await supabase
        .from('comments')
        .insert({
          shelf_item_id: shelfItemId,
          user_id: currentUserId,
          content
        })
        .select()

      console.log('コメント投稿結果:', { data, error })

      if (error) {
        console.error('コメント投稿エラー:', error)
        return
      }

      setNewComment('')
      
      // コメント一覧を即座に更新（楽観的更新）
      const optimisticComment = {
        id: 'temp-' + Date.now(),
        content,
        created_at: new Date().toISOString(),
        user: {
          id: currentUserId,
          display_name: me?.display_name || 'あなた',
          avatar_url: me?.avatar_url || null
        },
        likes_count: 0,
        user_liked: false
      }
      
      setComments(prev => [optimisticComment as unknown as Comment, ...prev])
      
      // コメント数を更新するために親コンポーネントに通知
      console.log('コメント追加イベント発火:', { shelfItemId })
      window.dispatchEvent(new CustomEvent('comment:added', { detail: { shelfItemId } }))
      
      // 少し待ってから再取得（整合性のため）
      setTimeout(() => { void fetchComments() }, 400)
    } catch (error) {
      console.error('コメント投稿エラー:', error)
    } finally {
      setLoading(false)
    }
  }

  // コメントのいいね
  const handleCommentLike = async (commentId: string, isLiked: boolean) => {
    if (!currentUserId) return

    try {
      if (isLiked) {
        // いいねを削除
        const { error } = await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', currentUserId)

        if (error) {
          console.error('いいね削除エラー:', error)
          return
        }
      } else {
        // いいねを追加
        const { error } = await supabase
          .from('comment_likes')
          .insert({
            comment_id: commentId,
            user_id: currentUserId
          })

        if (error) {
          console.error('いいね追加エラー:', error)
          return
        }
      }

      await fetchComments()
      
      // いいね数を更新するために親コンポーネントに通知
      window.dispatchEvent(new CustomEvent('like:toggled', { detail: { shelfItemId } }))
    } catch (error) {
      console.error('いいね処理エラー:', error)
    }
  }

  // コメント削除の確認
  const handleDeleteClick = (commentId: string) => {
    setCommentToDelete(commentId)
    setDeleteDialogOpen(true)
  }

  // コメントを削除
  const handleDeleteComment = async () => {
    if (!commentToDelete) return

    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentToDelete)

      if (error) {
        console.error('コメント削除エラー:', error)
        return
      }

      // コメント数を更新するために親コンポーネントに通知
      console.log('コメント削除イベント発火:', { shelfItemId })
      window.dispatchEvent(new CustomEvent('comment:deleted', { detail: { shelfItemId } }))

      // 即座にコメント一覧から削除
      setComments(prev => prev.filter(comment => comment.id !== commentToDelete))
      
      setDeleteDialogOpen(false)
      setCommentToDelete(null)
    } catch (error) {
      console.error('コメント削除エラー:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  // コメントの展開/折りたたみ
  const toggleCommentExpansion = (commentId: string) => {
    const newExpanded = new Set(expandedComments)
    if (newExpanded.has(commentId)) {
      newExpanded.delete(commentId)
    } else {
      newExpanded.add(commentId)
    }
    setExpandedComments(newExpanded)
  }

  // キーボードイベントハンドラー
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault() // 改行を無効化
      const now = Date.now()
      if (now - lastEnterTime < 500) {
        // ダブルエンターで送信
        handleSubmitComment()
        setLastEnterTime(0)
      } else {
        setLastEnterTime(now)
      }
    }
  }

  // コメントが3行を超えるかチェック
  const isCommentLong = (content: string) => {
    return content.length > 100 || content.split('\n').length > 3
  }

  useEffect(() => {
    if (open && shelfItemId) {
      console.log('CommentModal開く:', { shelfItemId })
      fetchComments()
    } else if (!open) {
      // モーダルが閉じる時にコメントをクリア
      setComments([])
    }
  }, [open, shelfItemId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[70vw] max-h-[70vh] bg-[#1a1a1a] border-[#333333] text-white [&>button]:text-[#666666] [&>button:hover]:text-red-500 [&>button]:bg-transparent [&>button:hover]:bg-transparent [&>button]:outline-none [&>button:focus]:outline-none [&>button:focus-visible]:outline-none [&>button]:ring-0 [&>button:focus]:ring-0 [&>button:focus-visible]:ring-0 [&>button]:shadow-none [&>button:focus]:shadow-none [&>button:focus-visible]:shadow-none"
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
          <DialogTitle className="text-white flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            コメント
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            このアイテムへのコメントを表示・投稿できます
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col h-full max-h-[60vh]">
          {/* コメント一覧 */}
          <div 
            className="flex-1 overflow-y-auto space-y-4 pr-2 min-h-0" 
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#808080 transparent'
            }}
            css={`
              &::-webkit-scrollbar {
                width: 4px;
              }
              &::-webkit-scrollbar-track {
                background: transparent;
              }
              &::-webkit-scrollbar-thumb {
                background: #808080;
                border-radius: 2px;
                height: 20px;
                max-height: 20px;
              }
              &::-webkit-scrollbar-thumb:hover {
                background: #a0a0a0;
              }
              &::-webkit-scrollbar-corner {
                background: transparent;
              }
            `}
          >
            {comments.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                コメントがありません
              </div>
            ) : (
              comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={comment.user.avatar_url || undefined} />
                  <AvatarFallback>{comment.user.display_name[0]}</AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link 
                      href={`/app/friends/${comment.user.id}`}
                      className="font-medium text-white hover:text-blue-400 transition-colors"
                      onClick={() => onOpenChange(false)}
                    >
                      {comment.user.display_name}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {new Date(comment.created_at).toLocaleString('ja-JP')}
                    </span>
                    <div className="ml-auto">
                      {comment.user.id === currentUserId ? (
                        <button
                          onClick={() => handleDeleteClick(comment.id)}
                          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                          title="削除"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  
                  <div className="text-sm text-white">
                    {expandedComments.has(comment.id) || !isCommentLong(comment.content) ? (
                      <div className="whitespace-pre-wrap">{comment.content}</div>
                    ) : (
                      <div>
                        <div className="whitespace-pre-wrap">
                          {comment.content.split('\n').slice(0, 3).join('\n')}
                          {comment.content.split('\n').length > 3 && '...'}
                        </div>
                        <button
                          onClick={() => toggleCommentExpansion(comment.id)}
                          className="text-blue-400 hover:text-blue-300 text-xs mt-1"
                        >
                          全文を表示
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 mt-2">
                    {comment.user.id !== currentUserId && (
                      <button
                        onClick={() => handleCommentLike(comment.id, comment.user_liked)}
                        className="flex items-center gap-1 text-xs text-white hover:text-red-500 transition-colors"
                      >
                        <Heart className={`h-3 w-3 ${comment.user_liked ? 'fill-red-500 text-red-500' : ''}`} />
                        <span>{comment.likes_count}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              ))
            )}
          </div>
          
          {/* コメント入力欄 */}
          <div className="border-t border-[#333333] pt-4 mt-4">
            <div className="flex gap-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="コメントを入力..."
                className="flex-1 bg-[#333333] border-[#333333] text-white placeholder:text-muted-foreground resize-none overflow-hidden"
                maxLength={100}
                rows={1}
                style={{ minHeight: '40px', maxHeight: '80px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = 'auto'
                  target.style.height = Math.min(target.scrollHeight, 80) + 'px'
                }}
              />
              <Button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || loading}
                className="bg-[#666666] hover:bg-[#4d4d4d] text-white"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {newComment.length}/100文字
            </div>
          </div>
        </div>
      </DialogContent>
      
      {/* 削除確認ダイアログ */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteComment}
        title="コメントを削除"
        description="このコメントを削除しますか？この操作は取り消せません。"
        isLoading={isDeleting}
      />
    </Dialog>
  )
}
