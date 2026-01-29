export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string
          current_balance: number
          household_id: string
          id: string
          initial_balance: number
          is_active: boolean
          is_primary: boolean
          is_reserve: boolean
          name: string
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_balance?: number
          household_id: string
          id?: string
          initial_balance?: number
          is_active?: boolean
          is_primary?: boolean
          is_reserve?: boolean
          name: string
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_balance?: number
          household_id?: string
          id?: string
          initial_balance?: number
          is_active?: boolean
          is_primary?: boolean
          is_reserve?: boolean
          name?: string
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          category_id: string
          created_at: string
          household_id: string
          id: string
          is_manual: boolean
          month: number
          planned_amount: number
          recurring_budget_id: string | null
          subcategory_id: string | null
          updated_at: string
          year: number
        }
        Insert: {
          category_id: string
          created_at?: string
          household_id: string
          id?: string
          is_manual?: boolean
          month: number
          planned_amount?: number
          recurring_budget_id?: string | null
          subcategory_id?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          category_id?: string
          created_at?: string
          household_id?: string
          id?: string
          is_manual?: boolean
          month?: number
          planned_amount?: number
          recurring_budget_id?: string | null
          subcategory_id?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_recurring_budget_id_fkey"
            columns: ["recurring_budget_id"]
            isOneToOne: false
            referencedRelation: "budgets_recurring"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets_recurring: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          end_month: string | null
          frequency: string
          household_id: string
          id: string
          start_month: string
          subcategory_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category_id?: string | null
          created_at?: string
          end_month?: string | null
          frequency?: string
          household_id: string
          id?: string
          start_month: string
          subcategory_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          end_month?: string | null
          frequency?: string
          household_id?: string
          id?: string
          start_month?: string
          subcategory_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_recurring_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_recurring_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_recurring_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          archived_at: string | null
          created_at: string
          household_id: string
          icon: string | null
          id: string
          is_budget_excluded: boolean
          is_essential: boolean
          name: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          household_id: string
          icon?: string | null
          id?: string
          is_budget_excluded?: boolean
          is_essential?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          household_id?: string
          icon?: string | null
          id?: string
          is_budget_excluded?: boolean
          is_essential?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_cards: {
        Row: {
          brand: string | null
          closing_day: number
          color: string | null
          created_at: string
          due_day: number
          household_id: string
          id: string
          is_active: boolean
          limit_amount: number
          name: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          closing_day: number
          color?: string | null
          created_at?: string
          due_day: number
          household_id: string
          id?: string
          is_active?: boolean
          limit_amount?: number
          name: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          closing_day?: number
          color?: string | null
          created_at?: string
          due_day?: number
          household_id?: string
          id?: string
          is_active?: boolean
          limit_amount?: number
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_cards_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          accepted_by_user_id: string | null
          created_at: string
          created_by: string
          created_by_user_id: string | null
          expires_at: string
          household_id: string
          id: string
          invited_email: string | null
          invited_email_lower: string | null
          role: string | null
          token_hash: string | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          created_by: string
          created_by_user_id?: string | null
          expires_at?: string
          household_id: string
          id?: string
          invited_email?: string | null
          invited_email_lower?: string | null
          role?: string | null
          token_hash?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          created_by?: string
          created_by_user_id?: string | null
          expires_at?: string
          household_id?: string
          id?: string
          invited_email?: string | null
          invited_email_lower?: string | null
          role?: string | null
          token_hash?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      member_identities: {
        Row: {
          created_at: string
          household_id: string | null
          member_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id?: string | null
          member_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string | null
          member_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_identities_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          created_at: string
          household_id: string
          id: string
          name: string
          role: Database["public"]["Enums"]["member_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          name: string
          role?: Database["public"]["Enums"]["member_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["member_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_label_key: string | null
          cta_target: string | null
          dedupe_key: string | null
          dismissed_at: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string
          household_id: string
          id: string
          is_open: boolean | null
          message: string
          message_key: string
          metadata: Json | null
          params: Json | null
          read_at: string | null
          reference_id: string | null
          severity: string | null
          status: string | null
          target_user_id: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_label_key?: string | null
          cta_target?: string | null
          dedupe_key?: string | null
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          household_id: string
          id?: string
          is_open?: boolean | null
          message: string
          message_key: string
          metadata?: Json | null
          params?: Json | null
          read_at?: string | null
          reference_id?: string | null
          severity?: string | null
          status?: string | null
          target_user_id?: string | null
          title: string
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_label_key?: string | null
          cta_target?: string | null
          dedupe_key?: string | null
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          household_id?: string
          id?: string
          is_open?: boolean | null
          message?: string
          message_key?: string
          metadata?: Json | null
          params?: Json | null
          read_at?: string | null
          reference_id?: string | null
          severity?: string | null
          status?: string | null
          target_user_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      open_finance_connections: {
        Row: {
          bank_id: string
          bank_logo: string | null
          bank_name: string
          created_at: string
          expires_at: string
          external_connection_id: string | null
          household_id: string
          id: string
          last_sync_at: string | null
          notifications_enabled: boolean
          permissions: string[]
          privacy_accepted: boolean
          status: string
          updated_at: string
        }
        Insert: {
          bank_id: string
          bank_logo?: string | null
          bank_name: string
          created_at?: string
          expires_at?: string
          external_connection_id?: string | null
          household_id: string
          id?: string
          last_sync_at?: string | null
          notifications_enabled?: boolean
          permissions?: string[]
          privacy_accepted?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          bank_id?: string
          bank_logo?: string | null
          bank_name?: string
          created_at?: string
          expires_at?: string
          external_connection_id?: string | null
          household_id?: string
          id?: string
          last_sync_at?: string | null
          notifications_enabled?: boolean
          permissions?: string[]
          privacy_accepted?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_finance_connections_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_transactions: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          created_at: string
          day_of_month: number
          description: string | null
          end_month: string | null
          expense_type: string | null
          frequency: string
          household_id: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["transaction_kind"]
          member_id: string | null
          start_month: string
          subcategory_id: string | null
          to_account_id: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          created_at?: string
          day_of_month?: number
          description?: string | null
          end_month?: string | null
          expense_type?: string | null
          frequency?: string
          household_id: string
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["transaction_kind"]
          member_id?: string | null
          start_month: string
          subcategory_id?: string | null
          to_account_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          created_at?: string
          day_of_month?: number
          description?: string | null
          end_month?: string | null
          expense_type?: string | null
          frequency?: string
          household_id?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["transaction_kind"]
          member_id?: string | null
          start_month?: string
          subcategory_id?: string | null
          to_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_events: {
        Row: {
          created_at: string
          event_type: string
          household_id: string
          id: string
          metadata: Json | null
          reference_id: string | null
          reference_month: string
          reference_type: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          household_id: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_month: string
          reference_type?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          household_id?: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_month?: string
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_events_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          archived_at: string | null
          category_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          category_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          category_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          cancelled_at: string | null
          cancelled_by: string | null
          category_id: string | null
          clean_description: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          credit_card_id: string | null
          date: string
          description: string | null
          due_date: string | null
          expense_type: string | null
          household_id: string
          id: string
          installment_group_id: string | null
          installment_number: number | null
          installment_total: number | null
          invoice_month: string | null
          kind: Database["public"]["Enums"]["transaction_kind"]
          member_id: string | null
          payment_method: string | null
          recurring_transaction_id: string | null
          status: string
          subcategory_id: string | null
          to_account_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          amount: number
          cancelled_at?: string | null
          cancelled_by?: string | null
          category_id?: string | null
          clean_description?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          credit_card_id?: string | null
          date: string
          description?: string | null
          due_date?: string | null
          expense_type?: string | null
          household_id: string
          id?: string
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          invoice_month?: string | null
          kind: Database["public"]["Enums"]["transaction_kind"]
          member_id?: string | null
          payment_method?: string | null
          recurring_transaction_id?: string | null
          status?: string
          subcategory_id?: string | null
          to_account_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          cancelled_at?: string | null
          cancelled_by?: string | null
          category_id?: string | null
          clean_description?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          credit_card_id?: string | null
          date?: string
          description?: string | null
          due_date?: string | null
          expense_type?: string | null
          household_id?: string
          id?: string
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          invoice_month?: string | null
          kind?: Database["public"]["Enums"]["transaction_kind"]
          member_id?: string | null
          payment_method?: string | null
          recurring_transaction_id?: string | null
          status?: string
          subcategory_id?: string | null
          to_account_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurring_transaction_id_fkey"
            columns: ["recurring_transaction_id"]
            isOneToOne: false
            referencedRelation: "recurring_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stats: {
        Row: {
          created_at: string
          current_level: number
          current_xp: number
          household_id: string
          id: string
          last_activity_date: string | null
          streak_days: number
          total_xp: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_level?: number
          current_xp?: number
          household_id: string
          id?: string
          last_activity_date?: string | null
          streak_days?: number
          total_xp?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_level?: number
          current_xp?: number
          household_id?: string
          id?: string
          last_activity_date?: string | null
          streak_days?: number
          total_xp?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _get_header: { Args: { name: string }; Returns: string }
      _request_headers: { Args: never; Returns: Json }
      accept_household_invite: { Args: { p_token: string }; Returns: string }
      accept_household_invite_by_id: {
        Args: { p_invite_id: string }
        Returns: string
      }
      check_expenses_due_today: {
        Args: { p_household_id?: string }
        Returns: {
          amount: number
          description: string
          notification_created: boolean
          transaction_id: string
        }[]
      }
      create_household_invite: {
        Args: {
          p_expires_in_days?: number
          p_invited_email?: string
          p_role?: string
        }
        Returns: {
          expires_at: string
          invite_id: string
          token: string
        }[]
      }
      create_household_with_admin: {
        Args: {
          p_household_name: string
          p_member_email?: string
          p_member_name: string
          p_user_id: string
        }
        Returns: string
      }
      create_member_identity: {
        Args: { p_household_id: string; p_member_id: string }
        Returns: undefined
      }
      delete_household_invite: {
        Args: { p_invite_id: string }
        Returns: boolean
      }
      delete_recurring_budget_and_cleanup: {
        Args: { p_from_month: string; p_recurring_id: string }
        Returns: undefined
      }
      force_update_account_balance: {
        Args: { p_account_id: string; p_new_balance?: number }
        Returns: undefined
      }
      get_account_balance: { Args: { p_account_id: string }; Returns: number }
      get_accounts_with_balances: {
        Args: never
        Returns: {
          calculated_balance: number
          created_at: string
          current_balance: number
          household_id: string
          id: string
          initial_balance: number
          is_active: boolean
          is_primary: boolean
          is_reserve: boolean
          name: string
          transaction_count: number
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
        }[]
      }
      get_financial_radar: {
        Args: {
          p_date_end?: string
          p_date_start?: string
          p_household_id: string
          p_user_today?: string
        }
        Returns: Json
      }
      get_household_invite_preview: {
        Args: { p_token: string }
        Returns: {
          expires_at: string
          household_id: string
          is_valid: boolean
        }[]
      }
      get_members_visible:
        | {
            Args: never
            Returns: {
              created_at: string
              email: string
              household_id: string
              id: string
              is_you: boolean
              name: string
              role: string
              updated_at: string
              user_id: string
            }[]
          }
        | {
            Args: { p_household_id: string }
            Returns: {
              created_at: string
              email: string
              household_id: string
              id: string
              is_you: boolean
              name: string
              role: string
              updated_at: string
              user_id: string
            }[]
          }
      get_my_identity: {
        Args: never
        Returns: {
          created_at: string
          email: string
          household_id: string
          user_id: string
        }[]
      }
      get_my_pending_invites: {
        Args: never
        Returns: {
          created_at: string
          expires_at: string
          household_id: string
          id: string
          role: string
        }[]
      }
      get_user_context: {
        Args: never
        Returns: {
          household_id: string
          member_id: string
        }[]
      }
      get_user_household_id: { Args: never; Returns: string }
      hash_invite_token: { Args: { p_token: string }; Returns: string }
      is_household_admin:
        | { Args: never; Returns: boolean }
        | { Args: { p_household: string; p_user: string }; Returns: boolean }
      is_household_unlinked: {
        Args: { p_household_id: string }
        Returns: boolean
      }
      jsonb_allowlist: {
        Args: { allowed_keys: string[]; obj: Json }
        Returns: Json
      }
      jwt_email_lower: { Args: never; Returns: string }
      list_household_invites: {
        Args: { p_household_id: string }
        Returns: {
          accepted_at: string
          created_at: string
          expires_at: string
          id: string
          invited_email: string
          role: string
        }[]
      }
      predict_transaction_details: {
        Args: { p_description: string }
        Returns: Json
      }
      seed_household_data: {
        Args: { p_household_id: string }
        Returns: undefined
      }
      sync_all_account_balances: {
        Args: never
        Returns: {
          account_id: string
          account_name: string
          difference: number
          new_balance: number
          old_balance: number
        }[]
      }
      upsert_notification: {
        Args: {
          p_created_by?: string
          p_cta_label?: string
          p_cta_target?: string
          p_dedupe_key: string
          p_event_type: string
          p_household_id: string
          p_message: string
          p_metadata?: Json
          p_reference_id?: string
          p_title: string
          p_type: string
        }
        Returns: string
      }
    }
    Enums: {
      account_type: "BANK" | "CASH" | "CARD"
      member_role: "ADMIN" | "MEMBER"
      transaction_kind: "INCOME" | "EXPENSE" | "TRANSFER"
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
  public: {
    Enums: {
      account_type: ["BANK", "CASH", "CARD"],
      member_role: ["ADMIN", "MEMBER"],
      transaction_kind: ["INCOME", "EXPENSE", "TRANSFER"],
    },
  },
} as const
