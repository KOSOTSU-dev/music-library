export default function FriendShelfNotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">ギャラリーが存在しません</h1>
        <p className="text-gray-400 mb-6">
          このユーザーにはまだ棚が作成されていません。
        </p>
        <a 
          href="/app/friends" 
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-9 px-4 py-2"
        >
          フレンド一覧に戻る
        </a>
      </div>
    </div>
  )
}
