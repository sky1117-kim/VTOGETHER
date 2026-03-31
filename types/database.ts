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
          current_medals: number
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
          current_medals?: number
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
          current_medals?: number
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
          currency_type: 'V_CREDIT' | 'V_MEDAL'
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
          currency_type?: 'V_CREDIT' | 'V_MEDAL'
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
          currency_type?: 'V_CREDIT' | 'V_MEDAL'
          user_email?: string | null
          user_name?: string | null
          donation_target_name?: string | null
          created_at?: string
        }
      }
      credit_lots: {
        Row: {
          lot_id: string
          user_id: string
          source_type: 'ACTIVITY' | 'MEDAL_EXCHANGE' | 'ADMIN_GRANT'
          initial_amount: number
          remaining_amount: number
          related_id: string | null
          description: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          lot_id?: string
          user_id: string
          source_type: 'ACTIVITY' | 'MEDAL_EXCHANGE' | 'ADMIN_GRANT'
          initial_amount: number
          remaining_amount: number
          related_id?: string | null
          description?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          lot_id?: string
          user_id?: string
          source_type?: 'ACTIVITY' | 'MEDAL_EXCHANGE' | 'ADMIN_GRANT'
          initial_amount?: number
          remaining_amount?: number
          related_id?: string | null
          description?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
      }
      donation_lot_allocations: {
        Row: {
          allocation_id: string
          donation_id: string
          lot_id: string
          allocated_amount: number
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          allocation_id?: string
          donation_id: string
          lot_id: string
          allocated_amount: number
          created_at?: string
          deleted_at?: string | null
        }
        Update: {
          allocation_id?: string
          donation_id?: string
          lot_id?: string
          allocated_amount?: number
          deleted_at?: string | null
        }
      }
      shop_products: {
        Row: {
          product_id: string
          name: string
          description: string | null
          product_type: 'GOODS' | 'CREDIT_PACK'
          price_medal: number
          credit_amount: number | null
          stock: number | null
          image_url: string | null
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          product_id?: string
          name: string
          description?: string | null
          product_type: 'GOODS' | 'CREDIT_PACK'
          price_medal: number
          credit_amount?: number | null
          stock?: number | null
          image_url?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          product_id?: string
          name?: string
          description?: string | null
          product_type?: 'GOODS' | 'CREDIT_PACK'
          price_medal?: number
          credit_amount?: number | null
          stock?: number | null
          image_url?: string | null
          is_active?: boolean
          created_by?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
      }
      shop_orders: {
        Row: {
          order_id: string
          user_id: string
          product_id: string
          product_snapshot_name: string
          product_type: 'GOODS' | 'CREDIT_PACK'
          payment_medal: number
          credit_granted: number
          status: 'COMPLETED' | 'CANCELLED'
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          order_id?: string
          user_id: string
          product_id: string
          product_snapshot_name: string
          product_type: 'GOODS' | 'CREDIT_PACK'
          payment_medal: number
          credit_granted?: number
          status?: 'COMPLETED' | 'CANCELLED'
          created_at?: string
          deleted_at?: string | null
        }
        Update: {
          order_id?: string
          user_id?: string
          product_id?: string
          product_snapshot_name?: string
          product_type?: 'GOODS' | 'CREDIT_PACK'
          payment_medal?: number
          credit_granted?: number
          status?: 'COMPLETED' | 'CANCELLED'
          deleted_at?: string | null
        }
      }
      event_rewards: {
        Row: {
          reward_id: string
          event_id: string
          reward_kind: 'V_CREDIT' | 'V_MEDAL' | 'GOODS' | 'COFFEE_COUPON'
          amount: number | null
          display_order: number
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          reward_id?: string
          event_id: string
          reward_kind: 'V_CREDIT' | 'V_MEDAL' | 'GOODS' | 'COFFEE_COUPON'
          amount?: number | null
          display_order?: number
          created_at?: string
          deleted_at?: string | null
        }
        Update: {
          reward_id?: string
          event_id?: string
          reward_kind?: 'V_CREDIT' | 'V_MEDAL' | 'GOODS' | 'COFFEE_COUPON'
          amount?: number | null
          display_order?: number
          deleted_at?: string | null
        }
      }
      events: {
        Row: {
          event_id: string
          title: string
          description: string | null
          short_description: string | null
          category: 'PEOPLE' | 'CULTURE'
          type: 'ALWAYS' | 'SEASONAL'
          reward_policy: 'SENDER_ONLY' | 'BOTH'
          reward_type: 'V_CREDIT' | 'COUPON' | 'CHOICE'
          reward_amount: number | null
          image_url: string | null
          status: 'ACTIVE' | 'PAUSED' | 'ENDED'
          frequency_limit: 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          event_id?: string
          title: string
          description?: string | null
          short_description?: string | null
          category: 'PEOPLE' | 'CULTURE'
          type: 'ALWAYS' | 'SEASONAL'
          reward_policy: 'SENDER_ONLY' | 'BOTH'
          reward_type: 'V_CREDIT' | 'COUPON' | 'CHOICE'
          reward_amount?: number | null
          image_url?: string | null
          status?: 'ACTIVE' | 'PAUSED' | 'ENDED'
          frequency_limit?: 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          short_description?: string | null
          category?: 'PEOPLE' | 'CULTURE'
          type?: 'ALWAYS' | 'SEASONAL'
          reward_policy?: 'SENDER_ONLY' | 'BOTH'
          reward_type?: 'V_CREDIT' | 'COUPON' | 'CHOICE'
          reward_amount?: number | null
          image_url?: string | null
          status?: 'ACTIVE' | 'PAUSED' | 'ENDED'
          frequency_limit?: 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | null
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
          is_anonymous: boolean
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
          is_anonymous?: boolean
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
          is_anonymous?: boolean
          reward_received?: boolean
          reward_type?: string | null
          reward_amount?: number | null
          rejection_reason?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          updated_at?: string
        }
      }
      health_challenge_seasons: {
        Row: {
          season_id: string
          name: string
          slug: string
          starts_at: string
          ends_at: string
          timezone: string
          status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
          event_id: string | null
          criteria_attachment_url: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          season_id?: string
          name: string
          slug: string
          starts_at: string
          ends_at: string
          timezone?: string
          status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
          event_id?: string | null
          criteria_attachment_url?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          name?: string
          slug?: string
          starts_at?: string
          ends_at?: string
          timezone?: string
          status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
          event_id?: string | null
          criteria_attachment_url?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
      }
      health_challenge_tracks: {
        Row: {
          track_id: string
          season_id: string
          kind: string
          title: string
          sort_order: number
          metric: 'DISTANCE_KM' | 'ELEVATION_M'
          min_distance_km: number | null
          min_speed_kmh: number | null
          min_elevation_m: number | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          track_id?: string
          season_id: string
          kind: string
          title: string
          sort_order?: number
          metric: 'DISTANCE_KM' | 'ELEVATION_M'
          min_distance_km?: number | null
          min_speed_kmh?: number | null
          min_elevation_m?: number | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          title?: string
          sort_order?: number
          metric?: 'DISTANCE_KM' | 'ELEVATION_M'
          min_distance_km?: number | null
          min_speed_kmh?: number | null
          min_elevation_m?: number | null
          updated_at?: string
          deleted_at?: string | null
        }
      }
      health_challenge_level_thresholds: {
        Row: {
          threshold_id: string
          track_id: string
          level: number
          target_value: number
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          threshold_id?: string
          track_id: string
          level: number
          target_value: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          target_value?: number
          updated_at?: string
          deleted_at?: string | null
        }
      }
      health_challenge_activity_logs: {
        Row: {
          log_id: string
          season_id: string
          track_id: string
          user_id: string
          activity_date: string
          distance_km: number | null
          speed_kmh: number | null
          elevation_m: number | null
          photo_urls: Json
          status: 'PENDING' | 'APPROVED' | 'REJECTED'
          contributed_value: number | null
          rejection_reason: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          log_id?: string
          season_id: string
          track_id: string
          user_id: string
          activity_date: string
          distance_km?: number | null
          speed_kmh?: number | null
          elevation_m?: number | null
          photo_urls?: Json
          status?: 'PENDING' | 'APPROVED' | 'REJECTED'
          contributed_value?: number | null
          rejection_reason?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          status?: 'PENDING' | 'APPROVED' | 'REJECTED'
          contributed_value?: number | null
          rejection_reason?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
      }
      health_challenge_monthly_rollups: {
        Row: {
          rollup_id: string
          season_id: string
          track_id: string
          user_id: string
          year: number
          month: number
          approved_total: number
          achieved_level: number
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          rollup_id?: string
          season_id: string
          track_id: string
          user_id: string
          year: number
          month: number
          approved_total?: number
          achieved_level?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          approved_total?: number
          achieved_level?: number
          updated_at?: string
          deleted_at?: string | null
        }
      }
      health_challenge_monthly_settlements: {
        Row: {
          settlement_id: string
          season_id: string
          user_id: string
          year: number
          month: number
          level_sum: number
          medal_amount: number
          status: 'PENDING' | 'PAID'
          paid_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          settlement_id?: string
          season_id: string
          user_id: string
          year: number
          month: number
          level_sum?: number
          medal_amount?: number
          status?: 'PENDING' | 'PAID'
          paid_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          level_sum?: number
          medal_amount?: number
          status?: 'PENDING' | 'PAID'
          paid_at?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
      }
    }
  }
}
