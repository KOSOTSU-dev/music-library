import { Suspense } from "react"
import FriendShelfDetail from "@/components/friends/FriendShelfDetail"
import { Toaster } from "@/components/ui/toaster"

interface PageProps {
  params: {
    userId: string
    shelfId: string
  }
}

export default function FriendShelfPage({ params }: PageProps) {
  return (
    <>
      <Suspense fallback={<div className="p-6">読み込み中...</div>}>
        <FriendShelfDetail userId={params.userId} shelfId={params.shelfId} />
      </Suspense>
      <Toaster />
    </>
  )
}
