import { supabase } from './supabase'

export interface SpotifyTrack {
  id: string
  name: string
  artists: Array<{ name: string }>
  album: {
    name: string
    images: Array<{ url: string; height: number; width: number }>
  }
  duration_ms: number
  preview_url: string | null
}

export interface SpotifyAlbum {
  id: string
  name: string
  artists: Array<{ name: string }>
  images: Array<{ url: string; height: number; width: number }>
  total_tracks: number
  release_date: string
}

export interface SpotifyPlaylist {
  id: string
  name: string
  description: string
  images: Array<{ url: string; height: number; width: number }>
  owner: {
    display_name: string
  }
  tracks: {
    total: number
  }
}

export type SpotifyItem = SpotifyTrack | SpotifyAlbum | SpotifyPlaylist

// Spotify API クライアント
export class SpotifyClient {
  private accessToken: string | null = null

  constructor(accessToken?: string) {
    this.accessToken = accessToken || null
  }

  async setAccessToken(accessToken: string) {
    this.accessToken = accessToken
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    if (!this.accessToken) {
      throw new Error('No access token available')
    }

    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`)
    }

    return response.json()
  }

  async search(query: string, types: string[] = ['track', 'album', 'playlist'], limit = 20) {
    const params = new URLSearchParams({
      q: query,
      type: types.join(','),
      limit: limit.toString(),
    })

    return this.makeRequest(`/search?${params}`)
  }

  async getTrack(id: string): Promise<SpotifyTrack> {
    return this.makeRequest(`/tracks/${id}`)
  }

  async getAlbum(id: string): Promise<SpotifyAlbum> {
    return this.makeRequest(`/albums/${id}`)
  }

  async getPlaylist(id: string): Promise<SpotifyPlaylist> {
    return this.makeRequest(`/playlists/${id}`)
  }

  async getUserPlaylists(limit = 50) {
    return this.makeRequest(`/me/playlists?limit=${limit}`)
  }

  async playTrack(deviceId?: string, trackUri?: string) {
    const body: any = {}
    
    if (deviceId) {
      body.device_id = deviceId
    }
    
    if (trackUri) {
      body.uris = [trackUri]
    }

    return this.makeRequest('/me/player/play', {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  }

  async getDevices() {
    return this.makeRequest('/me/player/devices')
  }
}

// アクセストークンの管理
export async function getStoredAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.provider_token || null
}

export async function refreshAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.refreshSession()
  return session?.provider_token || null
}
