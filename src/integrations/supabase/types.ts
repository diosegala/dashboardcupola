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
      app_secrets: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      coupon_people: {
        Row: {
          codes: string[]
          created_at: string
          id: string
          name: string
          outside_ranking: boolean
          seller_names: string[]
          updated_at: string
        }
        Insert: {
          codes?: string[]
          created_at?: string
          id?: string
          name: string
          outside_ranking?: boolean
          seller_names?: string[]
          updated_at?: string
        }
        Update: {
          codes?: string[]
          created_at?: string
          id?: string
          name?: string
          outside_ranking?: boolean
          seller_names?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      crm_leads: {
        Row: {
          added_at: string | null
          crm_account: string
          custom_fields: Json
          expected_close_date: string | null
          id: string
          is_archived: boolean
          label_ids: string[]
          org_name: string | null
          org_pd_id: number | null
          owner_name: string | null
          owner_pd_id: number | null
          pd_lead_id: string
          person_pd_id: number | null
          source_name: string | null
          synced_at: string
          title: string | null
          updated_at_source: string | null
        }
        Insert: {
          added_at?: string | null
          crm_account: string
          custom_fields?: Json
          expected_close_date?: string | null
          id?: string
          is_archived?: boolean
          label_ids?: string[]
          org_name?: string | null
          org_pd_id?: number | null
          owner_name?: string | null
          owner_pd_id?: number | null
          pd_lead_id: string
          person_pd_id?: number | null
          source_name?: string | null
          synced_at?: string
          title?: string | null
          updated_at_source?: string | null
        }
        Update: {
          added_at?: string | null
          crm_account?: string
          custom_fields?: Json
          expected_close_date?: string | null
          id?: string
          is_archived?: boolean
          label_ids?: string[]
          org_name?: string | null
          org_pd_id?: number | null
          owner_name?: string | null
          owner_pd_id?: number | null
          pd_lead_id?: string
          person_pd_id?: number | null
          source_name?: string | null
          synced_at?: string
          title?: string | null
          updated_at_source?: string | null
        }
        Relationships: []
      }
      crm_organizations: {
        Row: {
          crm_account: string
          custom_fields: Json
          id: string
          is_deleted: boolean
          name: string | null
          pd_id: number
          synced_at: string
          updated_at_source: string | null
        }
        Insert: {
          crm_account: string
          custom_fields?: Json
          id?: string
          is_deleted?: boolean
          name?: string | null
          pd_id: number
          synced_at?: string
          updated_at_source?: string | null
        }
        Update: {
          crm_account?: string
          custom_fields?: Json
          id?: string
          is_deleted?: boolean
          name?: string | null
          pd_id?: number
          synced_at?: string
          updated_at_source?: string | null
        }
        Relationships: []
      }
      crm_pipelines: {
        Row: {
          crm_account: string
          id: string
          is_active: boolean
          is_deleted: boolean
          name: string
          order_nr: number | null
          pd_id: number
          synced_at: string
        }
        Insert: {
          crm_account: string
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          name: string
          order_nr?: number | null
          pd_id: number
          synced_at?: string
        }
        Update: {
          crm_account?: string
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          name?: string
          order_nr?: number | null
          pd_id?: number
          synced_at?: string
        }
        Relationships: []
      }
      crm_products: {
        Row: {
          code: string | null
          crm_account: string
          currency: string | null
          id: string
          is_active: boolean
          is_deleted: boolean
          kind: string
          list_price: number | null
          name: string
          parent_pd_id: number | null
          pd_id: number
          synced_at: string
        }
        Insert: {
          code?: string | null
          crm_account: string
          currency?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          kind?: string
          list_price?: number | null
          name: string
          parent_pd_id?: number | null
          pd_id: number
          synced_at?: string
        }
        Update: {
          code?: string | null
          crm_account?: string
          currency?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          kind?: string
          list_price?: number | null
          name?: string
          parent_pd_id?: number | null
          pd_id?: number
          synced_at?: string
        }
        Relationships: []
      }
      crm_stages: {
        Row: {
          crm_account: string
          days_to_rotten: number | null
          deal_probability: number | null
          id: string
          is_deleted: boolean
          name: string
          order_nr: number | null
          pd_id: number
          pipeline_pd_id: number
          synced_at: string
        }
        Insert: {
          crm_account: string
          days_to_rotten?: number | null
          deal_probability?: number | null
          id?: string
          is_deleted?: boolean
          name: string
          order_nr?: number | null
          pd_id: number
          pipeline_pd_id: number
          synced_at?: string
        }
        Update: {
          crm_account?: string
          days_to_rotten?: number | null
          deal_probability?: number | null
          id?: string
          is_deleted?: boolean
          name?: string
          order_nr?: number | null
          pd_id?: number
          pipeline_pd_id?: number
          synced_at?: string
        }
        Relationships: []
      }
      crm_sync_state: {
        Row: {
          crm_account: string
          cursors: Json
          last_error: string | null
          last_started_at: string | null
          last_success_at: string | null
          tokens_day: string | null
          tokens_used_today: number
        }
        Insert: {
          crm_account: string
          cursors?: Json
          last_error?: string | null
          last_started_at?: string | null
          last_success_at?: string | null
          tokens_day?: string | null
          tokens_used_today?: number
        }
        Update: {
          crm_account?: string
          cursors?: Json
          last_error?: string | null
          last_started_at?: string | null
          last_success_at?: string | null
          tokens_day?: string | null
          tokens_used_today?: number
        }
        Relationships: []
      }
      crm_users: {
        Row: {
          crm_account: string
          id: string
          is_active: boolean
          name: string | null
          pd_id: number
          synced_at: string
        }
        Insert: {
          crm_account: string
          id?: string
          is_active?: boolean
          name?: string | null
          pd_id: number
          synced_at?: string
        }
        Update: {
          crm_account?: string
          id?: string
          is_active?: boolean
          name?: string | null
          pd_id?: number
          synced_at?: string
        }
        Relationships: []
      }
      deal_installments: {
        Row: {
          amount: number
          billing_date: string | null
          crm_account: string
          deal_id: string
          deal_product_pd_id: number | null
          description: string | null
          id: string
          pd_id: number
          synced_at: string
        }
        Insert: {
          amount?: number
          billing_date?: string | null
          crm_account: string
          deal_id: string
          deal_product_pd_id?: number | null
          description?: string | null
          id?: string
          pd_id: number
          synced_at?: string
        }
        Update: {
          amount?: number
          billing_date?: string | null
          crm_account?: string
          deal_id?: string
          deal_product_pd_id?: number | null
          description?: string | null
          id?: string
          pd_id?: number
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_installments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_product_value_history: {
        Row: {
          changed_at: string
          crm_account: string
          deal_id: string
          deal_product_pd_id: number
          id: string
          is_enabled: boolean
          product_pd_id: number | null
          quantity: number
          sum: number
        }
        Insert: {
          changed_at?: string
          crm_account: string
          deal_id: string
          deal_product_pd_id: number
          id?: string
          is_enabled?: boolean
          product_pd_id?: number | null
          quantity?: number
          sum?: number
        }
        Update: {
          changed_at?: string
          crm_account?: string
          deal_id?: string
          deal_product_pd_id?: number
          id?: string
          is_enabled?: boolean
          product_pd_id?: number | null
          quantity?: number
          sum?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_product_value_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_products: {
        Row: {
          comments: string | null
          crm_account: string
          currency: string | null
          deal_id: string
          discount: number
          discount_type: string | null
          id: string
          is_enabled: boolean
          item_price: number
          name: string | null
          pd_id: number
          product_pd_id: number | null
          quantity: number
          sum: number
          synced_at: string
          variation_pd_id: number | null
        }
        Insert: {
          comments?: string | null
          crm_account: string
          currency?: string | null
          deal_id: string
          discount?: number
          discount_type?: string | null
          id?: string
          is_enabled?: boolean
          item_price?: number
          name?: string | null
          pd_id: number
          product_pd_id?: number | null
          quantity?: number
          sum?: number
          synced_at?: string
          variation_pd_id?: number | null
        }
        Update: {
          comments?: string | null
          crm_account?: string
          currency?: string | null
          deal_id?: string
          discount?: number
          discount_type?: string | null
          id?: string
          is_enabled?: boolean
          item_price?: number
          name?: string | null
          pd_id?: number
          product_pd_id?: number | null
          quantity?: number
          sum?: number
          synced_at?: string
          variation_pd_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_products_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stage_history: {
        Row: {
          changed_at: string
          crm_account: string
          deal_id: string
          from_stage_pd_id: number | null
          id: string
          source: string
          to_stage_pd_id: number
        }
        Insert: {
          changed_at: string
          crm_account: string
          deal_id: string
          from_stage_pd_id?: number | null
          id?: string
          source?: string
          to_stage_pd_id: number
        }
        Update: {
          changed_at?: string
          crm_account?: string
          deal_id?: string
          from_stage_pd_id?: number | null
          id?: string
          source?: string
          to_stage_pd_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          activities_count: number
          created_at_source: string | null
          crm_account: string | null
          currency: string | null
          custom_fields: Json
          expected_close_date: string | null
          id: string
          is_deleted: boolean
          label_ids: number[]
          lost_at: string | null
          lost_reason: string | null
          next_activity_id: number | null
          org_name: string | null
          org_pd_id: number | null
          owner_name: string | null
          owner_pd_id: number | null
          person_name: string | null
          person_pd_id: number | null
          pipedrive_deal_id: string
          pipeline_pd_id: number | null
          probability: number | null
          products_count: number
          stage_changed_at: string | null
          stage_id: string | null
          stage_name: string | null
          status: string | null
          synced_at: string
          title: string | null
          updated_at_source: string | null
          value: number | null
          won_at: string | null
        }
        Insert: {
          activities_count?: number
          created_at_source?: string | null
          crm_account?: string | null
          currency?: string | null
          custom_fields?: Json
          expected_close_date?: string | null
          id?: string
          is_deleted?: boolean
          label_ids?: number[]
          lost_at?: string | null
          lost_reason?: string | null
          next_activity_id?: number | null
          org_name?: string | null
          org_pd_id?: number | null
          owner_name?: string | null
          owner_pd_id?: number | null
          person_name?: string | null
          person_pd_id?: number | null
          pipedrive_deal_id: string
          pipeline_pd_id?: number | null
          probability?: number | null
          products_count?: number
          stage_changed_at?: string | null
          stage_id?: string | null
          stage_name?: string | null
          status?: string | null
          synced_at?: string
          title?: string | null
          updated_at_source?: string | null
          value?: number | null
          won_at?: string | null
        }
        Update: {
          activities_count?: number
          created_at_source?: string | null
          crm_account?: string | null
          currency?: string | null
          custom_fields?: Json
          expected_close_date?: string | null
          id?: string
          is_deleted?: boolean
          label_ids?: number[]
          lost_at?: string | null
          lost_reason?: string | null
          next_activity_id?: number | null
          org_name?: string | null
          org_pd_id?: number | null
          owner_name?: string | null
          owner_pd_id?: number | null
          person_name?: string | null
          person_pd_id?: number | null
          pipedrive_deal_id?: string
          pipeline_pd_id?: number | null
          probability?: number | null
          products_count?: number
          stage_changed_at?: string | null
          stage_id?: string | null
          stage_name?: string | null
          status?: string | null
          synced_at?: string
          title?: string | null
          updated_at_source?: string | null
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
      event_batches: {
        Row: {
          created_at: string
          end_date: string | null
          event_id: string
          id: string
          name: string
          sort_order: number
          start_date: string | null
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          event_id: string
          id?: string
          name: string
          sort_order?: number
          start_date?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string | null
          event_id?: string
          id?: string
          name?: string
          sort_order?: number
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_batches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
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
      event_integrations: {
        Row: {
          credentials: Json
          event_id: string
          integration_name: string
        }
        Insert: {
          credentials?: Json
          event_id: string
          integration_name: string
        }
        Update: {
          credentials?: Json
          event_id?: string
          integration_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_integrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_users: {
        Row: {
          event_id: string
          user_id: string
        }
        Insert: {
          event_id: string
          user_id: string
        }
        Update: {
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_users_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          name: string
          paying_goal: number | null
          previous_event_slug: string | null
          slug: string
          start_date: string | null
          sympla_event_id: string | null
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          paying_goal?: number | null
          previous_event_slug?: string | null
          slug: string
          start_date?: string | null
          sympla_event_id?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          paying_goal?: number | null
          previous_event_slug?: string | null
          slug?: string
          start_date?: string | null
          sympla_event_id?: string | null
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
          event_id: string | null
          id: string
          label: string
          metric_key: string
          period_end: string
          period_start: string
          quota_key: string | null
          receipt_year: number | null
          target_value: number
          ticket_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_id?: string | null
          id?: string
          label: string
          metric_key: string
          period_end: string
          period_start: string
          quota_key?: string | null
          receipt_year?: number | null
          target_value: number
          ticket_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_id?: string | null
          id?: string
          label?: string
          metric_key?: string
          period_end?: string
          period_start?: string
          quota_key?: string | null
          receipt_year?: number | null
          target_value?: number
          ticket_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
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
      sponsorship_config: {
        Row: {
          copied_from_event_id: string | null
          created_at: string
          crm_account: string | null
          deliverables: Json
          event_id: string
          field_mapping: Json
          pipelines: Json
          product_code: string | null
          product_rules: Json
          product_term: string | null
          quotas: Json
          sales_deadline: string | null
          sales_window_end: string | null
          sales_window_start: string | null
          stage_groups: Json
          temperature_labels: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          copied_from_event_id?: string | null
          created_at?: string
          crm_account?: string | null
          deliverables?: Json
          event_id: string
          field_mapping?: Json
          pipelines?: Json
          product_code?: string | null
          product_rules?: Json
          product_term?: string | null
          quotas?: Json
          sales_deadline?: string | null
          sales_window_end?: string | null
          sales_window_start?: string | null
          stage_groups?: Json
          temperature_labels?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          copied_from_event_id?: string | null
          created_at?: string
          crm_account?: string | null
          deliverables?: Json
          event_id?: string
          field_mapping?: Json
          pipelines?: Json
          product_code?: string | null
          product_rules?: Json
          product_term?: string | null
          quotas?: Json
          sales_deadline?: string | null
          sales_window_end?: string | null
          sales_window_start?: string | null
          stage_groups?: Json
          temperature_labels?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsorship_config_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsorship_pending: {
        Row: {
          created_at: string
          deal_id: string | null
          details: Json
          event_id: string
          id: string
          kind: string
          ref_key: string
          resolution: Json | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          deal_id?: string | null
          details?: Json
          event_id: string
          id?: string
          kind: string
          ref_key: string
          resolution?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          deal_id?: string | null
          details?: Json
          event_id?: string
          id?: string
          kind?: string
          ref_key?: string
          resolution?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsorship_pending_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsorship_pending_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      team_coupons: {
        Row: {
          coupon_code: string
          user_id: string
        }
        Insert: {
          coupon_code: string
          user_id: string
        }
        Update: {
          coupon_code?: string
          user_id?: string
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
      can_see_crm_account: { Args: { _account: string }; Returns: boolean }
      can_see_event: { Args: { _event_id: string }; Returns: boolean }
      contact_key: { Args: { kind: string; v: string }; Returns: string }
      contact_search_keys: {
        Args: { p_term: string }
        Returns: {
          email_key: string
          phone_key: string
        }[]
      }
      get_buyer_events: {
        Args: { p_slug: string }
        Returns: {
          end_date: string
          name: string
          slug: string
        }[]
      }
      get_buyer_rows: {
        Args: { p_slug: string }
        Returns: {
          order_data: Json
          participant_data: Json
          sympla_order_id: string
        }[]
      }
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
      is_seller: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "viewer" | "seller"
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
      app_role: ["admin", "viewer", "seller"],
    },
  },
} as const
