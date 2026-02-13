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
          is_admin: boolean
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
          is_admin?: boolean
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
          is_admin?: boolean
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
          user_email: string | null
          user_name: string | null
          donation_target_name: string | null
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
          user_email?: string | null
          user_name?: string | null
          donation_target_name?: string | null
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
          user_email?: string | null
          user_name?: string | null
          donation_target_name?: string | null
          created_at?: string
        }
      }
      events: {
        Row: {
          event_id: string
          title: string
          description: string | null
          category: 'V_TOGETHER' | 'CULTURE'
          type: 'ALWAYS' | 'SEASONAL'
          reward_policy: 'SENDER_ONLY' | 'BOTH'
          reward_type: 'POINTS' | 'COUPON' | 'CHOICE'
          reward_amount: number | null
          image_url: string | null
          status: 'ACTIVE' | 'PAUSED' | 'ENDED'
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          event_id?: string
          title: string
          description?: string | null
          category: 'V_TOGETHER' | 'CULTURE'
          type: 'ALWAYS' | 'SEASONAL'
          reward_policy: 'SENDER_ONLY' | 'BOTH'
          reward_type: 'POINTS' | 'COUPON' | 'CHOICE'
          reward_amount?: number | null
          image_url?: string | null
          status?: 'ACTIVE' | 'PAUSED' | 'ENDED'
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          category?: 'V_TOGETHER' | 'CULTURE'
          type?: 'ALWAYS' | 'SEASONAL'
          reward_policy?: 'SENDER_ONLY' | 'BOTH'
          reward_type?: 'POINTS' | 'COUPON' | 'CHOICE'
          reward_amount?: number | null
          image_url?: string | null
          status?: 'ACTIVE' | 'PAUSED' | 'ENDED'
          created_by?: string | null
          updated_at?: string
        }
      }
      event_rounds: {
        Row: {
          round_id: string
          event_id: string
          round_number: number
          start_date: string
          end_date: string
          reward_amount: number | null
          created_at: string
        }
        Insert: {
          round_id?: string
          event_id: string
          round_number: number
          start_date: string
          end_date: string
          reward_amount?: number | null
          created_at?: string
        }
        Update: {
          event_id?: string
          round_number?: number
          start_date?: string
          end_date?: string
          reward_amount?: number | null
        }
      }
      event_verification_methods: {
        Row: {
          method_id: string
          event_id: string
          method_type: 'PHOTO' | 'TEXT' | 'VALUE' | 'PEER_SELECT'
          is_required: boolean
          label: string | null
          placeholder: string | null
          created_at: string
        }
        Insert: {
          method_id?: string
          event_id: string
          method_type: 'PHOTO' | 'TEXT' | 'VALUE' | 'PEER_SELECT'
          is_required?: boolean
          label?: string | null
          placeholder?: string | null
          created_at?: string
        }
        Update: {
          event_id?: string
          method_type?: 'PHOTO' | 'TEXT' | 'VALUE' | 'PEER_SELECT'
          is_required?: boolean
          label?: string | null
          placeholder?: string | null
        }
      }
      event_submissions: {
        Row: {
          submission_id: string
          event_id: string
          round_id: string | null
          user_id: string
          status: 'PENDING' | 'APPROVED' | 'REJECTED'
          verification_data: Json | null
          peer_user_id: string | null
          reward_received: boolean
          reward_type: string | null
          reward_amount: number | null
          rejection_reason: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          submission_id?: string
          event_id: string
          round_id?: string | null
          user_id: string
          status?: 'PENDING' | 'APPROVED' | 'REJECTED'
          verification_data?: Json | null
          peer_user_id?: string | null
          reward_received?: boolean
          reward_type?: string | null
          reward_amount?: number | null
          rejection_reason?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          event_id?: string
          round_id?: string | null
          user_id?: string
          status?: 'PENDING' | 'APPROVED' | 'REJECTED'
          verification_data?: Json | null
          peer_user_id?: string | null
          reward_received?: boolean
          reward_type?: string | null
          reward_amount?: number | null
          rejection_reason?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          updated_at?: string
        }
      }
    }
  }
}
