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
      ad_metrics: {
        Row: {
          ad_set_id: string
          ad_set_name: string | null
          add_to_cart: number | null
          campaign_id: string
          campaign_name: string | null
          clicks: number | null
          conversions: number | null
          cpc: number | null
          cpm: number | null
          ctr: number | null
          date: string
          id: string
          impressions: number | null
          link_clicks: number | null
          messages: number | null
          post_engagement: number | null
          purchases: number | null
          remarketing_qualified: number | null
          source: string
          spend: number | null
          synced_at: string
        }
        Insert: {
          ad_set_id?: string
          ad_set_name?: string | null
          add_to_cart?: number | null
          campaign_id?: string
          campaign_name?: string | null
          clicks?: number | null
          conversions?: number | null
          cpc?: number | null
          cpm?: number | null
          ctr?: number | null
          date: string
          id?: string
          impressions?: number | null
          link_clicks?: number | null
          messages?: number | null
          post_engagement?: number | null
          purchases?: number | null
          remarketing_qualified?: number | null
          source: string
          spend?: number | null
          synced_at?: string
        }
        Update: {
          ad_set_id?: string
          ad_set_name?: string | null
          add_to_cart?: number | null
          campaign_id?: string
          campaign_name?: string | null
          clicks?: number | null
          conversions?: number | null
          cpc?: number | null
          cpm?: number | null
          ctr?: number | null
          date?: string
          id?: string
          impressions?: number | null
          link_clicks?: number | null
          messages?: number | null
          post_engagement?: number | null
          purchases?: number | null
          remarketing_qualified?: number | null
          source?: string
          spend?: number | null
          synced_at?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          created_at_source: string | null
          currency: string | null
          id: string
          lost_at: string | null
          owner_name: string | null
          pipedrive_deal_id: string
          stage_id: string | null
          stage_name: string | null
          status: string | null
          synced_at: string
          title: string | null
          value: number | null
          won_at: string | null
        }
        Insert: {
          created_at_source?: string | null
          currency?: string | null
          id?: string
          lost_at?: string | null
          owner_name?: string | null
          pipedrive_deal_id: string
          stage_id?: string | null
          stage_name?: string | null
          status?: string | null
          synced_at?: string
          title?: string | null
          value?: number | null
          won_at?: string | null
        }
        Update: {
          created_at_source?: string | null
          currency?: string | null
          id?: string
          lost_at?: string | null
          owner_name?: string | null
          pipedrive_deal_id?: string
          stage_id?: string | null
          stage_name?: string | null
          status?: string | null
          synced_at?: string
          title?: string | null
          value?: number | null
          won_at?: string | null
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          click_rate: number | null
          id: string
          name: string | null
          open_rate: number | null
          rd_campaign_id: string
          sent_at: string | null
          spam_reported: number | null
          subject: string | null
          synced_at: string
          total_bounced: number | null
          total_clicked: number | null
          total_delivered: number | null
          total_dropped: number | null
          total_opened: number | null
          total_sent: number | null
          unsubscribes: number | null
        }
        Insert: {
          click_rate?: number | null
          id?: string
          name?: string | null
          open_rate?: number | null
          rd_campaign_id: string
          sent_at?: string | null
          spam_reported?: number | null
          subject?: string | null
          synced_at?: string
          total_bounced?: number | null
          total_clicked?: number | null
          total_delivered?: number | null
          total_dropped?: number | null
          total_opened?: number | null
          total_sent?: number | null
          unsubscribes?: number | null
        }
        Update: {
          click_rate?: number | null
          id?: string
          name?: string | null
          open_rate?: number | null
          rd_campaign_id?: string
          sent_at?: string | null
          spam_reported?: number | null
          subject?: string | null
          synced_at?: string
          total_bounced?: number | null
          total_clicked?: number | null
          total_delivered?: number | null
          total_dropped?: number | null
          total_opened?: number | null
          total_sent?: number | null
          unsubscribes?: number | null
        }
        Relationships: []
      }
      event_history: {
        Row: {
          archived_at: string
          data: Json
          event_key: string
          id: string
          record_date: string | null
          source_table: string
        }
        Insert: {
          archived_at?: string
          data: Json
          event_key: string
          id?: string
          record_date?: string | null
          source_table: string
        }
        Update: {
          archived_at?: string
          data?: Json
          event_key?: string
          id?: string
          record_date?: string | null
          source_table?: string
        }
        Relationships: []
      }
      ga4_events: {
        Row: {
          date: string
          event_count: number | null
          event_name: string
          id: string
          synced_at: string | null
        }
        Insert: {
          date: string
          event_count?: number | null
          event_name: string
          id?: string
          synced_at?: string | null
        }
        Update: {
          date?: string
          event_count?: number | null
          event_name?: string
          id?: string
          synced_at?: string | null
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          created_by: string
          id: string
          label: string
          metric_key: string
          period_end: string
          period_start: string
          target_value: number
          ticket_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          label: string
          metric_key: string
          period_end: string
          period_start: string
          target_value: number
          ticket_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          label?: string
          metric_key?: string
          period_end?: string
          period_start?: string
          target_value?: number
          ticket_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          created_at: string
          credentials: Json | null
          error_message: string | null
          id: string
          is_active: boolean
          last_synced_at: string | null
          name: string
          sync_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credentials?: Json | null
          error_message?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          name: string
          sync_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credentials?: Json | null
          error_message?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          name?: string
          sync_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          id: string
          name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      site_analytics: {
        Row: {
          avg_session_duration: number | null
          bounce_rate: number | null
          conversions: number | null
          date: string
          id: string
          new_users: number | null
          pageviews: number | null
          sessions: number | null
          synced_at: string
          top_pages: Json | null
          traffic_sources: Json | null
          users: number | null
        }
        Insert: {
          avg_session_duration?: number | null
          bounce_rate?: number | null
          conversions?: number | null
          date: string
          id?: string
          new_users?: number | null
          pageviews?: number | null
          sessions?: number | null
          synced_at?: string
          top_pages?: Json | null
          traffic_sources?: Json | null
          users?: number | null
        }
        Update: {
          avg_session_duration?: number | null
          bounce_rate?: number | null
          conversions?: number | null
          date?: string
          id?: string
          new_users?: number | null
          pageviews?: number | null
          sessions?: number | null
          synced_at?: string
          top_pages?: Json | null
          traffic_sources?: Json | null
          users?: number | null
        }
        Relationships: []
      }
      ticket_sales: {
        Row: {
          buyer_company: string | null
          buyer_email: string | null
          buyer_name: string | null
          buyer_role: string | null
          buyer_state: string | null
          company_size: string | null
          coupon_code: string | null
          event_id: string | null
          id: string
          order_id: string | null
          payment_method: string | null
          quantity: number
          sold_at: string | null
          status: string | null
          sympla_order_id: string
          synced_at: string
          ticket_type: string | null
          ticket_type_id: string | null
          total_price: number
          unit_price: number
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          buyer_company?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_role?: string | null
          buyer_state?: string | null
          company_size?: string | null
          coupon_code?: string | null
          event_id?: string | null
          id?: string
          order_id?: string | null
          payment_method?: string | null
          quantity?: number
          sold_at?: string | null
          status?: string | null
          sympla_order_id: string
          synced_at?: string
          ticket_type?: string | null
          ticket_type_id?: string | null
          total_price?: number
          unit_price?: number
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          buyer_company?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_role?: string | null
          buyer_state?: string | null
          company_size?: string | null
          coupon_code?: string | null
          event_id?: string | null
          id?: string
          order_id?: string | null
          payment_method?: string | null
          quantity?: number
          sold_at?: string | null
          status?: string | null
          sympla_order_id?: string
          synced_at?: string
          ticket_type?: string | null
          ticket_type_id?: string | null
          total_price?: number
          unit_price?: number
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      ticket_sales_details: {
        Row: {
          order_data: Json | null
          participant_data: Json | null
          sympla_order_id: string
          synced_at: string
        }
        Insert: {
          order_data?: Json | null
          participant_data?: Json | null
          sympla_order_id: string
          synced_at?: string
        }
        Update: {
          order_data?: Json | null
          participant_data?: Json | null
          sympla_order_id?: string
          synced_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_sympla_event_id: { Args: never; Returns: string }
      get_form_answer_counts: {
        Args: { p_event_id: string }
        Returns: {
          answer: string
          question: string
          total: number
        }[]
      }
      get_integrations_status: {
        Args: never
        Returns: {
          last_synced_at: string
          name: string
          status: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "viewer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "viewer"],
    },
  },
} as const
