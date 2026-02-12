export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          user_id: string
          email: string
          name: string | null
          dept_name: string | null
          current_points: number
          total_donated_amount: number
          level: 'ECO_KEEPER' | 'GREEN_MASTER' | 'EARTH_HERO'
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          email: string
          name?: string | null
          dept_name?: string | null
          current_points?: number
          total_donated_amount?: number
          level?: 'ECO_KEEPER' | 'GREEN_MASTER' | 'EARTH_HERO'
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          email?: string
          name?: string | null
          dept_name?: string | null
          current_points?: number
          total_donated_amount?: number
          level?: 'ECO_KEEPER' | 'GREEN_MASTER' | 'EARTH_HERO'
          created_at?: string
          updated_at?: string
        }
      }
      donation_targets: {
        Row: {
          target_id: string
          name: string
          description: string | null
          image_url: string | null
          target_amount: number
          current_amount: number
          status: 'ACTIVE' | 'COMPLETED'
          created_at: string
          updated_at: string
        }
        Insert: {
          target_id?: string
          name: string
          description?: string | null
          image_url?: string | null
          target_amount?: number
          current_amount?: number
          status?: 'ACTIVE' | 'COMPLETED'
          created_at?: string
          updated_at?: string
        }
        Update: {
          target_id?: string
          name?: string
          description?: string | null
          image_url?: string | null
          target_amount?: number
          current_amount?: number
          status?: 'ACTIVE' | 'COMPLETED'
          created_at?: string
          updated_at?: string
        }
      }
      donations: {
        Row: {
          donation_id: string
          user_id: string
          target_id: string
          amount: number
          created_at: string
        }
        Insert: {
          donation_id?: string
          user_id: string
          target_id: string
          amount: number
          created_at?: string
        }
        Update: {
          donation_id?: string
          user_id?: string
          target_id?: string
          amount?: number
          created_at?: string
        }
      }
      point_transactions: {
        Row: {
          transaction_id: string
          user_id: string
          type: 'EARNED' | 'DONATED' | 'USED'
          amount: number
          related_id: string | null
          related_type: string | null
          description: string | null
          created_at: string
        }
        Insert: {
          transaction_id?: string
          user_id: string
          type: 'EARNED' | 'DONATED' | 'USED'
          amount: number
          related_id?: string | null
          related_type?: string | null
          description?: string | null
          created_at?: string
        }
        Update: {
          transaction_id?: string
          user_id?: string
          type?: 'EARNED' | 'DONATED' | 'USED'
          amount?: number
          related_id?: string | null
          related_type?: string | null
          description?: string | null
          created_at?: string
        }
      }
    }
  }
}
