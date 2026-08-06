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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          bonus_amount: number
          cart_total: number
          coin: string
          confirmed_at: string | null
          created_at: string
          id: string
          metadata: Json
          refund_reason: string | null
          refund_requested_at: string | null
          refund_status: string | null
          status: string
          total_credit: number
          updated_at: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          amount: number
          bonus_amount?: number
          cart_total?: number
          coin: string
          confirmed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          refund_reason?: string | null
          refund_requested_at?: string | null
          refund_status?: string | null
          status?: string
          total_credit?: number
          updated_at?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          amount?: number
          bonus_amount?: number
          cart_total?: number
          coin?: string
          confirmed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          refund_reason?: string | null
          refund_requested_at?: string | null
          refund_status?: string | null
          status?: string
          total_credit?: number
          updated_at?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          bank: string | null
          bin: string | null
          brand: string | null
          card_type: string | null
          category: Database["public"]["Enums"]["product_category"]
          city: string | null
          country: string | null
          country_code: string | null
          created_at: string
          exp: string | null
          extras: string | null
          full_card: string | null
          host_ip: string | null
          id: string
          image_url: string | null
          is_active: boolean
          level: string | null
          meta: string
          name: string
          price: number
          scheme: string | null
          seller: string | null
          sort_order: number
          state: string | null
          tag: string | null
          updated_at: string
          valid: string | null
          vendor_id: string | null
          zip: string | null
        }
        Insert: {
          bank?: string | null
          bin?: string | null
          brand?: string | null
          card_type?: string | null
          category: Database["public"]["Enums"]["product_category"]
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          exp?: string | null
          extras?: string | null
          full_card?: string | null
          host_ip?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          level?: string | null
          meta?: string
          name: string
          price?: number
          scheme?: string | null
          seller?: string | null
          sort_order?: number
          state?: string | null
          tag?: string | null
          updated_at?: string
          valid?: string | null
          vendor_id?: string | null
          zip?: string | null
        }
        Update: {
          bank?: string | null
          bin?: string | null
          brand?: string | null
          card_type?: string | null
          category?: Database["public"]["Enums"]["product_category"]
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          exp?: string | null
          extras?: string | null
          full_card?: string | null
          host_ip?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          level?: string | null
          meta?: string
          name?: string
          price?: number
          scheme?: string | null
          seller?: string | null
          sort_order?: number
          state?: string | null
          tag?: string | null
          updated_at?: string
          valid?: string | null
          vendor_id?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          balance: number
          created_at: string
          id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          balance?: number
          created_at?: string
          id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          balance?: number
          created_at?: string
          id?: string
          username?: string | null
        }
        Relationships: []
      }
      tickets: {
        Row: {
          admin_reply: string | null
          created_at: string
          id: string
          message: string
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message: string
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      updates: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          handle: string
          id: string
          is_active: boolean
          name: string
          rating: number
          sales_count: number
          sales_total: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          handle: string
          id?: string
          is_active?: boolean
          name: string
          rating?: number
          sales_count?: number
          sales_total?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          handle?: string
          id?: string
          is_active?: boolean
          name?: string
          rating?: number
          sales_count?: number
          sales_total?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      visitor_logs: {
        Row: {
          country: string | null
          created_at: string
          id: string
          ip_address: string | null
          path: string | null
          referrer: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          path?: string | null
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          path?: string | null
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_balance: {
        Args: { _amount: number; _note?: string; _user_id: string }
        Returns: number
      }
      approve_payment: { Args: { _payment_id: string }; Returns: undefined }
      assign_admin_role_by_email: { Args: { _email: string }; Returns: Json }
      auto_refund_dead_card: { Args: { _payment_id: string }; Returns: number }
      charge_checker_fee: {
        Args: { _count: number; _price_per_check: number }
        Returns: number
      }
      confirm_payment: { Args: { _payment_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      purchase_cart: {
        Args: { _cart_total: number; _items: Json }
        Returns: string
      }
      refund_checker_fee: {
        Args: { _count: number; _price_per_check: number }
        Returns: number
      }
      reject_payment: { Args: { _payment_id: string }; Returns: undefined }
      request_refund: {
        Args: { _payment_id: string; _reason: string }
        Returns: undefined
      }
      review_refund: {
        Args: { _approve: boolean; _payment_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      product_category:
        | "sales"
        | "cards"
        | "proxy"
        | "tools"
        | "socks"
        | "rdp"
        | "logs"
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
      app_role: ["admin", "moderator", "user"],
      product_category: [
        "sales",
        "cards",
        "proxy",
        "tools",
        "socks",
        "rdp",
        "logs",
      ],
    },
  },
} as const
