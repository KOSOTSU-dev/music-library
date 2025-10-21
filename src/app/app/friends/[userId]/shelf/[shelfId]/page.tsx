import { Suspense } from "react"
import FriendShelfDetail from "@/components/friends/FriendShelfDetail"
import { Toaster } from "@/components/ui/toaster"

interface PageProps {
  params: Promise<{
    userId: string
    shelfId: string
  }>
}

export default async function FriendShelfPage({ params }: PageProps) {
  const { userId, shelfId } = await params
  
  return (
    <>
      <Suspense fallback={<div className="min-h-screen bg-black text-white grid place-items-center">読み込み中...</div>}>
        <FriendShelfDetail userId={userId} shelfId={shelfId} />
      </Suspense>
      <Toaster />
    </>
  )
}
