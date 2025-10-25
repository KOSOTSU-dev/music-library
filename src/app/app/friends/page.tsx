import { Suspense } from "react"
import FriendsPage from "@/components/friends/FriendsPage"
import { Toaster } from "@/components/ui/toaster"

export default function Friends() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white grid place-items-center p-4">読み込み中...</div>}>
      <FriendsPage />
      <Toaster />
    </Suspense>
  )
}

