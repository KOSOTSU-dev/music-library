"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageCircle, Send, Trash2 } from "lucide-react"
import { addComment, deleteComment, getCommentsForShelfItem } from "@/app/app/comments-actions"
import { useToast } from "@/hooks/use-toast"

interface Comment {
  id: string
  content: string
  created_at: string
  user_id: string
  user: {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
  }
}

interface CommentSectionProps {
  shelfItemId: string
  currentUserId?: string
}

export default function CommentSection({ shelfItemId, currentUserId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const { toast } = useToast()

  // コメント一覧を読み込み
  const loadComments = async () => {
    setIsLoading(true)
    try {
      const { comments: commentsData, error } = await getCommentsForShelfItem(shelfItemId)
      if (error) {
        toast({
          title: "エラー",
          description: error,
          variant: "destructive"
        })
      } else {
        setComments(commentsData)
      }
    } catch (error) {
      toast({
        title: "エラー",
        description: "コメントの読み込みに失敗しました",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadComments()
  }, [shelfItemId])

  // コメントを追加
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setIsAdding(true)
    const formData = new FormData()
    formData.set('shelfItemId', shelfItemId)
    formData.set('content', newComment)

    try {
      const { comment, error } = await addComment(formData)
      if (error) {
        toast({
          title: "エラー",
          description: error,
          variant: "destructive"
        })
      } else {
        setComments(prev => [comment, ...prev])
        setNewComment("")
        toast({
          title: "成功",
          description: "コメントを追加しました"
        })
      }
    } catch (error) {
      toast({
        title: "エラー",
        description: "コメントの追加に失敗しました",
        variant: "destructive"
      })
    } finally {
      setIsAdding(false)
    }
  }

  // コメントを削除
  const handleDeleteComment = async (commentId: string) => {
    const formData = new FormData()
    formData.set('commentId', commentId)

    try {
      const { error } = await deleteComment(formData)
      if (error) {
        toast({
          title: "エラー",
          description: error,
          variant: "destructive"
        })
      } else {
        setComments(prev => prev.filter(comment => comment.id !== commentId))
        toast({
          title: "成功",
          description: "コメントを削除しました"
        })
      }
    } catch (error) {
      toast({
        title: "エラー",
        description: "コメントの削除に失敗しました",
        variant: "destructive"
      })
    }
  }

  // 日時のフォーマット
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) {
      return "たった今"
    } else if (diffInHours < 24) {
      return `${diffInHours}時間前`
    } else if (diffInHours < 168) { // 7日
      const diffInDays = Math.floor(diffInHours / 24)
      return `${diffInDays}日前`
    } else {
      return date.toLocaleDateString('ja-JP')
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="h-5 w-5" />
          コメント ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* コメント追加フォーム */}
        <form onSubmit={handleAddComment} className="flex gap-2">
          <Input
            placeholder="コメントを入力..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            maxLength={500}
            disabled={isAdding}
          />
          <Button type="submit" disabled={isAdding || !newComment.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>

        {/* コメント一覧 */}
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">
            コメントを読み込み中...
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            まだコメントがありません
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 p-3 border rounded-lg">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={comment.user.avatar_url || undefined} />
                  <AvatarFallback>{comment.user.display_name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{comment.user.display_name}</span>
                    <span className="text-xs text-muted-foreground">
                      @{comment.user.username}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm">{comment.content}</p>
                </div>
                {comment.user_id === currentUserId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteComment(comment.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
