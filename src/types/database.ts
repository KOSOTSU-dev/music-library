export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          spotify_id: string
          username: string
          display_name: string
          avatar_url: string | null
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          spotify_id: string
          username: string
          display_name: string
          avatar_url?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          spotify_id?: string
          username?: string
          display_name?: string
          avatar_url?: string | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      shelves: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          is_public: boolean
          sort_order: number
          created_at: string
          updated_at: string
          icon_url: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          is_public?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
          icon_url?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          is_public?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
          icon_url?: string | null
        }
      }
      shelf_items: {
        Row: {
          id: string
          shelf_id: string
          spotify_type: 'track' | 'album' | 'playlist'
          spotify_id: string
          title: string
          artist: string
          album: string | null
          image_url: string | null
          color: string | null
          position: number
          memo: string | null
          created_at: string
        }
        Insert: {
          id?: string
          shelf_id: string
          spotify_type: 'track' | 'album' | 'playlist'
          spotify_id: string
          title: string
          artist: string
          album?: string | null
          image_url?: string | null
          color?: string | null
          position?: number
          memo?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          shelf_id?: string
          spotify_type?: 'track' | 'album' | 'playlist'
          spotify_id?: string
          title?: string
          artist?: string
          album?: string | null
          image_url?: string | null
          color?: string | null
          position?: number
          memo?: string | null
          created_at?: string
        }
      }
      comments: {
        Row: {
          id: string
          shelf_item_id: string
          user_id: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          shelf_item_id: string
          user_id: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          shelf_item_id?: string
          user_id?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
      }
      likes: {
        Row: {
          id: string
          shelf_item_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          shelf_item_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          shelf_item_id?: string
          user_id?: string
          created_at?: string
        }
      }
      friends: {
        Row: {
          id: string
          user_id: string
          friend_id: string
          status: 'pending' | 'accepted' | 'blocked'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          friend_id: string
          status?: 'pending' | 'accepted' | 'blocked'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          friend_id?: string
          status?: 'pending' | 'accepted' | 'blocked'
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
