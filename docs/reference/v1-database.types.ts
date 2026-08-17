export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  analytics: {
    Tables: {
      company_customer_daily_stats: {
        Row: {
          company_id: string
          customer_id: string
          date: string
          order_count: number
          total_spent: number
          updated_at: string
        }
        Insert: {
          company_id: string
          customer_id: string
          date: string
          order_count?: number
          total_spent?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          customer_id?: string
          date?: string
          order_count?: number
          total_spent?: number
          updated_at?: string
        }
        Relationships: []
      }
      company_daily_stats: {
        Row: {
          company_id: string
          date: string
          new_customers: number
          order_count: number
          paid_revenue: number
          total_revenue: number
          updated_at: string
        }
        Insert: {
          company_id: string
          date: string
          new_customers?: number
          order_count?: number
          paid_revenue?: number
          total_revenue?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          date?: string
          new_customers?: number
          order_count?: number
          paid_revenue?: number
          total_revenue?: number
          updated_at?: string
        }
        Relationships: []
      }
      company_product_daily_stats: {
        Row: {
          company_id: string
          date: string
          order_count: number
          product_id: string
          quantity_sold: number
          revenue: number
          updated_at: string
        }
        Insert: {
          company_id: string
          date: string
          order_count?: number
          product_id: string
          quantity_sold?: number
          revenue?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          date?: string
          order_count?: number
          product_id?: string
          quantity_sold?: number
          revenue?: number
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          company_id: string | null
          created_at: string
          customer_id: string | null
          event_name: string
          id: number
          properties: Json
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          event_name: string
          id?: never
          properties?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          event_name?: string
          id?: never
          properties?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      events_default: {
        Row: {
          company_id: string | null
          created_at: string
          customer_id: string | null
          event_name: string
          id: number
          properties: Json
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          event_name: string
          id?: never
          properties?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          event_name?: string
          id?: never
          properties?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      events_p20260401: {
        Row: {
          company_id: string | null
          created_at: string
          customer_id: string | null
          event_name: string
          id: number
          properties: Json
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          event_name: string
          id?: never
          properties?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          event_name?: string
          id?: never
          properties?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      events_p20260501: {
        Row: {
          company_id: string | null
          created_at: string
          customer_id: string | null
          event_name: string
          id: number
          properties: Json
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          event_name: string
          id?: never
          properties?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          event_name?: string
          id?: never
          properties?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      events_p20260601: {
        Row: {
          company_id: string | null
          created_at: string
          customer_id: string | null
          event_name: string
          id: number
          properties: Json
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          event_name: string
          id?: never
          properties?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          event_name?: string
          id?: never
          properties?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      events_p20260701: {
        Row: {
          company_id: string | null
          created_at: string
          customer_id: string | null
          event_name: string
          id: number
          properties: Json
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          event_name: string
          id?: never
          properties?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          event_name?: string
          id?: never
          properties?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      backfill_company_stats: {
        Args: { p_company_id: string; p_from_date?: string; p_to_date?: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bank_transactions: {
        Row: {
          account_iban: string | null
          amount: number
          comment: string | null
          company_id: string
          counterparty_edrpou: string | null
          counterparty_iban: string | null
          counterparty_name: string | null
          created_at: string | null
          currency_code: number | null
          description: string | null
          external_id: string
          id: string
          integration_id: string
          is_income: boolean | null
          match_type: string | null
          matched_order_id: string | null
          matched_payment_id: string | null
          mcc: number | null
          raw_data: Json | null
          transaction_time: string
        }
        Insert: {
          account_iban?: string | null
          amount: number
          comment?: string | null
          company_id: string
          counterparty_edrpou?: string | null
          counterparty_iban?: string | null
          counterparty_name?: string | null
          created_at?: string | null
          currency_code?: number | null
          description?: string | null
          external_id: string
          id?: string
          integration_id: string
          is_income?: boolean | null
          match_type?: string | null
          matched_order_id?: string | null
          matched_payment_id?: string | null
          mcc?: number | null
          raw_data?: Json | null
          transaction_time: string
        }
        Update: {
          account_iban?: string | null
          amount?: number
          comment?: string | null
          company_id?: string
          counterparty_edrpou?: string | null
          counterparty_iban?: string | null
          counterparty_name?: string | null
          created_at?: string | null
          currency_code?: number | null
          description?: string | null
          external_id?: string
          id?: string
          integration_id?: string
          is_income?: boolean | null
          match_type?: string | null
          matched_order_id?: string | null
          matched_payment_id?: string | null
          mcc?: number | null
          raw_data?: Json | null
          transaction_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "company_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_order_id_fkey"
            columns: ["matched_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_matched_payment_id_fkey"
            columns: ["matched_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      business_categories: {
        Row: {
          created_at: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          name_en: string
          name_uk: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_en: string
          name_uk: string
          slug: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_en?: string
          name_uk?: string
          slug?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string | null
          id: string
          price: number
          product_id: string
          quantity: number
        }
        Insert: {
          cart_id: string
          created_at?: string | null
          id?: string
          price: number
          product_id: string
          quantity?: number
        }
        Update: {
          cart_id?: string
          created_at?: string | null
          id?: string
          price?: number
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "consumer_products_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_view"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          company_id: string | null
          company_slug: string | null
          created_at: string | null
          id: string
          total_price: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          company_slug?: string | null
          created_at?: string | null
          id?: string
          total_price?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          company_slug?: string | null
          created_at?: string | null
          id?: string
          total_price?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_sessions: {
        Row: {
          cart_id: string
          company_id: string
          completed_order_id: string | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_info: Json | null
          delivery_method: string | null
          expires_at: string | null
          id: string
          notes: string | null
          payment_method: string | null
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cart_id: string
          company_id: string
          completed_order_id?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_info?: Json | null
          delivery_method?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cart_id?: string
          company_id?: string
          completed_order_id?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_info?: Json | null
          delivery_method?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkout_sessions_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_completed_order_id_fkey"
            columns: ["completed_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          about_html: string | null
          address: string | null
          area: string | null
          bio: string | null
          city: string | null
          city_ref: string | null
          created_at: string | null
          email: string | null
          embedding: string | null
          followers_count: number
          fts: unknown
          id: string
          keywords: string[] | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          orders_count: number
          phone: string | null
          prefix: string
          products_count: number
          reviews_enabled: boolean | null
          slug: string
          updated_at: string | null
          working_hours: Json | null
        }
        Insert: {
          about_html?: string | null
          address?: string | null
          area?: string | null
          bio?: string | null
          city?: string | null
          city_ref?: string | null
          created_at?: string | null
          email?: string | null
          embedding?: string | null
          followers_count?: number
          fts?: unknown
          id?: string
          keywords?: string[] | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          orders_count?: number
          phone?: string | null
          prefix: string
          products_count?: number
          reviews_enabled?: boolean | null
          slug: string
          updated_at?: string | null
          working_hours?: Json | null
        }
        Update: {
          about_html?: string | null
          address?: string | null
          area?: string | null
          bio?: string | null
          city?: string | null
          city_ref?: string | null
          created_at?: string | null
          email?: string | null
          embedding?: string | null
          followers_count?: number
          fts?: unknown
          id?: string
          keywords?: string[] | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          orders_count?: number
          phone?: string | null
          prefix?: string
          products_count?: number
          reviews_enabled?: boolean | null
          slug?: string
          updated_at?: string | null
          working_hours?: Json | null
        }
        Relationships: []
      }
      company_business_categories: {
        Row: {
          category_id: string
          company_id: string
        }
        Insert: {
          category_id: string
          company_id: string
        }
        Update: {
          category_id?: string
          company_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_business_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "business_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_business_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_customer_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          company_customer_id: string | null
          company_id: string
          created_at: string
          email: string | null
          expires_at: string
          group_id: string | null
          id: string
          invited_by: string
          is_reusable: boolean
          max_uses: number | null
          name: string | null
          phone: string | null
          price_list_id: string | null
          status: string
          token: string
          updated_at: string
          uses_count: number
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_customer_id?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          expires_at?: string
          group_id?: string | null
          id?: string
          invited_by: string
          is_reusable?: boolean
          max_uses?: number | null
          name?: string | null
          phone?: string | null
          price_list_id?: string | null
          status?: string
          token?: string
          updated_at?: string
          uses_count?: number
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          company_customer_id?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          group_id?: string | null
          id?: string
          invited_by?: string
          is_reusable?: boolean
          max_uses?: number | null
          name?: string | null
          phone?: string | null
          price_list_id?: string | null
          status?: string
          token?: string
          updated_at?: string
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_customer_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_customer_invites_company_customer_id_fkey"
            columns: ["company_customer_id"]
            isOneToOne: false
            referencedRelation: "company_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_customer_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_customer_invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "customer_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_customer_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_customer_invites_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      company_customers: {
        Row: {
          company_id: string
          created_at: string | null
          email: string | null
          embedding: string | null
          group_id: string | null
          id: string
          invite_id: string | null
          name: string
          notes: string | null
          phone: string | null
          price_list_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          email?: string | null
          embedding?: string | null
          group_id?: string | null
          id?: string
          invite_id?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          price_list_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          email?: string | null
          embedding?: string | null
          group_id?: string | null
          id?: string
          invite_id?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          price_list_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_customers_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "customer_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_customers_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "company_customer_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_customers_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      company_delivery_methods: {
        Row: {
          company_id: string
          config: Json
          created_at: string | null
          display_order: number | null
          id: string
          is_enabled: boolean | null
          method: Database["public"]["Enums"]["delivery_method_type"]
          updated_at: string | null
        }
        Insert: {
          company_id: string
          config?: Json
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_enabled?: boolean | null
          method: Database["public"]["Enums"]["delivery_method_type"]
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          config?: Json
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_enabled?: boolean | null
          method?: Database["public"]["Enums"]["delivery_method_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_delivery_methods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_feature_overrides: {
        Row: {
          company_id: string
          created_at: string | null
          enabled: boolean
          expires_at: string | null
          feature_key: string
          id: string
          reason: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          enabled: boolean
          expires_at?: string | null
          feature_key: string
          id?: string
          reason?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          enabled?: boolean
          expires_at?: string | null
          feature_key?: string
          id?: string
          reason?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_feature_overrides_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_feature_overrides_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "feature_flags"
            referencedColumns: ["key"]
          },
        ]
      }
      company_follows: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_follows_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      company_integrations: {
        Row: {
          category: string
          company_id: string
          config: Json | null
          created_at: string | null
          display_name: string | null
          id: string
          is_active: boolean | null
          last_api_call_at: string | null
          last_error: string | null
          last_synced_at: string | null
          next_sync_at: string | null
          provider: string
          status: string
          sync_cursor: Json | null
          sync_status: string | null
          updated_at: string | null
          webhook_id: string | null
        }
        Insert: {
          category?: string
          company_id: string
          config?: Json | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          last_api_call_at?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          next_sync_at?: string | null
          provider: string
          status?: string
          sync_cursor?: Json | null
          sync_status?: string | null
          updated_at?: string | null
          webhook_id?: string | null
        }
        Update: {
          category?: string
          company_id?: string
          config?: Json | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          last_api_call_at?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          next_sync_at?: string | null
          provider?: string
          status?: string
          sync_cursor?: Json | null
          sync_status?: string | null
          updated_at?: string | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_legal_info: {
        Row: {
          bank_edrpou: string | null
          bank_mfo: string | null
          bank_name: string | null
          company_id: string
          company_type: string
          created_at: string
          edrpou: string | null
          email: string | null
          iban: string | null
          id: string
          legal_address: string | null
          legal_name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          bank_edrpou?: string | null
          bank_mfo?: string | null
          bank_name?: string | null
          company_id: string
          company_type?: string
          created_at?: string
          edrpou?: string | null
          email?: string | null
          iban?: string | null
          id?: string
          legal_address?: string | null
          legal_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          bank_edrpou?: string | null
          bank_mfo?: string | null
          bank_name?: string | null
          company_id?: string
          company_type?: string
          created_at?: string
          edrpou?: string | null
          email?: string | null
          iban?: string | null
          id?: string
          legal_address?: string | null
          legal_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_legal_info_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          permissions: Json | null
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          permissions?: Json | null
          role?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          permissions?: Json | null
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      company_sku_sequences: {
        Row: {
          company_id: string
          next_val: number
        }
        Insert: {
          company_id: string
          next_val?: number
        }
        Update: {
          company_id?: string
          next_val?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_sku_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_socials: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          platform: string
          updated_at: string | null
          url: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          platform: string
          updated_at?: string | null
          url: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          platform?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_socials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_statuses: {
        Row: {
          code: string
          color: string | null
          company_id: string
          created_at: string | null
          entity_type: string
          icon: string | null
          id: string
          is_default: boolean | null
          is_final: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          code: string
          color?: string | null
          company_id: string
          created_at?: string | null
          entity_type: string
          icon?: string | null
          id?: string
          is_default?: boolean | null
          is_final?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          color?: string | null
          company_id?: string
          created_at?: string | null
          entity_type?: string
          icon?: string | null
          id?: string
          is_default?: boolean | null
          is_final?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_statuses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_subscriptions: {
        Row: {
          cancelled_at: string | null
          company_id: string
          created_at: string | null
          current_period_end: string
          current_period_start: string
          external_customer_id: string | null
          external_subscription_id: string | null
          id: string
          metadata: Json | null
          plan_id: string
          status: string
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          cancelled_at?: string | null
          company_id: string
          created_at?: string | null
          current_period_end: string
          current_period_start?: string
          external_customer_id?: string | null
          external_subscription_id?: string | null
          id?: string
          metadata?: Json | null
          plan_id: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          cancelled_at?: string | null
          company_id?: string
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          external_customer_id?: string | null
          external_subscription_id?: string | null
          id?: string
          metadata?: Json | null
          plan_id?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          created_at: string | null
          id: string
          last_seen_at: string | null
          last_seen_message_id: string | null
          notifications_enabled: boolean
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          id?: string
          last_seen_at?: string | null
          last_seen_message_id?: string | null
          notifications_enabled?: boolean
          role?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          id?: string
          last_seen_at?: string | null
          last_seen_message_id?: string | null
          notifications_enabled?: boolean
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_last_seen_message_id_fkey"
            columns: ["last_seen_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_to: string | null
          channel: string
          company_id: string
          company_unread_count: number
          created_at: string | null
          customer_name: string | null
          customer_unread_count: number
          customer_user_id: string | null
          external_contact_id: string | null
          id: string
          last_message_at: string | null
          last_message_by: string | null
          last_message_content_type: string
          last_message_text: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          channel?: string
          company_id: string
          company_unread_count?: number
          created_at?: string | null
          customer_name?: string | null
          customer_unread_count?: number
          customer_user_id?: string | null
          external_contact_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_by?: string | null
          last_message_content_type?: string
          last_message_text?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          channel?: string
          company_id?: string
          company_unread_count?: number
          created_at?: string | null
          customer_name?: string | null
          customer_unread_count?: number
          customer_user_id?: string | null
          external_contact_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_by?: string | null
          last_message_content_type?: string
          last_message_text?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      counterparties: {
        Row: {
          bank_mfo: string | null
          bank_name: string | null
          company_id: string
          created_at: string
          customer_id: string | null
          edrpou: string | null
          email: string | null
          iban: string | null
          id: string
          legal_address: string | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bank_mfo?: string | null
          bank_name?: string | null
          company_id: string
          created_at?: string
          customer_id?: string | null
          edrpou?: string | null
          email?: string | null
          iban?: string | null
          id?: string
          legal_address?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bank_mfo?: string | null
          bank_name?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string | null
          edrpou?: string | null
          email?: string | null
          iban?: string | null
          id?: string
          legal_address?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "counterparties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counterparties_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "company_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counterparties_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cpv_codes: {
        Row: {
          code: string
          level: number
          name_en: string | null
          name_uk: string
          parent_code: string | null
          search_vector: unknown
        }
        Insert: {
          code: string
          level: number
          name_en?: string | null
          name_uk: string
          parent_code?: string | null
          search_vector?: unknown
        }
        Update: {
          code?: string
          level?: number
          name_en?: string | null
          name_uk?: string
          parent_code?: string | null
          search_vector?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "cpv_codes_parent_code_fkey"
            columns: ["parent_code"]
            isOneToOne: false
            referencedRelation: "cpv_codes"
            referencedColumns: ["code"]
          },
        ]
      }
      customer_groups: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          price_list_id: string | null
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          price_list_id?: string | null
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          price_list_id?: string | null
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_groups_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_legal_info: {
        Row: {
          bank_mfo: string | null
          bank_name: string | null
          created_at: string
          edrpou: string | null
          email: string | null
          entity_type: string
          iban: string | null
          id: string
          legal_address: string | null
          legal_name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_mfo?: string | null
          bank_name?: string | null
          created_at?: string
          edrpou?: string | null
          email?: string | null
          entity_type?: string
          iban?: string | null
          id?: string
          legal_address?: string | null
          legal_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_mfo?: string | null
          bank_name?: string | null
          created_at?: string
          edrpou?: string | null
          email?: string | null
          entity_type?: string
          iban?: string | null
          id?: string
          legal_address?: string | null
          legal_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_legal_info_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_product_prices: {
        Row: {
          company_id: string
          created_at: string | null
          customer_id: string
          id: string
          price: number
          product_id: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          customer_id: string
          id?: string
          price: number
          product_id: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          customer_id?: string
          id?: string
          price?: number
          product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_product_prices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_product_prices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "company_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "consumer_products_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_view"
            referencedColumns: ["id"]
          },
        ]
      }
      default_document_templates: {
        Row: {
          content: Json
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          content: Json
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_cities: {
        Row: {
          area_en: string | null
          area_uk: string | null
          city_ref: string
          created_at: string | null
          id: string
          is_popular: boolean | null
          latitude: number | null
          longitude: number | null
          name_en: string | null
          name_uk: string
          provider: string
          region_en: string | null
          region_uk: string | null
          settlement_ref: string | null
          settlement_type: string | null
          updated_at: string | null
        }
        Insert: {
          area_en?: string | null
          area_uk?: string | null
          city_ref: string
          created_at?: string | null
          id?: string
          is_popular?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name_en?: string | null
          name_uk: string
          provider: string
          region_en?: string | null
          region_uk?: string | null
          settlement_ref?: string | null
          settlement_type?: string | null
          updated_at?: string | null
        }
        Update: {
          area_en?: string | null
          area_uk?: string | null
          city_ref?: string
          created_at?: string | null
          id?: string
          is_popular?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name_en?: string | null
          name_uk?: string
          provider?: string
          region_en?: string | null
          region_uk?: string | null
          settlement_ref?: string | null
          settlement_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      delivery_streets: {
        Row: {
          city_ref: string
          created_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name_en: string | null
          name_uk: string
          provider: string
          settlement_ref: string | null
          street_ref: string
          street_type: string | null
          updated_at: string | null
        }
        Insert: {
          city_ref: string
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name_en?: string | null
          name_uk: string
          provider: string
          settlement_ref?: string | null
          street_ref: string
          street_type?: string | null
          updated_at?: string | null
        }
        Update: {
          city_ref?: string
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name_en?: string | null
          name_uk?: string
          provider?: string
          settlement_ref?: string | null
          street_ref?: string
          street_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      delivery_warehouses: {
        Row: {
          city_ref: string
          created_at: string | null
          full_address: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          max_weight_kg: number | null
          name_en: string | null
          name_uk: string
          number: string
          phone: string | null
          provider: string
          schedule_fri: string | null
          schedule_mon: string | null
          schedule_sat: string | null
          schedule_sun: string | null
          schedule_thu: string | null
          schedule_tue: string | null
          schedule_wed: string | null
          settlement_ref: string | null
          short_address: string | null
          updated_at: string | null
          warehouse_ref: string
          warehouse_type: string
        }
        Insert: {
          city_ref: string
          created_at?: string | null
          full_address?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          max_weight_kg?: number | null
          name_en?: string | null
          name_uk: string
          number: string
          phone?: string | null
          provider: string
          schedule_fri?: string | null
          schedule_mon?: string | null
          schedule_sat?: string | null
          schedule_sun?: string | null
          schedule_thu?: string | null
          schedule_tue?: string | null
          schedule_wed?: string | null
          settlement_ref?: string | null
          short_address?: string | null
          updated_at?: string | null
          warehouse_ref: string
          warehouse_type: string
        }
        Update: {
          city_ref?: string
          created_at?: string | null
          full_address?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          max_weight_kg?: number | null
          name_en?: string | null
          name_uk?: string
          number?: string
          phone?: string | null
          provider?: string
          schedule_fri?: string | null
          schedule_mon?: string | null
          schedule_sat?: string | null
          schedule_sun?: string | null
          schedule_thu?: string | null
          schedule_tue?: string | null
          schedule_wed?: string | null
          settlement_ref?: string | null
          short_address?: string | null
          updated_at?: string | null
          warehouse_ref?: string
          warehouse_type?: string
        }
        Relationships: []
      }
      document_number_counters: {
        Row: {
          company_id: string
          last_number: number
          type: string
          year: number
        }
        Insert: {
          company_id: string
          last_number?: number
          type: string
          year?: number
        }
        Update: {
          company_id?: string
          last_number?: number
          type?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_number_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      document_signatures: {
        Row: {
          created_at: string
          document_id: string
          id: string
          signature_algorithm: string | null
          signature_url: string
          signed_at: string
          signed_by: string | null
          signer_cn: string | null
          signer_org: string | null
          signer_role: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          signature_algorithm?: string | null
          signature_url: string
          signed_at?: string
          signed_by?: string | null
          signer_cn?: string | null
          signer_org?: string | null
          signer_role: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          signature_algorithm?: string | null
          signature_url?: string
          signed_at?: string
          signed_by?: string | null
          signer_cn?: string | null
          signer_org?: string | null
          signer_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_signatures_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signatures_signed_by_fkey"
            columns: ["signed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          company_id: string
          content: Json | null
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          content?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          content?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          additional_terms: string | null
          agreement_id: string | null
          buyer_details: Json | null
          company_id: string
          content: Json | null
          counterparty_id: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          deleted_at: string | null
          document_number: string
          docx_url: string | null
          id: string
          items: Json | null
          notes: string | null
          order_id: string | null
          payment_due_date: string | null
          pdf_url: string | null
          signature_algorithm: string | null
          signature_status: string
          signature_url: string | null
          signed_at: string | null
          signed_by: string | null
          signer_cn: string | null
          signer_org: string | null
          status: string
          supplier_details: Json | null
          template_id: string | null
          template_name: string | null
          template_source: string
          total_amount: number | null
          type: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          additional_terms?: string | null
          agreement_id?: string | null
          buyer_details?: Json | null
          company_id: string
          content?: Json | null
          counterparty_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deleted_at?: string | null
          document_number: string
          docx_url?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          order_id?: string | null
          payment_due_date?: string | null
          pdf_url?: string | null
          signature_algorithm?: string | null
          signature_status?: string
          signature_url?: string | null
          signed_at?: string | null
          signed_by?: string | null
          signer_cn?: string | null
          signer_org?: string | null
          status?: string
          supplier_details?: Json | null
          template_id?: string | null
          template_name?: string | null
          template_source?: string
          total_amount?: number | null
          type: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          additional_terms?: string | null
          agreement_id?: string | null
          buyer_details?: Json | null
          company_id?: string
          content?: Json | null
          counterparty_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deleted_at?: string | null
          document_number?: string
          docx_url?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          order_id?: string | null
          payment_due_date?: string | null
          pdf_url?: string | null
          signature_algorithm?: string | null
          signature_status?: string
          signature_url?: string | null
          signed_at?: string | null
          signed_by?: string | null
          signer_cn?: string | null
          signer_org?: string | null
          status?: string
          supplier_details?: Json | null
          template_id?: string | null
          template_name?: string | null
          template_source?: string
          total_amount?: number | null
          type?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_counterparty_id_fkey"
            columns: ["counterparty_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_signed_by_fkey"
            columns: ["signed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_events: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          company_id: string | null
          created_at: string
          event_type: string
          id: number
          last_error: string | null
          locked_by: string | null
          locked_until: string | null
          max_retries: number
          payload: Json
          processed_at: string | null
          retry_count: number
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          company_id?: string | null
          created_at?: string
          event_type: string
          id?: never
          last_error?: string | null
          locked_by?: string | null
          locked_until?: string | null
          max_retries?: number
          payload?: Json
          processed_at?: string | null
          retry_count?: number
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          company_id?: string | null
          created_at?: string
          event_type?: string
          id?: never
          last_error?: string | null
          locked_by?: string | null
          locked_until?: string | null
          max_retries?: number
          payload?: Json
          processed_at?: string | null
          retry_count?: number
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      integration_secrets: {
        Row: {
          created_at: string | null
          id: string
          integration_id: string
          secret_id: string
          secret_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          integration_id: string
          secret_id: string
          secret_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          integration_id?: string
          secret_id?: string
          secret_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_secrets_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "company_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      kved_codes: {
        Row: {
          code: string
          level: number
          name_uk: string
          parent_code: string | null
          search_vector: unknown
        }
        Insert: {
          code: string
          level: number
          name_uk: string
          parent_code?: string | null
          search_vector?: unknown
        }
        Update: {
          code?: string
          level?: number
          name_uk?: string
          parent_code?: string | null
          search_vector?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "kved_codes_parent_code_fkey"
            columns: ["parent_code"]
            isOneToOne: false
            referencedRelation: "kved_codes"
            referencedColumns: ["code"]
          },
        ]
      }
      message_mentions: {
        Row: {
          company_id: string
          created_at: string | null
          end_index: number | null
          entity_id: string
          entity_snapshot: Json
          entity_type: string
          id: string
          message_id: string
          start_index: number | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          end_index?: number | null
          entity_id: string
          entity_snapshot?: Json
          entity_type: string
          id?: string
          message_id: string
          start_index?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          end_index?: number | null
          entity_id?: string
          entity_snapshot?: Json
          entity_type?: string
          id?: string
          message_id?: string
          start_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "message_mentions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_mentions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          channel_metadata: Json | null
          company_id: string
          content: string
          content_type: string
          conversation_id: string
          created_at: string | null
          deleted_at: string | null
          edited_at: string | null
          external_message_id: string | null
          id: string
          metadata: Json | null
          sender_name: string
          sender_type: string
          sender_user_id: string | null
          sequence_number: number
          status: string
        }
        Insert: {
          channel_metadata?: Json | null
          company_id: string
          content: string
          content_type?: string
          conversation_id: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          external_message_id?: string | null
          id?: string
          metadata?: Json | null
          sender_name: string
          sender_type: string
          sender_user_id?: string | null
          sequence_number?: number
          status?: string
        }
        Update: {
          channel_metadata?: Json | null
          company_id?: string
          content?: string
          content_type?: string
          conversation_id?: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          external_message_id?: string | null
          id?: string
          metadata?: Json | null
          sender_name?: string
          sender_type?: string
          sender_user_id?: string | null
          sequence_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_contacts: {
        Row: {
          channel: string
          company_id: string
          created_at: string | null
          display_name: string | null
          external_id: string
          id: string
          linked_customer_id: string | null
          profile_pic_url: string | null
          raw_profile: Json | null
          updated_at: string | null
        }
        Insert: {
          channel: string
          company_id: string
          created_at?: string | null
          display_name?: string | null
          external_id: string
          id?: string
          linked_customer_id?: string | null
          profile_pic_url?: string | null
          raw_profile?: Json | null
          updated_at?: string | null
        }
        Update: {
          channel?: string
          company_id?: string
          created_at?: string | null
          display_name?: string | null
          external_id?: string
          id?: string
          linked_customer_id?: string | null
          profile_pic_url?: string | null
          raw_profile?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messaging_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messaging_contacts_linked_customer_id_fkey"
            columns: ["linked_customer_id"]
            isOneToOne: false
            referencedRelation: "company_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_data_deletion_requests: {
        Row: {
          completed_at: string | null
          confirmation_code: string
          created_at: string | null
          id: string
          meta_user_id: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          confirmation_code: string
          created_at?: string | null
          id?: string
          meta_user_id: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          confirmation_code?: string
          created_at?: string | null
          id?: string
          meta_user_id?: string
          status?: string
        }
        Relationships: []
      }
      mono_acquiring_invoices: {
        Row: {
          amount: number
          cancel_list: Json | null
          ccy: number | null
          company_id: string
          created_at: string | null
          destination: string | null
          err_code: string | null
          expires_at: string | null
          failure_reason: string | null
          finalized_at: string | null
          fiscal_check_id: string | null
          fiscal_status: string | null
          fiscal_tax_url: string | null
          id: string
          integration_id: string
          invoice_id: string
          order_id: string | null
          page_url: string | null
          payment_id: string | null
          payment_info: Json | null
          payment_type: string
          receipt_fetched_at: string | null
          receipt_url: string | null
          reference: string | null
          status: string
          updated_at: string | null
          validity_seconds: number | null
          webhook_url: string | null
        }
        Insert: {
          amount: number
          cancel_list?: Json | null
          ccy?: number | null
          company_id: string
          created_at?: string | null
          destination?: string | null
          err_code?: string | null
          expires_at?: string | null
          failure_reason?: string | null
          finalized_at?: string | null
          fiscal_check_id?: string | null
          fiscal_status?: string | null
          fiscal_tax_url?: string | null
          id?: string
          integration_id: string
          invoice_id: string
          order_id?: string | null
          page_url?: string | null
          payment_id?: string | null
          payment_info?: Json | null
          payment_type?: string
          receipt_fetched_at?: string | null
          receipt_url?: string | null
          reference?: string | null
          status?: string
          updated_at?: string | null
          validity_seconds?: number | null
          webhook_url?: string | null
        }
        Update: {
          amount?: number
          cancel_list?: Json | null
          ccy?: number | null
          company_id?: string
          created_at?: string | null
          destination?: string | null
          err_code?: string | null
          expires_at?: string | null
          failure_reason?: string | null
          finalized_at?: string | null
          fiscal_check_id?: string | null
          fiscal_status?: string | null
          fiscal_tax_url?: string | null
          id?: string
          integration_id?: string
          invoice_id?: string
          order_id?: string | null
          page_url?: string | null
          payment_id?: string | null
          payment_info?: Json | null
          payment_type?: string
          receipt_fetched_at?: string | null
          receipt_url?: string | null
          reference?: string | null
          status?: string
          updated_at?: string | null
          validity_seconds?: number | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mono_acquiring_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mono_acquiring_invoices_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "company_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mono_acquiring_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mono_acquiring_invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          clicked_at: string | null
          company_id: string | null
          created_at: string | null
          data: Json | null
          id: string
          read_at: string | null
          recipient_role: Database["public"]["Enums"]["notification_recipient_role"]
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          clicked_at?: string | null
          company_id?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          read_at?: string | null
          recipient_role: Database["public"]["Enums"]["notification_recipient_role"]
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          clicked_at?: string | null
          company_id?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          read_at?: string | null
          recipient_role?: Database["public"]["Enums"]["notification_recipient_role"]
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      order_deliveries: {
        Row: {
          actual_cost: number | null
          apartment: string | null
          building: string | null
          city_name: string | null
          city_ref: string | null
          company_id: string
          created_at: string | null
          customer_notes: string | null
          estimated_cost: number | null
          id: string
          internal_notes: string | null
          last_synced_at: string | null
          method: Database["public"]["Enums"]["delivery_method_type"]
          order_id: string
          pickup_address: string | null
          pickup_point_id: string | null
          pickup_point_name: string | null
          provider: string | null
          provider_shipment_ref: string | null
          provider_status: string | null
          provider_status_code: string | null
          status: Database["public"]["Enums"]["delivery_status"] | null
          street: string | null
          sub_type: Database["public"]["Enums"]["delivery_sub_type"] | null
          tracking_number: string | null
          updated_at: string | null
          warehouse_address: string | null
          warehouse_name: string | null
          warehouse_ref: string | null
          weight_kg: number | null
        }
        Insert: {
          actual_cost?: number | null
          apartment?: string | null
          building?: string | null
          city_name?: string | null
          city_ref?: string | null
          company_id: string
          created_at?: string | null
          customer_notes?: string | null
          estimated_cost?: number | null
          id?: string
          internal_notes?: string | null
          last_synced_at?: string | null
          method: Database["public"]["Enums"]["delivery_method_type"]
          order_id: string
          pickup_address?: string | null
          pickup_point_id?: string | null
          pickup_point_name?: string | null
          provider?: string | null
          provider_shipment_ref?: string | null
          provider_status?: string | null
          provider_status_code?: string | null
          status?: Database["public"]["Enums"]["delivery_status"] | null
          street?: string | null
          sub_type?: Database["public"]["Enums"]["delivery_sub_type"] | null
          tracking_number?: string | null
          updated_at?: string | null
          warehouse_address?: string | null
          warehouse_name?: string | null
          warehouse_ref?: string | null
          weight_kg?: number | null
        }
        Update: {
          actual_cost?: number | null
          apartment?: string | null
          building?: string | null
          city_name?: string | null
          city_ref?: string | null
          company_id?: string
          created_at?: string | null
          customer_notes?: string | null
          estimated_cost?: number | null
          id?: string
          internal_notes?: string | null
          last_synced_at?: string | null
          method?: Database["public"]["Enums"]["delivery_method_type"]
          order_id?: string
          pickup_address?: string | null
          pickup_point_id?: string | null
          pickup_point_name?: string | null
          provider?: string | null
          provider_shipment_ref?: string | null
          provider_status?: string | null
          provider_status_code?: string | null
          status?: Database["public"]["Enums"]["delivery_status"] | null
          street?: string | null
          sub_type?: Database["public"]["Enums"]["delivery_sub_type"] | null
          tracking_number?: string | null
          updated_at?: string | null
          warehouse_address?: string | null
          warehouse_name?: string | null
          warehouse_ref?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          order_id: string
          price: number
          product_id: string
          quantity: number
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          order_id: string
          price: number
          product_id: string
          quantity: number
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          order_id?: string
          price?: number
          product_id?: string
          quantity?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "consumer_products_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_view"
            referencedColumns: ["id"]
          },
        ]
      }
      order_logs: {
        Row: {
          action: Database["public"]["Enums"]["order_log_action"]
          company_id: string
          created_at: string | null
          id: string
          new_values: Json
          old_values: Json | null
          order_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["order_log_action"]
          company_id: string
          created_at?: string | null
          id?: string
          new_values: Json
          old_values?: Json | null
          order_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["order_log_action"]
          company_id?: string
          created_at?: string | null
          id?: string
          new_values?: Json
          old_values?: Json | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          comment: string | null
          company_id: string
          counterparty_id: string | null
          created_at: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_postal_code: string | null
          id: string
          idempotency_key: string | null
          notes: string | null
          order_number: string | null
          order_source: string
          payment_method: string | null
          payment_status: string
          status_id: string | null
          total_price: number
          tracking_token: string
          updated_at: string | null
        }
        Insert: {
          comment?: string | null
          company_id: string
          counterparty_id?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_postal_code?: string | null
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          order_number?: string | null
          order_source?: string
          payment_method?: string | null
          payment_status?: string
          status_id?: string | null
          total_price?: number
          tracking_token?: string
          updated_at?: string | null
        }
        Update: {
          comment?: string | null
          company_id?: string
          counterparty_id?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_postal_code?: string | null
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          order_number?: string | null
          order_source?: string
          payment_method?: string | null
          payment_status?: string
          status_id?: string | null
          total_price?: number
          tracking_token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_counterparty_id_fkey"
            columns: ["counterparty_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "company_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "company_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settings: {
        Row: {
          bank_notes: string | null
          bank_reference_template: string | null
          company_id: string | null
          created_at: string | null
          enabled_methods: string[] | null
          fiscal_tax_codes: number[] | null
          fiscalization_enabled: boolean | null
          id: string
          liqpay_sandbox: boolean | null
          mono_acquiring_enabled: boolean | null
          mono_acquiring_hold_mode: boolean | null
          updated_at: string | null
        }
        Insert: {
          bank_notes?: string | null
          bank_reference_template?: string | null
          company_id?: string | null
          created_at?: string | null
          enabled_methods?: string[] | null
          fiscal_tax_codes?: number[] | null
          fiscalization_enabled?: boolean | null
          id?: string
          liqpay_sandbox?: boolean | null
          mono_acquiring_enabled?: boolean | null
          mono_acquiring_hold_mode?: boolean | null
          updated_at?: string | null
        }
        Update: {
          bank_notes?: string | null
          bank_reference_template?: string | null
          company_id?: string | null
          created_at?: string | null
          enabled_methods?: string[] | null
          fiscal_tax_codes?: number[] | null
          fiscalization_enabled?: boolean | null
          id?: string
          liqpay_sandbox?: boolean | null
          mono_acquiring_enabled?: boolean | null
          mono_acquiring_hold_mode?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bank_matched_at: string | null
          bank_provider: string | null
          bank_transaction_id: string | null
          company_id: string
          completed_at: string | null
          created_at: string | null
          currency: string | null
          error_message: string | null
          id: string
          liqpay_order_id: string | null
          liqpay_payment_id: string | null
          liqpay_status: string | null
          metadata: Json | null
          method: string
          order_id: string | null
          reference_tag: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          bank_matched_at?: string | null
          bank_provider?: string | null
          bank_transaction_id?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          error_message?: string | null
          id?: string
          liqpay_order_id?: string | null
          liqpay_payment_id?: string | null
          liqpay_status?: string | null
          metadata?: Json | null
          method: string
          order_id?: string | null
          reference_tag?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          bank_matched_at?: string | null
          bank_provider?: string | null
          bank_transaction_id?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          error_message?: string | null
          id?: string
          liqpay_order_id?: string | null
          liqpay_payment_id?: string | null
          liqpay_status?: string | null
          metadata?: Json | null
          method?: string
          order_id?: string | null
          reference_tag?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_items: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          price: number
          price_list_id: string
          product_id: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          price: number
          price_list_id: string
          product_id: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          price?: number
          price_list_id?: string
          product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_list_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_items_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "consumer_products_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_view"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          code: string
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_lists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_comments: {
        Row: {
          company_id: string
          content: string
          created_at: string | null
          id: string
          is_company_reply: boolean
          parent_id: string | null
          product_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string | null
          id?: string
          is_company_reply?: boolean
          parent_id?: string | null
          product_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_company_reply?: boolean
          parent_id?: string | null
          product_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_comments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_comments_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_comments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "consumer_products_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_comments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_comments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          company_id: string
          created_at: string | null
          display_order: number
          id: string
          image_url: string
          is_primary: boolean
          product_id: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          display_order?: number
          id?: string
          image_url: string
          is_primary?: boolean
          product_id: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          display_order?: number
          id?: string
          image_url?: string
          is_primary?: boolean
          product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "consumer_products_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_view"
            referencedColumns: ["id"]
          },
        ]
      }
      product_likes: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_likes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_likes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "consumer_products_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_likes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_likes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_values: {
        Row: {
          created_at: string | null
          id: string
          option_id: string
          sort_order: number | null
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          option_id: string
          sort_order?: number | null
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          option_id?: string
          sort_order?: number | null
          updated_at?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_values_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          name: string
          product_id: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          name: string
          product_id: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          name?: string
          product_id?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_options_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "consumer_products_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_view"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variant_options: {
        Row: {
          id: string
          option_id: string
          option_value_id: string
          variant_id: string
        }
        Insert: {
          id?: string
          option_id: string
          option_value_id: string
          variant_id: string
        }
        Update: {
          id?: string
          option_id?: string
          option_value_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variant_options_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variant_options_option_value_id_fkey"
            columns: ["option_value_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variant_options_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          allow_backorders: boolean | null
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          product_id: string
          sku: string | null
          sort_order: number | null
          stock_quantity: number | null
          track_inventory: boolean | null
          updated_at: string | null
          weight_unit: string | null
          weight_value: number | null
        }
        Insert: {
          allow_backorders?: boolean | null
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          product_id: string
          sku?: string | null
          sort_order?: number | null
          stock_quantity?: number | null
          track_inventory?: boolean | null
          updated_at?: string | null
          weight_unit?: string | null
          weight_value?: number | null
        }
        Update: {
          allow_backorders?: boolean | null
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          product_id?: string
          sku?: string | null
          sort_order?: number | null
          stock_quantity?: number | null
          track_inventory?: boolean | null
          updated_at?: string | null
          weight_unit?: string | null
          weight_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "consumer_products_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_view"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allow_backorders: boolean | null
          barcode: string | null
          category_id: string | null
          company_id: string
          created_at: string | null
          description: string | null
          dimension_unit: string | null
          embedding: string | null
          fts: unknown
          height_value: number | null
          hide_price: boolean | null
          id: string
          image_url: string | null
          length_value: number | null
          likes_count: number
          low_stock_threshold: number | null
          name: string
          price: number
          sku: string | null
          status_id: string | null
          stock_quantity: number | null
          track_inventory: boolean | null
          uktzed: string | null
          unit_type_id: string | null
          updated_at: string | null
          volume_unit: string | null
          volume_value: number | null
          weight_unit: string | null
          weight_value: number | null
          width_value: number | null
        }
        Insert: {
          allow_backorders?: boolean | null
          barcode?: string | null
          category_id?: string | null
          company_id: string
          created_at?: string | null
          description?: string | null
          dimension_unit?: string | null
          embedding?: string | null
          fts?: unknown
          height_value?: number | null
          hide_price?: boolean | null
          id?: string
          image_url?: string | null
          length_value?: number | null
          likes_count?: number
          low_stock_threshold?: number | null
          name: string
          price: number
          sku?: string | null
          status_id?: string | null
          stock_quantity?: number | null
          track_inventory?: boolean | null
          uktzed?: string | null
          unit_type_id?: string | null
          updated_at?: string | null
          volume_unit?: string | null
          volume_value?: number | null
          weight_unit?: string | null
          weight_value?: number | null
          width_value?: number | null
        }
        Update: {
          allow_backorders?: boolean | null
          barcode?: string | null
          category_id?: string | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          dimension_unit?: string | null
          embedding?: string | null
          fts?: unknown
          height_value?: number | null
          hide_price?: boolean | null
          id?: string
          image_url?: string | null
          length_value?: number | null
          likes_count?: number
          low_stock_threshold?: number | null
          name?: string
          price?: number
          sku?: string | null
          status_id?: string | null
          stock_quantity?: number | null
          track_inventory?: boolean | null
          uktzed?: string | null
          unit_type_id?: string | null
          updated_at?: string | null
          volume_unit?: string | null
          volume_value?: number | null
          weight_unit?: string | null
          weight_value?: number | null
          width_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "company_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_unit_type_id_fkey"
            columns: ["unit_type_id"]
            isOneToOne: false
            referencedRelation: "products_view"
            referencedColumns: ["unit_type_id"]
          },
          {
            foreignKeyName: "products_unit_type_id_fkey"
            columns: ["unit_type_id"]
            isOneToOne: false
            referencedRelation: "unit_types"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permission_defaults: {
        Row: {
          permission: string
          role: string
        }
        Insert: {
          permission: string
          role: string
        }
        Update: {
          permission?: string
          role?: string
        }
        Relationships: []
      }
      showcase_config: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          sections: Json | null
          seo: Json | null
          theme: Json | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          sections?: Json | null
          seo?: Json | null
          theme?: Json | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          sections?: Json | null
          seo?: Json | null
          theme?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "showcase_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      status_auto_transitions: {
        Row: {
          company_id: string
          condition_field: string | null
          condition_value: string | null
          created_at: string | null
          from_status_id: string
          id: string
          is_active: boolean | null
          to_status_id: string
          trigger_field: string
          trigger_value: string
        }
        Insert: {
          company_id: string
          condition_field?: string | null
          condition_value?: string | null
          created_at?: string | null
          from_status_id: string
          id?: string
          is_active?: boolean | null
          to_status_id: string
          trigger_field: string
          trigger_value: string
        }
        Update: {
          company_id?: string
          condition_field?: string | null
          condition_value?: string | null
          created_at?: string | null
          from_status_id?: string
          id?: string
          is_active?: boolean | null
          to_status_id?: string
          trigger_field?: string
          trigger_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_auto_transitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_auto_transitions_from_status_id_fkey"
            columns: ["from_status_id"]
            isOneToOne: false
            referencedRelation: "company_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_auto_transitions_to_status_id_fkey"
            columns: ["to_status_id"]
            isOneToOne: false
            referencedRelation: "company_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      status_automations: {
        Row: {
          action_config: Json
          action_type: string
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          status_id: string
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          action_config?: Json
          action_type: string
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          status_id: string
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          action_config?: Json
          action_type?: string
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          status_id?: string
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "status_automations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_automations_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "company_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      status_template_auto_transitions: {
        Row: {
          condition_field: string | null
          condition_value: string | null
          from_status_code: string
          id: string
          template_id: string
          to_status_code: string
          trigger_field: string
          trigger_value: string
        }
        Insert: {
          condition_field?: string | null
          condition_value?: string | null
          from_status_code: string
          id?: string
          template_id: string
          to_status_code: string
          trigger_field: string
          trigger_value: string
        }
        Update: {
          condition_field?: string | null
          condition_value?: string | null
          from_status_code?: string
          id?: string
          template_id?: string
          to_status_code?: string
          trigger_field?: string
          trigger_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_template_auto_transitions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "status_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      status_template_items: {
        Row: {
          code: string
          color: string
          icon: string
          id: string
          is_default: boolean | null
          is_final: boolean | null
          name: string
          sort_order: number
          template_id: string
        }
        Insert: {
          code: string
          color?: string
          icon?: string
          id?: string
          is_default?: boolean | null
          is_final?: boolean | null
          name: string
          sort_order?: number
          template_id: string
        }
        Update: {
          code?: string
          color?: string
          icon?: string
          id?: string
          is_default?: boolean | null
          is_final?: boolean | null
          name?: string
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "status_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      status_template_transitions: {
        Row: {
          from_status_code: string
          id: string
          template_id: string
          to_status_code: string
        }
        Insert: {
          from_status_code: string
          id?: string
          template_id: string
          to_status_code: string
        }
        Update: {
          from_status_code?: string
          id?: string
          template_id?: string
          to_status_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_template_transitions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "status_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      status_templates: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          entity_type: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          entity_type: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          entity_type?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      status_transitions: {
        Row: {
          company_id: string
          created_at: string | null
          from_status_id: string
          id: string
          requires_confirmation: boolean | null
          to_status_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          from_status_id: string
          id?: string
          requires_confirmation?: boolean | null
          to_status_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          from_status_id?: string
          id?: string
          requires_confirmation?: boolean | null
          to_status_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_transitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_transitions_from_status_id_fkey"
            columns: ["from_status_id"]
            isOneToOne: false
            referencedRelation: "company_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_transitions_to_status_id_fkey"
            columns: ["to_status_id"]
            isOneToOne: false
            referencedRelation: "company_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          features: string[]
          id: string
          is_active: boolean
          limits: Json
          name: string
          price_monthly: number | null
          price_yearly: number | null
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          features?: string[]
          id?: string
          is_active?: boolean
          limits?: Json
          name: string
          price_monthly?: number | null
          price_yearly?: number | null
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          features?: string[]
          id?: string
          is_active?: boolean
          limits?: Json
          name?: string
          price_monthly?: number | null
          price_yearly?: number | null
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      unit_types: {
        Row: {
          code: string
          company_id: string
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          sort_order: number | null
          symbol: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          sort_order?: number | null
          symbol?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          sort_order?: number | null
          symbol?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unit_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_checkout_preferences: {
        Row: {
          created_at: string | null
          delivery: Json
          payment: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          delivery?: Json
          payment?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          delivery?: Json
          payment?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_devices: {
        Row: {
          app_version: string | null
          created_at: string | null
          device_name: string | null
          device_token: string
          id: string
          is_active: boolean
          last_used_at: string | null
          os_version: string | null
          platform: string
          push_provider: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string | null
          device_name?: string | null
          device_token: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          os_version?: string | null
          platform: string
          push_provider: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string | null
          device_name?: string | null
          device_token?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          os_version?: string | null
          platform?: string
          push_provider?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
          last_name: string | null
          name: string | null
          phone: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          last_name?: string | null
          name?: string | null
          phone?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          last_name?: string | null
          name?: string | null
          phone?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      verifications: {
        Row: {
          attempts: number | null
          code: string
          created_at: string | null
          destination: string
          expires_at: string
          id: string
          type: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number | null
          code: string
          created_at?: string | null
          destination: string
          expires_at: string
          id?: string
          type?: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number | null
          code?: string
          created_at?: string | null
          destination?: string
          expires_at?: string
          id?: string
          type?: string
          verified_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      carts_view: {
        Row: {
          company_id: string | null
          company_slug: string | null
          created_at: string | null
          id: string | null
          items: Json | null
          total_price: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      consumer_products_view: {
        Row: {
          barcode: string | null
          base_price: number | null
          category: string | null
          comments_count: number | null
          company_id: string | null
          description: string | null
          dimension_unit: string | null
          fts: unknown
          has_variants: boolean | null
          height_value: number | null
          hide_price: boolean | null
          id: string | null
          images: Json | null
          length_value: number | null
          liked: boolean | null
          likes_count: number | null
          name: string | null
          sku: string | null
          stock_quantity: number | null
          track_inventory: boolean | null
          unit_type_code: string | null
          unit_type_name: string | null
          unit_type_symbol: string | null
          updated_at: string | null
          volume_unit: string | null
          volume_value: number | null
          weight_unit: string | null
          weight_value: number | null
          width_value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_comments_view: {
        Row: {
          company_id: string | null
          content: string | null
          created_at: string | null
          id: string | null
          is_company_reply: boolean | null
          parent_id: string | null
          product_id: string | null
          updated_at: string | null
          user_avatar: string | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_comments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_comments_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_comments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "consumer_products_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_comments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_comments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      products_view: {
        Row: {
          allow_backorders: boolean | null
          barcode: string | null
          category: string | null
          company_id: string | null
          created_at: string | null
          description: string | null
          dimension_unit: string | null
          has_variants: boolean | null
          height_value: number | null
          hide_price: boolean | null
          id: string | null
          image_url: string | null
          length_value: number | null
          low_stock_threshold: number | null
          name: string | null
          price: number | null
          sku: string | null
          status: string | null
          status_code: string | null
          status_color: string | null
          status_icon: string | null
          stock_quantity: number | null
          track_inventory: boolean | null
          uktzed: string | null
          unit_type_code: string | null
          unit_type_id: string | null
          unit_type_name: string | null
          unit_type_symbol: string | null
          updated_at: string | null
          volume_unit: string | null
          volume_value: number | null
          weight_unit: string | null
          weight_value: number | null
          width_value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      public_profiles: {
        Row: {
          avatar: string | null
          display_name: string | null
          id: string | null
          last_name: string | null
          name: string | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_company_customer_invite: {
        Args: { p_token: string }
        Returns: Json
      }
      analytics_get_dashboard_summary: {
        Args: { p_company_id: string; p_from: string; p_to: string }
        Returns: Json
      }
      analytics_get_period_stats: {
        Args: { p_company_id: string; p_from: string; p_to: string }
        Returns: {
          new_customers: number
          order_count: number
          paid_revenue: number
          total_revenue: number
        }[]
      }
      analytics_get_response_rate_chart: {
        Args: { p_company_id: string; p_from: string; p_to: string }
        Returns: {
          avg_response_time_sec: number
          conversation_count: number
          date: string
          responded_count: number
          response_rate: number
        }[]
      }
      analytics_get_response_rate_stats: {
        Args: { p_company_id: string; p_from: string; p_to: string }
        Returns: {
          avg_response_time_sec: number
          median_response_time_sec: number
          responded_conversations: number
          response_rate: number
          total_conversations: number
        }[]
      }
      analytics_get_revenue_chart: {
        Args: {
          p_company_id: string
          p_from: string
          p_granularity?: string
          p_to: string
        }
        Returns: {
          date: string
          order_count: number
          total_revenue: number
        }[]
      }
      analytics_get_top_customers: {
        Args: {
          p_company_id: string
          p_from: string
          p_limit?: number
          p_to: string
        }
        Returns: {
          customer_id: string
          order_count: number
          total_spent: number
        }[]
      }
      analytics_get_top_products: {
        Args: {
          p_company_id: string
          p_from: string
          p_limit?: number
          p_to: string
        }
        Returns: {
          order_count: number
          product_id: string
          quantity_sold: number
          revenue: number
        }[]
      }
      analytics_get_top_searches: {
        Args: {
          p_company_id: string
          p_from: string
          p_limit?: number
          p_to: string
        }
        Returns: {
          query: string
          search_count: number
        }[]
      }
      analytics_list_customers: {
        Args: {
          p_company_id: string
          p_cursor_id?: string
          p_cursor_value?: number
          p_from: string
          p_limit?: number
          p_to: string
        }
        Returns: {
          customer_id: string
          order_count: number
          total_spent: number
        }[]
      }
      analytics_list_products: {
        Args: {
          p_company_id: string
          p_cursor_id?: string
          p_cursor_value?: number
          p_from: string
          p_limit?: number
          p_to: string
        }
        Returns: {
          order_count: number
          product_id: string
          quantity_sold: number
          revenue: number
        }[]
      }
      analytics_list_searches: {
        Args: {
          p_company_id: string
          p_cursor_id?: string
          p_cursor_value?: number
          p_from: string
          p_limit?: number
          p_to: string
        }
        Returns: {
          query: string
          search_count: number
        }[]
      }
      analytics_upsert_customer_daily_stats: {
        Args: {
          p_company_id: string
          p_customer_id: string
          p_date: string
          p_order_count_delta?: number
          p_spent_delta?: number
        }
        Returns: undefined
      }
      analytics_upsert_daily_stats: {
        Args: {
          p_company_id: string
          p_date: string
          p_new_customers_delta?: number
          p_order_count_delta?: number
          p_paid_revenue_delta?: number
          p_revenue_delta?: number
        }
        Returns: undefined
      }
      analytics_upsert_product_daily_stats: {
        Args: {
          p_company_id: string
          p_date: string
          p_order_count_delta?: number
          p_product_id: string
          p_quantity_delta?: number
          p_revenue_delta?: number
        }
        Returns: undefined
      }
      assistant_search_products: {
        Args: {
          p_company_id: string
          p_customer_id?: string
          p_limit_per_query?: number
          p_queries: string[]
        }
        Returns: Json
      }
      can_read_document_object: {
        Args: { p_company_id: string; p_document_id: string }
        Returns: boolean
      }
      check_username_available: {
        Args: { p_username: string }
        Returns: boolean
      }
      claim_domain_events: {
        Args: { p_batch_size?: number; p_processor_id?: string }
        Returns: {
          aggregate_id: string
          aggregate_type: string
          company_id: string | null
          created_at: string
          event_type: string
          id: number
          last_error: string | null
          locked_by: string | null
          locked_until: string | null
          max_retries: number
          payload: Json
          processed_at: string | null
          retry_count: number
        }[]
        SetofOptions: {
          from: "*"
          to: "domain_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_old_notifications: {
        Args: { p_days_old?: number }
        Returns: number
      }
      cleanup_processed_domain_events: {
        Args: { retention_days?: number }
        Returns: number
      }
      create_company_customer_link_user: {
        Args: {
          p_company_id: string
          p_group_id?: string
          p_name?: string
          p_notes?: string
          p_price_list_id?: string
          p_user_id: string
        }
        Returns: Json
      }
      create_company_onboarding: {
        Args: {
          p_address?: string
          p_area?: string
          p_city?: string
          p_city_ref?: string
          p_email?: string
          p_latitude?: number
          p_longitude?: number
          p_name: string
          p_prefix: string
          p_slug: string
          p_user_id: string
        }
        Returns: Json
      }
      create_company_order: {
        Args: {
          p_comment?: string
          p_company_id: string
          p_customer_id?: string
          p_delivery_info?: Json
          p_items?: Json
          p_payment_method?: string
          p_payment_status?: string
          p_status_id?: string
        }
        Returns: Json
      }
      create_order_secure: {
        Args: {
          p_cart_id: string
          p_company_id: string
          p_customer_info: Json
          p_delivery_info?: Json
          p_idempotency_key: string
          p_notes?: string
          p_payment_method?: string
          p_user_id: string
        }
        Returns: Json
      }
      deactivate_stale_devices: { Args: never; Returns: number }
      delete_integration_secrets: {
        Args: { p_integration_id: string; p_user_id?: string }
        Returns: undefined
      }
      escape_like_pattern: { Args: { p_text: string }; Returns: string }
      find_order_conversation: {
        Args: {
          p_company_id: string
          p_customer_user_id: string
          p_order_id: string
        }
        Returns: {
          conversation_id: string
          message_id: string
        }[]
      }
      generate_order_number: { Args: { p_company_id: string }; Returns: string }
      get_checkout_payment_info: {
        Args: { p_company_id: string }
        Returns: {
          bank_edrpou: string
          bank_mfo: string
          bank_name: string
          bank_notes: string
          bank_reference_template: string
          edrpou: string
          enabled_methods: string[]
          iban: string
          legal_name: string
        }[]
      }
      get_company_features: {
        Args: { p_company_id: string }
        Returns: string[]
      }
      get_company_page: {
        Args: { p_limit?: number; p_slug: string }
        Returns: Json
      }
      get_company_products: {
        Args: {
          p_category?: string
          p_company_id: string
          p_cursor?: string
          p_limit?: number
          p_query?: string
        }
        Returns: Json
      }
      get_company_subscription: {
        Args: { p_company_id: string }
        Returns: {
          current_period_end: string
          features: string[]
          limits: Json
          plan_display_name: string
          plan_id: string
          plan_name: string
          status: string
          subscription_id: string
          trial_ends_at: string
        }[]
      }
      get_company_templates: {
        Args: { p_company_id: string; p_type?: string }
        Returns: {
          content: Json
          created_at: string
          description: string
          id: string
          is_default: boolean
          name: string
          source: string
          type: string
          updated_at: string
        }[]
      }
      get_conversation_recap: {
        Args: { p_conversation_id: string }
        Returns: Json
      }
      get_delivery_streets: {
        Args: {
          p_limit?: number
          p_provider: string
          p_search?: string
          p_settlement_ref: string
        }
        Returns: {
          latitude: number
          longitude: number
          name_uk: string
          street_ref: string
          street_type: string
        }[]
      }
      get_delivery_warehouses: {
        Args: {
          p_limit?: number
          p_provider: string
          p_search?: string
          p_settlement_ref: string
          p_warehouse_type?: string
        }
        Returns: {
          city_name: string
          city_ref: string
          latitude: number
          longitude: number
          name_uk: string
          number: string
          phone: string
          schedule_fri: string
          schedule_mon: string
          schedule_sat: string
          schedule_sun: string
          schedule_thu: string
          schedule_tue: string
          schedule_wed: string
          settlement_ref: string
          short_address: string
          warehouse_ref: string
          warehouse_type: string
        }[]
      }
      get_integration_secret: {
        Args: {
          p_integration_id: string
          p_secret_name: string
          p_user_id?: string
        }
        Returns: string
      }
      get_invite_details: { Args: { p_token: string }; Returns: Json }
      get_liqpay_credentials: { Args: { p_company_id: string }; Returns: Json }
      get_mono_acquiring_token: {
        Args: { p_company_id: string }
        Returns: string
      }
      get_order_by_tracking_token: { Args: { p_token: string }; Returns: Json }
      get_products_by_ids: {
        Args: { p_company_id: string; p_product_ids: string[] }
        Returns: Json
      }
      get_public_profiles: {
        Args: never
        Returns: {
          avatar: string
          display_name: string
          id: string
          last_name: string
          name: string
          username: string
        }[]
      }
      handle_domain_event_failure: {
        Args: { p_error: string; p_event_id: number }
        Returns: undefined
      }
      has_company_permission: {
        Args: { p_company_id: string; p_permission: string; p_user_id?: string }
        Returns: boolean
      }
      has_feature: {
        Args: { p_company_id: string; p_feature_key: string }
        Returns: boolean
      }
      has_no_company_members: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      haversine_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      immutable_array_to_string: {
        Args: { arr: string[]; sep: string }
        Returns: string
      }
      increment_unread_count: {
        Args: { column_name: string; conversation_id: string }
        Returns: undefined
      }
      is_anonymous_user: { Args: never; Returns: boolean }
      is_company_member: {
        Args: { p_company_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_company_owner: {
        Args: { p_company_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_customer_of_company_member: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      mark_all_notifications_read: {
        Args: {
          p_recipient_role: Database["public"]["Enums"]["notification_recipient_role"]
          p_user_id: string
        }
        Returns: number
      }
      match_bank_transaction_to_order: {
        Args: {
          p_match_type?: string
          p_order_id: string
          p_transaction_id: string
          p_user_id?: string
        }
        Returns: Json
      }
      next_document_number: {
        Args: { p_company_id: string; p_type: string }
        Returns: string
      }
      obfuscate_seq: { Args: { seq: number }; Returns: string }
      process_mono_acquiring_webhook: {
        Args: {
          p_amount: number
          p_cancel_list?: Json
          p_err_code?: string
          p_failure_reason?: string
          p_mono_invoice_id: string
          p_payment_info?: Json
          p_payment_method?: string
          p_status: string
        }
        Returns: Json
      }
      refresh_cart_prices: {
        Args: { p_cart_id: string; p_company_id: string; p_user_id: string }
        Returns: Json
      }
      resolve_product_price: {
        Args: {
          p_base_price: number
          p_company_id: string
          p_customer_id: string
          p_customer_price_list_id: string
          p_default_price_list_id: string
          p_group_price_list_id: string
          p_product_id: string
        }
        Returns: Json
      }
      resolve_product_prices_batch: {
        Args: {
          p_base_prices: number[]
          p_company_id: string
          p_customer_id: string
          p_customer_price_list_id: string
          p_default_price_list_id: string
          p_group_price_list_id: string
          p_product_ids: string[]
        }
        Returns: {
          price: number
          product_id: string
          source: string
        }[]
      }
      search_browse: {
        Args: {
          p_area?: string
          p_category_ids?: string[]
          p_city?: string
          p_cursor_id?: string
          p_cursor_sort?: number
          p_embedding?: string
          p_limit?: number
          p_query?: string
          p_radius_km?: number
          p_sort?: string
          p_user_lat?: number
          p_user_lng?: number
        }
        Returns: {
          address: string
          area: string
          bio: string
          categories: Json
          city: string
          distance_km: number
          followers_count: number
          id: string
          latitude: number
          logo_url: string
          longitude: number
          name: string
          orders_count: number
          products_count: number
          score: number
          slug: string
          sort_value: number
          top_products: Json
        }[]
      }
      search_suggestions: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          id: string
          image_url: string
          name: string
          subtitle: string
          type: string
        }[]
      }
      store_integration_secret: {
        Args: {
          p_integration_id: string
          p_secret_name: string
          p_secret_value: string
          p_user_id?: string
        }
        Returns: string
      }
      to_base36: { Args: { n: number }; Returns: string }
      toggle_company_follow: { Args: { p_company_id: string }; Returns: Json }
      toggle_message_reaction: {
        Args: { p_emoji: string; p_message_id: string; p_user_id: string }
        Returns: Json
      }
      toggle_product_like: {
        Args: { p_company_id: string; p_product_id: string }
        Returns: Json
      }
      unlink_bank_transaction: {
        Args: { p_transaction_id: string; p_user_id?: string }
        Returns: Json
      }
      update_cart_items_bulk: {
        Args: {
          p_cart_id: string
          p_company_id: string
          p_company_slug: string
          p_items: Json
          p_total_price: number
          p_user_id: string
        }
        Returns: Json
      }
      update_order_items_secure: {
        Args: {
          p_comment?: string
          p_company_id: string
          p_customer_id?: string
          p_new_items?: Json
          p_order_id: string
        }
        Returns: Json
      }
      upsert_checkout_session: {
        Args: {
          p_cart_id: string
          p_company_id: string
          p_customer_email?: string
          p_customer_name?: string
          p_customer_phone?: string
          p_delivery_info?: Json
          p_delivery_method?: string
          p_notes?: string
          p_payment_method?: string
        }
        Returns: string
      }
      upsert_delivery_city: {
        Args: {
          p_area_en?: string
          p_area_uk?: string
          p_city_ref: string
          p_is_popular?: boolean
          p_latitude?: number
          p_longitude?: number
          p_name_en?: string
          p_name_uk: string
          p_provider: string
          p_region_en?: string
          p_region_uk?: string
          p_settlement_ref?: string
          p_settlement_type?: string
        }
        Returns: string
      }
      upsert_delivery_street: {
        Args: {
          p_latitude?: number
          p_longitude?: number
          p_name_en?: string
          p_name_uk: string
          p_provider: string
          p_settlement_ref: string
          p_street_ref: string
          p_street_type?: string
        }
        Returns: string
      }
      upsert_delivery_warehouse: {
        Args: {
          p_city_ref: string
          p_full_address?: string
          p_is_active?: boolean
          p_latitude?: number
          p_longitude?: number
          p_max_weight_kg?: number
          p_name_en?: string
          p_name_uk: string
          p_number: string
          p_phone?: string
          p_provider: string
          p_schedule_fri?: string
          p_schedule_mon?: string
          p_schedule_sat?: string
          p_schedule_sun?: string
          p_schedule_thu?: string
          p_schedule_tue?: string
          p_schedule_wed?: string
          p_settlement_ref?: string
          p_short_address?: string
          p_warehouse_ref: string
          p_warehouse_type?: string
        }
        Returns: string
      }
    }
    Enums: {
      delivery_method_type: "pickup" | "city_delivery" | "nova_poshta" | "meest"
      delivery_status:
        | "pending"
        | "processing"
        | "shipped"
        | "in_transit"
        | "delivered"
        | "returned"
        | "cancelled"
      delivery_sub_type: "warehouse" | "poshtomat" | "courier"
      notification_recipient_role: "company_member" | "customer"
      notification_type:
        | "order_new"
        | "order_status"
        | "chat_message"
        | "payment_received"
        | "product_update"
        | "company_follow"
        | "product_new"
        | "transaction_matched"
        | "monobank_accounts_sync_completed"
        | "meta_conversations_import_completed"
        | "document_signed"
      order_log_action:
        | "order_created"
        | "status_changed"
        | "payment_changed"
        | "delivery_changed"
        | "items_changed"
        | "document_created"
        | "document_status_changed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  analytics: {
    Enums: {},
  },
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      delivery_method_type: ["pickup", "city_delivery", "nova_poshta", "meest"],
      delivery_status: [
        "pending",
        "processing",
        "shipped",
        "in_transit",
        "delivered",
        "returned",
        "cancelled",
      ],
      delivery_sub_type: ["warehouse", "poshtomat", "courier"],
      notification_recipient_role: ["company_member", "customer"],
      notification_type: [
        "order_new",
        "order_status",
        "chat_message",
        "payment_received",
        "product_update",
        "company_follow",
        "product_new",
        "transaction_matched",
        "monobank_accounts_sync_completed",
        "meta_conversations_import_completed",
        "document_signed",
      ],
      order_log_action: [
        "order_created",
        "status_changed",
        "payment_changed",
        "delivery_changed",
        "items_changed",
        "document_created",
        "document_status_changed",
      ],
    },
  },
} as const

