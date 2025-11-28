import { NextResponse } from 'next/server'

// Client Credentials FlowでSpotify API検索
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const limit = searchParams.get('limit') || '10'

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
  }

  try {
    // Client Credentials Flowでトークンを取得
    const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Spotify credentials not configured' }, { status: 500 })
    }

    // アクセストークンを取得
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials'
    })

    if (!tokenResponse.ok) {
      return NextResponse.json({ error: 'Failed to get access token' }, { status: 500 })
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Spotify APIで検索
    const searchParams = new URLSearchParams({
      q: query,
      type: 'track',
      limit: limit
    })

    const searchResponse = await fetch(`https://api.spotify.com/v1/search?${searchParams}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!searchResponse.ok) {
      return NextResponse.json({ error: 'Search failed' }, { status: searchResponse.status })
    }

    const searchData = await searchResponse.json()
    
    // 結果を整形
    const tracks = (searchData.tracks?.items || []).map((track: any) => ({
      id: track.id,
      name: track.name,
      artists: (track.artists || []).map((a: any) => a.name).join(', '),
      album: track.album?.name || '',
      image: track.album?.images?.[0]?.url || null,
      type: 'track',
      spotify_id: track.id,
      spotify_type: 'track',
      duration_ms: track.duration_ms,
      preview_url: track.preview_url,
    }))

    return NextResponse.json({ tracks })
  } catch (error) {
    console.error('Spotify search error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

