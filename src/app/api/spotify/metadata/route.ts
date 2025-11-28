import { NextResponse } from 'next/server'

async function getAccessToken() {
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials not configured')
  }

  const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
    },
    body: 'grant_type=client_credentials'
  })

  if (!tokenResponse.ok) {
    throw new Error('Failed to obtain Spotify access token')
  }

  const tokenData = await tokenResponse.json()
  return tokenData.access_token as string
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const type = searchParams.get('type') || 'track'

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const accessToken = await getAccessToken()

    let endpoint = ''
    switch (type) {
      case 'track':
        endpoint = `https://api.spotify.com/v1/tracks/${id}`
        break
      case 'album':
        endpoint = `https://api.spotify.com/v1/albums/${id}`
        break
      case 'playlist':
        endpoint = `https://api.spotify.com/v1/playlists/${id}`
        break
      default:
        return NextResponse.json({ error: 'Unsupported type' }, { status: 400 })
    }

    const metaResponse = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })

    if (!metaResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch metadata' }, { status: metaResponse.status })
    }

    const metaData = await metaResponse.json()

    let image: string | null = null
    if (type === 'track') {
      image = metaData.album?.images?.[0]?.url ?? null
    } else if (type === 'album') {
      image = metaData.images?.[0]?.url ?? null
    } else if (type === 'playlist') {
      image = metaData.images?.[0]?.url ?? null
    }

    return NextResponse.json({
      id: metaData.id,
      type,
      name: metaData.name,
      album: metaData.album,
      artists: metaData.artists,
      images: metaData.images ?? metaData.album?.images ?? [],
      image,
    })
  } catch (error: any) {
    console.error('Spotify metadata error:', error)
    return NextResponse.json({ error: error.message ?? 'Internal server error' }, { status: 500 })
  }
}


