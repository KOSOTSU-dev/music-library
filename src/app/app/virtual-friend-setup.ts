"use server"

import { getServerSupabase } from "@/lib/server-supabase"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { revalidatePath } from "next/cache"

// 仮想フレンドからの申請をセットアップ
export async function setupVirtualFriendRequests() {
  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未認証です' }

  // 既存の仮想フレンド申請を削除してから新規作成
  const { data: existingRequests } = await supabase
    .from('friends')
    .select(`
      id,
      user:users!friends_user_id_fkey(spotify_id)
    `)
    .eq('friend_id', user.id)
    .eq('status', 'pending')

  if (existingRequests) {
    const virtualRequestIds = existingRequests
      .filter(req => req.user?.spotify_id?.startsWith('virtual_'))
      .map(req => req.id)

    if (virtualRequestIds.length > 0) {
      await supabase
        .from('friends')
        .delete()
        .in('id', virtualRequestIds)
    }
  }

  // 仮想フレンドユーザーを作成
  const virtualFriends = [
    {
      username: 'testfriend1',
      displayName: 'お試しフレンド１',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face'
    },
    {
      username: 'testfriend2',
      displayName: 'お試しフレンド２',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
    }
  ]

  const createdUsers: Array<{ id: string; username: string }> = []

  for (const friendData of virtualFriends) {
    try {
      // 既存の仮想ユーザーがいないか確認
      const { data: existingPublic } = await supabaseAdmin
        .from('users')
        .select('id, username')
        .eq('spotify_id', `virtual_${friendData.username}`)
        .maybeSingle()

      let virtualUserId: string | null = existingPublic?.id ?? null

      if (!virtualUserId) {
        // 認証ユーザーを作成
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: `${friendData.username}@virtual.local`,
          password: 'virtual123',
          email_confirm: true,
          user_metadata: {
            full_name: friendData.displayName,
            avatar_url: friendData.avatarUrl,
            provider: 'virtual'
          }
        })

        if (authError || !authUser.user) {
          console.error(`認証ユーザー作成失敗 (${friendData.username}):`, authError)
          continue
        }

        virtualUserId = authUser.user.id

        // public.usersテーブルにエントリを作成
        const { error: publicError } = await supabaseAdmin
          .from('users')
          .insert({
            id: virtualUserId,
            spotify_id: `virtual_${friendData.username}`,
            username: friendData.username,
            display_name: friendData.displayName,
            avatar_url: friendData.avatarUrl,
            is_public: true
          })

        if (publicError) {
          console.error(`public.users作成失敗 (${friendData.username}):`, publicError)
          // 認証ユーザーを削除
          await supabaseAdmin.auth.admin.deleteUser(virtualUserId)
          continue
        }

        // 複数のサンプル棚を作成
        const shelves = [
          {
            name: 'お気に入り',
            description: `${friendData.displayName}のお気に入り楽曲`,
            sort_order: 0
          },
          {
            name: 'リラックス',
            description: `${friendData.displayName}のリラックス用楽曲`,
            sort_order: 1
          },
          {
            name: 'エナジー',
            description: `${friendData.displayName}のエナジーチャージ用楽曲`,
            sort_order: 2
          }
        ]

        for (const shelfData of shelves) {
          const { error: shelfError } = await supabaseAdmin
            .from('shelves')
            .insert({
              name: shelfData.name,
              description: shelfData.description,
              user_id: virtualUserId,
              is_public: true,
              sort_order: shelfData.sort_order
            })

          if (shelfError) {
            console.error(`サンプル棚作成失敗 (${friendData.username} - ${shelfData.name}):`, shelfError)
          }
        }
      }

      createdUsers.push({ id: virtualUserId!, username: friendData.username })

    } catch (error) {
      console.error(`仮想フレンド作成エラー (${friendData.username}):`, error)
    }
  }

  // フレンド申請を作成
  for (const virtualUser of createdUsers) {
    try {
      const { error: friendError } = await supabaseAdmin
        .from('friends')
        .insert({
          user_id: virtualUser.id,
          friend_id: user.id,
          status: 'pending'
        })

      if (friendError) {
        console.error(`フレンド申請作成失敗 (${virtualUser.username}):`, friendError)
      }
    } catch (error) {
      console.error(`フレンド申請作成エラー (${virtualUser.username}):`, error)
    }
  }

  // 各仮想ユーザーの棚にサンプルトラックを投入
  for (const virtualUser of createdUsers) {
    try {
      // 対象ユーザーの全棚を取得
      const { data: userShelves } = await supabaseAdmin
        .from('shelves')
        .select('id, name')
        .eq('user_id', virtualUser.id)
        .eq('is_public', true)
        .order('sort_order', { ascending: true })

      if (!userShelves || userShelves.length === 0) continue

      // 棚ごとの楽曲データ
      const shelfTracks = {
        'お気に入り': [
          { title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', image_url: null, spotify_type: 'track', spotify_id: '0VjIjW4GlUZAMYd2vXMi3b' },
          { title: 'Levitating', artist: 'Dua Lipa', album: 'Future Nostalgia', image_url: null, spotify_type: 'track', spotify_id: '463CkQjx2Zk1yXoBuierM9' },
          { title: "Don't Start Now", artist: 'Dua Lipa', album: 'Future Nostalgia', image_url: null, spotify_type: 'track', spotify_id: '3PfIrDoz19wz7qK7tYeu62' },
          { title: 'Shape of You', artist: 'Ed Sheeran', album: '÷ (Divide)', image_url: null, spotify_type: 'track', spotify_id: '7qiZfU4dY1lWllzX7mPBI3' },
          { title: 'Uptown Funk', artist: 'Mark Ronson', album: 'Uptown Special', image_url: null, spotify_type: 'track', spotify_id: '32OlwWuMpZ6b0aN2RZOeMS' },
          { title: 'Someone Like You', artist: 'Adele', album: '21', image_url: null, spotify_type: 'track', spotify_id: '1zwMYTA5nlNjZxYrvBB2pV' },
          { title: 'Rolling in the Deep', artist: 'Adele', album: '21', image_url: null, spotify_type: 'track', spotify_id: '1c8gk2PeTE04A1pIDH9YMk' },
          { title: 'Thinking Out Loud', artist: 'Ed Sheeran', album: 'x', image_url: null, spotify_type: 'track', spotify_id: '34gCuhDGsG4bRPIf9bb02f' },
          { title: 'Wake Me Up', artist: 'Avicii', album: 'True', image_url: null, spotify_type: 'track', spotify_id: '1xznGGDReH1oQq0xzbwXa3' },
          { title: 'Royals', artist: 'Lorde', album: 'Pure Heroine', image_url: null, spotify_type: 'track', spotify_id: '2dLLR6qlu5UJ5gk0dKz0h3' },
          { title: 'Get Lucky', artist: 'Daft Punk', album: 'Random Access Memories', image_url: null, spotify_type: 'track', spotify_id: '69kOkLUCkxIZYexIgSG8rq' },
          { title: 'Happy', artist: 'Pharrell Williams', album: 'G I R L', image_url: null, spotify_type: 'track', spotify_id: '60nZcImufyMA1MKQY3dcCH' },
          { title: 'Sugar', artist: 'Maroon 5', album: 'V', image_url: null, spotify_type: 'track', spotify_id: '69gGOnr0qbx9a2aZsWlGZ2' },
          { title: 'Counting Stars', artist: 'OneRepublic', album: 'Native', image_url: null, spotify_type: 'track', spotify_id: '2tpWsVSb9UEmDRxAl1zhX1' },
          { title: 'Senorita', artist: 'Shawn Mendes, Camila Cabello', album: 'Shawn Mendes', image_url: null, spotify_type: 'track', spotify_id: '0TK2YIli7K1leLovkQiNik' },
          { title: 'Bad Habits', artist: 'Ed Sheeran', album: '=', image_url: null, spotify_type: 'track', spotify_id: '6PQ88X9TkUIAUIZJHW2upE' },
          { title: 'Watermelon Sugar', artist: 'Harry Styles', album: 'Fine Line', image_url: null, spotify_type: 'track', spotify_id: '6UelLqGlWMcVH1E5c4H7lY' },
          { title: 'Dance Monkey', artist: 'Tones and I', album: 'The Kids Are Coming', image_url: null, spotify_type: 'track', spotify_id: '2XU0oxnq2qxCpomAAuJY8K' },
          { title: 'Blow', artist: 'Ed Sheeran, Chris Stapleton, Bruno Mars', album: 'No.6', image_url: null, spotify_type: 'track', spotify_id: '0Vj2a4P4G1vZEBtcHTfb3W' },
          { title: 'Havana', artist: 'Camila Cabello', album: 'Camila', image_url: null, spotify_type: 'track', spotify_id: '1rfofaqEpACxVEHIZBJe6W' },
        ],
        'リラックス': [
          { title: 'drivers license', artist: 'Olivia Rodrigo', album: 'SOUR', image_url: null, spotify_type: 'track', spotify_id: '5wANPM4fQCJwkGd4rN57mH' },
          { title: 'Hello', artist: 'Adele', album: '25', image_url: null, spotify_type: 'track', spotify_id: '1zHlj4dQ8ZAtrayhuDDmkY' },
          { title: 'Circles', artist: 'Post Malone', album: "Hollywood's Bleeding", image_url: null, spotify_type: 'track', spotify_id: '21jGcNKet2qwijlDFuPiPb' },
          { title: 'Memories', artist: 'Maroon 5', album: 'JORDI', image_url: null, spotify_type: 'track', spotify_id: '2b8fOow8UzyDFAE27YhOZM' },
          { title: 'As It Was', artist: 'Harry Styles', album: "Harry's House", image_url: null, spotify_type: 'track', spotify_id: '4LRPiXqCikLlN15c3yImP7' },
          { title: 'lovely', artist: 'Billie Eilish, Khalid', album: 'lovely', image_url: null, spotify_type: 'track', spotify_id: '0u2P5u6lvoDfwTYjAADbn4' },
          { title: 'The Night We Met', artist: 'Lord Huron', album: 'Strange Trails', image_url: null, spotify_type: 'track', spotify_id: '3hRV0jL3vUpRrcy398teAU' },
          { title: 'Photograph', artist: 'Ed Sheeran', album: 'x', image_url: null, spotify_type: 'track', spotify_id: '6fxVffaTuwjgEk5h9QyRjy' },
          { title: 'All of Me', artist: 'John Legend', album: 'Love In The Future', image_url: null, spotify_type: 'track', spotify_id: '0Qh38w01QRXK6KHIv0e3hb' },
          { title: 'Let Her Go', artist: 'Passenger', album: 'All the Little Lights', image_url: null, spotify_type: 'track', spotify_id: '0Jmnk4oweaGKjK1GQlG2W9' },
          { title: 'Skinny Love', artist: 'Bon Iver', album: 'For Emma, Forever Ago', image_url: null, spotify_type: 'track', spotify_id: '0qT79UgT5tY4yudH9VfsdT' },
          { title: 'Holocene', artist: 'Bon Iver', album: 'Bon Iver', image_url: null, spotify_type: 'track', spotify_id: '4m1r5LRFQx0XBNJQqf2r6S' },
          { title: 'Yellow', artist: 'Coldplay', album: 'Parachutes', image_url: null, spotify_type: 'track', spotify_id: '3AJwUDP919kvQ9QcozQPxg' },
          { title: 'Let It Be', artist: 'The Beatles', album: 'Let It Be', image_url: null, spotify_type: 'track', spotify_id: '7iN1s7xHE4ifF5povM6A48' },
          { title: 'Fix You', artist: 'Coldplay', album: 'X&Y', image_url: null, spotify_type: 'track', spotify_id: '0z1oZ9c5AaCJh8bSM4A6d5' },
          { title: 'Happier', artist: 'Ed Sheeran', album: '÷ (Divide)', image_url: null, spotify_type: 'track', spotify_id: '2RttW7RAu5nOAfq6YFvApB' },
          { title: 'Lost', artist: 'Dermot Kennedy', album: 'Without Fear', image_url: null, spotify_type: 'track', spotify_id: '4OD7oCGiX3LQn6eF3E1Y4m' },
          { title: 'The A Team', artist: 'Ed Sheeran', album: '+', image_url: null, spotify_type: 'track', spotify_id: '0eGsygTp906u18L0Oimnem' },
          { title: 'Stay With Me', artist: 'Sam Smith', album: 'In the Lonely Hour', image_url: null, spotify_type: 'track', spotify_id: '2H1uHYc8Q5Wv8NoS0q6g5w' },
          { title: 'I See Fire', artist: 'Ed Sheeran', album: 'x (Wembley Edition)', image_url: null, spotify_type: 'track', spotify_id: '7BqG5lsQ0kNG4umRkXh6jz' },
        ],
        'エナジー': [
          { title: 'bad guy', artist: 'Billie Eilish', album: 'WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?', image_url: null, spotify_type: 'track', spotify_id: '2Fxmhks0bxFxX5khXwaCjQ' },
          { title: 'STAY (with Justin Bieber)', artist: 'The Kid LAROI', album: 'F*CK LOVE 3: OVER YOU', image_url: null, spotify_type: 'track', spotify_id: '5PjdY0CKGZdEuoNab3yDmX' },
          { title: 'Believer', artist: 'Imagine Dragons', album: 'Evolve', image_url: null, spotify_type: 'track', spotify_id: '0pqnGHJpmpxLKifKRmU6WP' },
          { title: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', image_url: null, spotify_type: 'track', spotify_id: '4uLU6hMCjMI75M1A2tKUQC' },
          { title: 'Thunder', artist: 'Imagine Dragons', album: 'Evolve', image_url: null, spotify_type: 'track', spotify_id: '1zB4vmk8tFRmM9UULNzbLB' },
          { title: 'Can’t Hold Us', artist: 'Macklemore & Ryan Lewis', album: 'The Heist', image_url: null, spotify_type: 'track', spotify_id: '3bidbhpOYeV4knp8AIu8Xn' },
          { title: 'Lose Yourself', artist: 'Eminem', album: 'Curtain Call', image_url: null, spotify_type: 'track', spotify_id: '1T2BWqgJ0Z5q5I9PTGfR9M' },
          { title: 'Stronger', artist: 'Kanye West', album: 'Graduation', image_url: null, spotify_type: 'track', spotify_id: '5SkRLpaGtvYPh7CXM7Hx8d' },
          { title: 'Eye of the Tiger', artist: 'Survivor', album: 'Eye of the Tiger', image_url: null, spotify_type: 'track', spotify_id: '2aBxt229cbLDOvtL7Xbb9x' },
          { title: 'Seven Nation Army', artist: 'The White Stripes', album: 'Elephant', image_url: null, spotify_type: 'track', spotify_id: '3dPQuX8Gs42Y7b454ybpMR' },
          { title: 'Uprising', artist: 'Muse', album: 'The Resistance', image_url: null, spotify_type: 'track', spotify_id: '0xCPyFjhjyl0H1wGs9n6S9' },
          { title: 'Smells Like Teen Spirit', artist: 'Nirvana', album: 'Nevermind', image_url: null, spotify_type: 'track', spotify_id: '5ghIJDpPoe3CfHMGu71E6T' },
          { title: 'Enter Sandman', artist: 'Metallica', album: 'Metallica', image_url: null, spotify_type: 'track', spotify_id: '5sICkBXVmaCQk5aISGR3x1' },
          { title: 'Numb', artist: 'Linkin Park', album: 'Meteora', image_url: null, spotify_type: 'track', spotify_id: '2nLtzopw4rPReszdYBJU6h' },
          { title: 'Radioactive', artist: 'Imagine Dragons', album: 'Night Visions', image_url: null, spotify_type: 'track', spotify_id: '4G8gkOterJn0Ywt6uhqbhp' },
          { title: 'HUMBLE.', artist: 'Kendrick Lamar', album: 'DAMN.', image_url: null, spotify_type: 'track', spotify_id: '7KXjTSCq5nL1LoYtL7XAwS' },
          { title: 'POWER', artist: 'Kanye West', album: 'My Beautiful Dark Twisted Fantasy', image_url: null, spotify_type: 'track', spotify_id: '4EWCNWgDS8707fNSZ1oaA5' },
          { title: 'Titanium', artist: 'David Guetta feat. Sia', album: 'Nothing but the Beat', image_url: null, spotify_type: 'track', spotify_id: '0lHAMNU8RGiIObScrsRgmP' },
          { title: 'Don’t Stop Me Now', artist: 'Queen', album: 'Jazz', image_url: null, spotify_type: 'track', spotify_id: '7hQJA50XrCWABAu5v6QZ4i' },
          { title: 'Can’t Stop', artist: 'Red Hot Chili Peppers', album: 'By the Way', image_url: null, spotify_type: 'track', spotify_id: '3ZOEytgrvLwQaqXreDs2Jx' },
        ]
      }

      // 各棚に楽曲を追加
      for (const shelf of userShelves) {
        // 既存のアイテムは一旦クリアしてから投入
        await supabaseAdmin
          .from('shelf_items')
          .delete()
          .eq('shelf_id', shelf.id)

        const tracks = shelfTracks[shelf.name as keyof typeof shelfTracks] || []
        if (tracks.length === 0) continue

        const desiredCount = 60
        const extendedTracks =
          tracks.length >= desiredCount
            ? tracks.slice(0, desiredCount)
            : Array.from({ length: desiredCount }, (_, idx) => ({ ...tracks[idx % tracks.length] }))

        const itemsToInsert = extendedTracks.map((t, idx) => ({
          shelf_id: shelf.id,
          title: t.title,
          artist: t.artist,
          album: t.album,
          image_url: t.image_url,
          spotify_type: t.spotify_type,
          spotify_id: t.spotify_id,
          position: idx,
        }))

        await supabaseAdmin.from('shelf_items').insert(itemsToInsert)
      }
    } catch (error) {
      console.error('仮想ユーザーへのトラック投入失敗:', error)
    }
  }

  revalidatePath('/app/friends')
  return { 
    success: true, 
    message: `${createdUsers.length}人の仮想フレンドからの申請を作成しました` 
  }
}

// 仮想フレンド申請をクリア
export async function clearVirtualFriendRequests() {
  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未認証です' }

  // 仮想フレンドからの申請を取得
  const { data: requests } = await supabase
    .from('friends')
    .select(`
      id,
      user_id,
      user:users!friends_user_id_fkey(spotify_id)
    `)
    .eq('friend_id', user.id)
    .eq('status', 'pending')

  if (requests) {
    // 仮想フレンドの申請を削除
    const virtualRequestIds = requests
      .filter(req => req.user?.spotify_id?.startsWith('virtual_'))
      .map(req => req.id)

    if (virtualRequestIds.length > 0) {
      const { error } = await supabase
        .from('friends')
        .delete()
        .in('id', virtualRequestIds)

      if (error) {
        return { error: error.message }
      }
    }
  }

  revalidatePath('/app/friends')
  return { success: true, message: '仮想フレンド申請をクリアしました' }
}
