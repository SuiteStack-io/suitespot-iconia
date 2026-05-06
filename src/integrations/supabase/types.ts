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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          id: string
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          id?: string
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          id?: string
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      blocked_dates: {
        Row: {
          blocked_date: string
          created_at: string
          created_by: string | null
          id: string
          reason: string | null
          unit_id: string | null
        }
        Insert: {
          blocked_date: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          unit_id?: string | null
        }
        Update: {
          blocked_date?: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocked_dates_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          content: string | null
          created_at: string
          excerpt: string | null
          featured_image_url: string | null
          h1_title: string
          h2_subtitle: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          published_at: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          h1_title: string
          h2_subtitle?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          h1_title?: string
          h2_subtitle?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_com_sync_log: {
        Row: {
          booking_com_room_id: string | null
          created_at: string | null
          direction: string
          error_message: string | null
          id: string
          operation_type: string
          request_payload: Json | null
          response_payload: Json | null
          status: string
          unit_id: string | null
        }
        Insert: {
          booking_com_room_id?: string | null
          created_at?: string | null
          direction: string
          error_message?: string | null
          id?: string
          operation_type: string
          request_payload?: Json | null
          response_payload?: Json | null
          status: string
          unit_id?: string | null
        }
        Update: {
          booking_com_room_id?: string | null
          created_at?: string | null
          direction?: string
          error_message?: string | null
          id?: string
          operation_type?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_com_sync_log_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_markup_settings: {
        Row: {
          channel_id: string | null
          channel_name: string
          created_at: string
          id: string
          is_active: boolean
          markup_percentage: number
          property_id: string | null
          updated_at: string
        }
        Insert: {
          channel_id?: string | null
          channel_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          markup_percentage?: number
          property_id?: string | null
          updated_at?: string
        }
        Update: {
          channel_id?: string | null
          channel_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          markup_percentage?: number
          property_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      channex_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          message: string
          property_id: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          message: string
          property_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          message?: string
          property_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: []
      }
      channex_bookings: {
        Row: {
          acknowledged: boolean
          adults: number
          arrival_date: string | null
          booking_data: Json | null
          channex_booking_id: string
          channex_revision_id: string | null
          children: number
          created_at: string
          currency: string
          departure_date: string | null
          guest_country: string | null
          guest_email: string
          guest_name: string
          guest_phone: string | null
          id: string
          ota_name: string
          ota_reservation_code: string | null
          property_id: string | null
          rate_plan_id: string | null
          room_type_id: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          acknowledged?: boolean
          adults?: number
          arrival_date?: string | null
          booking_data?: Json | null
          channex_booking_id: string
          channex_revision_id?: string | null
          children?: number
          created_at?: string
          currency?: string
          departure_date?: string | null
          guest_country?: string | null
          guest_email: string
          guest_name: string
          guest_phone?: string | null
          id?: string
          ota_name: string
          ota_reservation_code?: string | null
          property_id?: string | null
          rate_plan_id?: string | null
          room_type_id?: string | null
          status?: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          acknowledged?: boolean
          adults?: number
          arrival_date?: string | null
          booking_data?: Json | null
          channex_booking_id?: string
          channex_revision_id?: string | null
          children?: number
          created_at?: string
          currency?: string
          departure_date?: string | null
          guest_country?: string | null
          guest_email?: string
          guest_name?: string
          guest_phone?: string | null
          id?: string
          ota_name?: string
          ota_reservation_code?: string | null
          property_id?: string | null
          rate_plan_id?: string | null
          room_type_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channex_bookings_rate_plan_id_fkey"
            columns: ["rate_plan_id"]
            isOneToOne: false
            referencedRelation: "rate_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channex_bookings_room_type_id_fkey"
            columns: ["room_type_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      channex_mappings: {
        Row: {
          channex_data: Json | null
          channex_id: string
          created_at: string
          entity_type: string
          error_message: string | null
          id: string
          last_synced_at: string | null
          local_id: string
          sync_status: string
          updated_at: string
        }
        Insert: {
          channex_data?: Json | null
          channex_id: string
          created_at?: string
          entity_type: string
          error_message?: string | null
          id?: string
          last_synced_at?: string | null
          local_id: string
          sync_status?: string
          updated_at?: string
        }
        Update: {
          channex_data?: Json | null
          channex_id?: string
          created_at?: string
          entity_type?: string
          error_message?: string | null
          id?: string
          last_synced_at?: string | null
          local_id?: string
          sync_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      channex_property_config: {
        Row: {
          address: string
          channex_property_id: string | null
          city: string
          country: string
          created_at: string
          currency: string
          description: string | null
          email: string
          id: string
          latitude: number | null
          longitude: number | null
          phone: string
          property_name: string
          timezone: string
          updated_at: string
          zip_code: string
        }
        Insert: {
          address?: string
          channex_property_id?: string | null
          city?: string
          country?: string
          created_at?: string
          currency?: string
          description?: string | null
          email?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          phone?: string
          property_name: string
          timezone?: string
          updated_at?: string
          zip_code?: string
        }
        Update: {
          address?: string
          channex_property_id?: string | null
          city?: string
          country?: string
          created_at?: string
          currency?: string
          description?: string | null
          email?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          phone?: string
          property_name?: string
          timezone?: string
          updated_at?: string
          zip_code?: string
        }
        Relationships: []
      }
      channex_sync_logs: {
        Row: {
          created_at: string
          endpoint: string
          error_message: string | null
          function_name: string
          id: string
          property_id: string | null
          request_payload: Json | null
          response_payload: Json | null
          status_code: number | null
          success: boolean
        }
        Insert: {
          created_at?: string
          endpoint: string
          error_message?: string | null
          function_name: string
          id?: string
          property_id?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          status_code?: number | null
          success: boolean
        }
        Update: {
          created_at?: string
          endpoint?: string
          error_message?: string | null
          function_name?: string
          id?: string
          property_id?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          status_code?: number | null
          success?: boolean
        }
        Relationships: []
      }
      channex_sync_queue: {
        Row: {
          created_at: string
          date_from: string | null
          date_to: string | null
          entity_id: string | null
          error_message: string | null
          id: string
          payload: Json | null
          processed_at: string | null
          property_id: string | null
          status: string
          sync_type: string
        }
        Insert: {
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          entity_id?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          property_id?: string | null
          status?: string
          sync_type: string
        }
        Update: {
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          entity_id?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          property_id?: string | null
          status?: string
          sync_type?: string
        }
        Relationships: []
      }
      check_in_agreements: {
        Row: {
          created_at: string
          guest_date_of_birth: string | null
          guest_email: string
          guest_full_name: string
          guest_nationality: string | null
          guest_phone: string
          id: string
          reservation_id: string
          signature_url: string
          signed_at: string
          terms_accepted: boolean
        }
        Insert: {
          created_at?: string
          guest_date_of_birth?: string | null
          guest_email: string
          guest_full_name: string
          guest_nationality?: string | null
          guest_phone: string
          id?: string
          reservation_id: string
          signature_url: string
          signed_at?: string
          terms_accepted?: boolean
        }
        Update: {
          created_at?: string
          guest_date_of_birth?: string | null
          guest_email?: string
          guest_full_name?: string
          guest_nationality?: string | null
          guest_phone?: string
          id?: string
          reservation_id?: string
          signature_url?: string
          signed_at?: string
          terms_accepted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "check_in_agreements_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          default_currency: string
          default_timezone: string
          id: string
          logo_url: string | null
          name: string
          updated_at: string
          vat_rate: number
        }
        Insert: {
          created_at?: string
          default_currency?: string
          default_timezone?: string
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          created_at?: string
          default_currency?: string
          default_timezone?: string
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string
          vat_rate?: number
        }
        Relationships: []
      }
      derived_rate_plan_mappings: {
        Row: {
          base_rate_plan_id: string
          channel_markup_id: string
          channel_name: string
          channex_base_rate_plan_id: string
          channex_derived_rate_plan_id: string
          created_at: string
          id: string
          markup_percentage: number
          property_id: string | null
          updated_at: string
        }
        Insert: {
          base_rate_plan_id: string
          channel_markup_id: string
          channel_name: string
          channex_base_rate_plan_id: string
          channex_derived_rate_plan_id: string
          created_at?: string
          id?: string
          markup_percentage: number
          property_id?: string | null
          updated_at?: string
        }
        Update: {
          base_rate_plan_id?: string
          channel_markup_id?: string
          channel_name?: string
          channex_base_rate_plan_id?: string
          channex_derived_rate_plan_id?: string
          created_at?: string
          id?: string
          markup_percentage?: number
          property_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "derived_rate_plan_mappings_base_rate_plan_id_fkey"
            columns: ["base_rate_plan_id"]
            isOneToOne: false
            referencedRelation: "rate_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "derived_rate_plan_mappings_channel_markup_id_fkey"
            columns: ["channel_markup_id"]
            isOneToOne: false
            referencedRelation: "channel_markup_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_items: {
        Row: {
          answer: string
          created_at: string
          id: string
          is_published: boolean
          question: string
          sequence_order: number
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          is_published?: boolean
          question: string
          sequence_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          is_published?: boolean
          question?: string
          sequence_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      guest_accounts: {
        Row: {
          created_at: string
          created_by: string | null
          first_login_at: string | null
          id: string
          is_active: boolean | null
          last_login_at: string | null
          password_hash: string
          reservation_id: string
          username: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          first_login_at?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          password_hash: string
          reservation_id: string
          username: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          first_login_at?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          password_hash?: string
          reservation_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_accounts_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_inventory_access: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          kyc_link_id: string
          unit_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          kyc_link_id: string
          unit_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          kyc_link_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_inventory_access_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_inventory_access_kyc_link_id_fkey"
            columns: ["kyc_link_id"]
            isOneToOne: false
            referencedRelation: "kyc_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_inventory_access_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_tickets: {
        Row: {
          amenity_id: string | null
          assigned_to: string | null
          created_at: string
          description: string
          guest_account_id: string
          id: string
          photo_url: string | null
          photo_urls: string[] | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          reservation_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          ticket_type: Database["public"]["Enums"]["ticket_type"]
          title: string
          updated_at: string
        }
        Insert: {
          amenity_id?: string | null
          assigned_to?: string | null
          created_at?: string
          description: string
          guest_account_id: string
          id?: string
          photo_url?: string | null
          photo_urls?: string[] | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          reservation_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_type: Database["public"]["Enums"]["ticket_type"]
          title: string
          updated_at?: string
        }
        Update: {
          amenity_id?: string | null
          assigned_to?: string | null
          created_at?: string
          description?: string
          guest_account_id?: string
          id?: string
          photo_url?: string | null
          photo_urls?: string[] | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          reservation_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          ticket_type?: Database["public"]["Enums"]["ticket_type"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_tickets_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "property_amenities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_tickets_guest_account_id_fkey"
            columns: ["guest_account_id"]
            isOneToOne: false
            referencedRelation: "guest_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_tickets_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_tickets_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      housekeeping_logs: {
        Row: {
          actual_duration_minutes: number | null
          cleaned_by: string | null
          cleaning_completed_at: string
          cleaning_started_at: string | null
          created_at: string
          id: string
          issue_type: string | null
          notes: string | null
          reservation_id: string
          unit_id: string
        }
        Insert: {
          actual_duration_minutes?: number | null
          cleaned_by?: string | null
          cleaning_completed_at?: string
          cleaning_started_at?: string | null
          created_at?: string
          id?: string
          issue_type?: string | null
          notes?: string | null
          reservation_id: string
          unit_id: string
        }
        Update: {
          actual_duration_minutes?: number | null
          cleaned_by?: string | null
          cleaning_completed_at?: string
          cleaning_started_at?: string | null
          created_at?: string
          id?: string
          issue_type?: string | null
          notes?: string | null
          reservation_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "housekeeping_logs_cleaned_by_fkey"
            columns: ["cleaned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_logs_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housekeeping_logs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_links: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          guest_contact: string | null
          guest_name: string
          id: string
          outcome: string | null
          outcome_at: string | null
          outcome_by: string | null
          status: string
          token: string
          unit_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          guest_contact?: string | null
          guest_name: string
          id?: string
          outcome?: string | null
          outcome_at?: string | null
          outcome_by?: string | null
          status?: string
          token: string
          unit_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          guest_contact?: string | null
          guest_name?: string
          id?: string
          outcome?: string | null
          outcome_at?: string | null
          outcome_by?: string | null
          status?: string
          token?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_links_outcome_by_fkey"
            columns: ["outcome_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_links_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      media_library: {
        Row: {
          bucket_id: string
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          tags: string[] | null
          title: string | null
          unit_id: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          bucket_id: string
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          tags?: string[] | null
          title?: string | null
          unit_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          bucket_id?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          tags?: string[] | null
          title?: string | null
          unit_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_library_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          channex_booking_id: string | null
          channex_thread_id: string
          created_at: string | null
          id: string
          is_closed: boolean | null
          is_read: boolean | null
          last_message_at: string | null
          last_message_sender: string | null
          last_message_text: string | null
          last_notification_sent_at: string | null
          message_count: number | null
          property_id: string | null
          provider: string
          reservation_id: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          channex_booking_id?: string | null
          channex_thread_id: string
          created_at?: string | null
          id?: string
          is_closed?: boolean | null
          is_read?: boolean | null
          last_message_at?: string | null
          last_message_sender?: string | null
          last_message_text?: string | null
          last_notification_sent_at?: string | null
          message_count?: number | null
          property_id?: string | null
          provider: string
          reservation_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          channex_booking_id?: string | null
          channex_thread_id?: string
          created_at?: string | null
          id?: string
          is_closed?: boolean | null
          is_read?: boolean | null
          last_message_at?: string | null
          last_message_sender?: string | null
          last_message_text?: string | null
          last_notification_sent_at?: string | null
          message_count?: number | null
          property_id?: string | null
          provider?: string
          reservation_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          channex_message_id: string | null
          channex_sent_at: string | null
          created_at: string | null
          id: string
          message: string | null
          sender: string
          thread_id: string
        }
        Insert: {
          attachments?: Json | null
          channex_message_id?: string | null
          channex_sent_at?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          sender: string
          thread_id: string
        }
        Update: {
          attachments?: Json | null
          channex_message_id?: string | null
          channex_sent_at?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          sender?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      nearby_amenities: {
        Row: {
          address: string | null
          created_at: string
          description: string
          distance_meters: number
          hours: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          phone: string | null
          type: string
          unit_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          description: string
          distance_meters: number
          hours?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          phone?: string | null
          type: string
          unit_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          description?: string
          distance_meters?: number
          hours?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string | null
          type?: string
          unit_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nearby_amenities_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          read: boolean | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      our_story_slideshow: {
        Row: {
          blur_placeholder: string | null
          created_at: string
          id: string
          image_url: string
          image_url_lg: string | null
          image_url_md: string | null
          image_url_sm: string | null
          sequence_order: number
          updated_at: string
        }
        Insert: {
          blur_placeholder?: string | null
          created_at?: string
          id?: string
          image_url: string
          image_url_lg?: string | null
          image_url_md?: string | null
          image_url_sm?: string | null
          sequence_order?: number
          updated_at?: string
        }
        Update: {
          blur_placeholder?: string | null
          created_at?: string
          id?: string
          image_url?: string
          image_url_lg?: string | null
          image_url_md?: string | null
          image_url_sm?: string | null
          sequence_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      pricing_log: {
        Row: {
          base_rate: number | null
          calculated_at: string
          calculated_rate: number | null
          clamp_direction: string | null
          created_at: string
          date_priced: string
          day_of_week_multiplier: number | null
          final_rate: number | null
          id: string
          lead_time_adjustment_percent: number | null
          lead_time_days: number | null
          month_phase: string
          occupancy_adjustment_percent: number | null
          occupancy_percent: number | null
          occupancy_tier: number | null
          orphan_modifier: number | null
          orphan_status: string | null
          override_active: boolean | null
          override_id: string | null
          pace_index: number | null
          promotion_discount_percent: number | null
          promotion_id: string | null
          property_id: string
          rate_plan_id: string | null
          revenue_achievement_percent: number | null
          revenue_adjustment_percent: number | null
          revenue_total: number | null
          room_type: string | null
          room_type_max_rate: number | null
          room_type_min_rate: number | null
          target_month: string
          was_clamped: boolean | null
        }
        Insert: {
          base_rate?: number | null
          calculated_at?: string
          calculated_rate?: number | null
          clamp_direction?: string | null
          created_at?: string
          date_priced: string
          day_of_week_multiplier?: number | null
          final_rate?: number | null
          id?: string
          lead_time_adjustment_percent?: number | null
          lead_time_days?: number | null
          month_phase: string
          occupancy_adjustment_percent?: number | null
          occupancy_percent?: number | null
          occupancy_tier?: number | null
          orphan_modifier?: number | null
          orphan_status?: string | null
          override_active?: boolean | null
          override_id?: string | null
          pace_index?: number | null
          promotion_discount_percent?: number | null
          promotion_id?: string | null
          property_id: string
          rate_plan_id?: string | null
          revenue_achievement_percent?: number | null
          revenue_adjustment_percent?: number | null
          revenue_total?: number | null
          room_type?: string | null
          room_type_max_rate?: number | null
          room_type_min_rate?: number | null
          target_month: string
          was_clamped?: boolean | null
        }
        Update: {
          base_rate?: number | null
          calculated_at?: string
          calculated_rate?: number | null
          clamp_direction?: string | null
          created_at?: string
          date_priced?: string
          day_of_week_multiplier?: number | null
          final_rate?: number | null
          id?: string
          lead_time_adjustment_percent?: number | null
          lead_time_days?: number | null
          month_phase?: string
          occupancy_adjustment_percent?: number | null
          occupancy_percent?: number | null
          occupancy_tier?: number | null
          orphan_modifier?: number | null
          orphan_status?: string | null
          override_active?: boolean | null
          override_id?: string | null
          pace_index?: number | null
          promotion_discount_percent?: number | null
          promotion_id?: string | null
          property_id?: string
          rate_plan_id?: string | null
          revenue_achievement_percent?: number | null
          revenue_adjustment_percent?: number | null
          revenue_total?: number | null
          room_type?: string | null
          room_type_max_rate?: number | null
          room_type_min_rate?: number | null
          target_month?: string
          was_clamped?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_log_override_id_fkey"
            columns: ["override_id"]
            isOneToOne: false
            referencedRelation: "pricing_overrides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_log_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotional_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_log_rate_plan_id_fkey"
            columns: ["rate_plan_id"]
            isOneToOne: false
            referencedRelation: "rate_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          override_date: string
          override_type: string
          property_id: string
          reason: string | null
          room_type: string | null
          value: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          override_date: string
          override_type?: string
          property_id: string
          reason?: string | null
          room_type?: string | null
          value: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          override_date?: string
          override_type?: string
          property_id?: string
          reason?: string | null
          room_type?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_overrides_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          aggression_level: number
          base_tiers: Json | null
          channex_max_price_synced: boolean
          channex_min_price_synced: boolean
          created_at: string
          day_of_week_multipliers: Json
          id: string
          is_enabled: boolean
          last_minute_strategy: string
          monthly_revenue_stretch: number | null
          monthly_revenue_target: number | null
          occupancy_adjustments: Json
          occupancy_thresholds: Json
          pace_index_bump_threshold: number
          property_id: string
          revenue_adjustments_phase_a: Json
          revenue_adjustments_phase_b: Json
          revenue_occupancy_conflict_cap: number
          revenue_occupancy_conflict_occupancy_max: number
          revenue_occupancy_conflict_revenue_min: number
          revenue_thresholds: Json
          updated_at: string
        }
        Insert: {
          aggression_level?: number
          base_tiers?: Json | null
          channex_max_price_synced?: boolean
          channex_min_price_synced?: boolean
          created_at?: string
          day_of_week_multipliers?: Json
          id?: string
          is_enabled?: boolean
          last_minute_strategy?: string
          monthly_revenue_stretch?: number | null
          monthly_revenue_target?: number | null
          occupancy_adjustments?: Json
          occupancy_thresholds?: Json
          pace_index_bump_threshold?: number
          property_id: string
          revenue_adjustments_phase_a?: Json
          revenue_adjustments_phase_b?: Json
          revenue_occupancy_conflict_cap?: number
          revenue_occupancy_conflict_occupancy_max?: number
          revenue_occupancy_conflict_revenue_min?: number
          revenue_thresholds?: Json
          updated_at?: string
        }
        Update: {
          aggression_level?: number
          base_tiers?: Json | null
          channex_max_price_synced?: boolean
          channex_min_price_synced?: boolean
          created_at?: string
          day_of_week_multipliers?: Json
          id?: string
          is_enabled?: boolean
          last_minute_strategy?: string
          monthly_revenue_stretch?: number | null
          monthly_revenue_target?: number | null
          occupancy_adjustments?: Json
          occupancy_thresholds?: Json
          pace_index_bump_threshold?: number
          property_id?: string
          revenue_adjustments_phase_a?: Json
          revenue_adjustments_phase_b?: Json
          revenue_occupancy_conflict_cap?: number
          revenue_occupancy_conflict_occupancy_max?: number
          revenue_occupancy_conflict_revenue_min?: number
          revenue_thresholds?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          full_name: string | null
          id: string
          is_system_admin: boolean | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          is_system_admin?: boolean | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_system_admin?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      promotional_periods: {
        Row: {
          booking_window_end: string
          booking_window_start: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          min_stay: number | null
          name: string
          property_id: string
          room_types: string[] | null
          stay_end: string
          stay_start: string
          updated_at: string
        }
        Insert: {
          booking_window_end: string
          booking_window_start: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          discount_type?: string
          discount_value: number
          id?: string
          is_active?: boolean
          min_stay?: number | null
          name: string
          property_id: string
          room_types?: string[] | null
          stay_end: string
          stay_start: string
          updated_at?: string
        }
        Update: {
          booking_window_end?: string
          booking_window_start?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          min_stay?: number | null
          name?: string
          property_id?: string
          room_types?: string[] | null
          stay_end?: string
          stay_start?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotional_periods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotional_periods_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string
          address_line_2: string | null
          channex_last_sync: string | null
          channex_property_id: string | null
          channex_synced: boolean | null
          city: string
          company_id: string | null
          country: string
          created_at: string | null
          created_by: string | null
          currency: string
          default_checkin_time: string | null
          default_checkout_time: string | null
          default_commission_rate: number | null
          description: string | null
          email: string
          from_email_ai: string | null
          from_email_frontdesk: string | null
          from_email_housekeeping: string | null
          from_email_notifications: string | null
          from_email_reservations: string | null
          from_name: string | null
          has_landlord: boolean
          id: string
          is_active: boolean | null
          is_default: boolean | null
          landlord_share_percentage: number
          latitude: number | null
          legal_name: string | null
          longitude: number | null
          name: string
          occupancy_target_annual: number | null
          off_peak_days: number[] | null
          phone: string | null
          property_type: string | null
          revenue_recognition_method: string
          state: string | null
          support_email: string | null
          support_phone: string | null
          support_whatsapp: string | null
          timezone: string
          updated_at: string | null
          vat_rate: number | null
          website: string | null
          weekend_days: number[] | null
          wifi_network: string | null
          wifi_password: string | null
          zip_code: string | null
        }
        Insert: {
          address: string
          address_line_2?: string | null
          channex_last_sync?: string | null
          channex_property_id?: string | null
          channex_synced?: boolean | null
          city: string
          company_id?: string | null
          country?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string
          default_checkin_time?: string | null
          default_checkout_time?: string | null
          default_commission_rate?: number | null
          description?: string | null
          email: string
          from_email_ai?: string | null
          from_email_frontdesk?: string | null
          from_email_housekeeping?: string | null
          from_email_notifications?: string | null
          from_email_reservations?: string | null
          from_name?: string | null
          has_landlord?: boolean
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          landlord_share_percentage?: number
          latitude?: number | null
          legal_name?: string | null
          longitude?: number | null
          name: string
          occupancy_target_annual?: number | null
          off_peak_days?: number[] | null
          phone?: string | null
          property_type?: string | null
          revenue_recognition_method?: string
          state?: string | null
          support_email?: string | null
          support_phone?: string | null
          support_whatsapp?: string | null
          timezone?: string
          updated_at?: string | null
          vat_rate?: number | null
          website?: string | null
          weekend_days?: number[] | null
          wifi_network?: string | null
          wifi_password?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string
          address_line_2?: string | null
          channex_last_sync?: string | null
          channex_property_id?: string | null
          channex_synced?: boolean | null
          city?: string
          company_id?: string | null
          country?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string
          default_checkin_time?: string | null
          default_checkout_time?: string | null
          default_commission_rate?: number | null
          description?: string | null
          email?: string
          from_email_ai?: string | null
          from_email_frontdesk?: string | null
          from_email_housekeeping?: string | null
          from_email_notifications?: string | null
          from_email_reservations?: string | null
          from_name?: string | null
          has_landlord?: boolean
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          landlord_share_percentage?: number
          latitude?: number | null
          legal_name?: string | null
          longitude?: number | null
          name?: string
          occupancy_target_annual?: number | null
          off_peak_days?: number[] | null
          phone?: string | null
          property_type?: string | null
          revenue_recognition_method?: string
          state?: string | null
          support_email?: string | null
          support_phone?: string | null
          support_whatsapp?: string | null
          timezone?: string
          updated_at?: string | null
          vat_rate?: number | null
          website?: string | null
          weekend_days?: number[] | null
          wifi_network?: string | null
          wifi_password?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_amenities: {
        Row: {
          category: string
          created_at: string
          id: string
          is_available: boolean | null
          location: string
          name: string
          notes: string | null
          unit_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_available?: boolean | null
          location: string
          name: string
          notes?: string | null
          unit_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_available?: boolean | null
          location?: string
          name?: string
          notes?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_amenities_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_plan_date_overrides: {
        Row: {
          created_at: string | null
          id: string
          override_date: string
          rate: number
          rate_plan_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          override_date: string
          rate: number
          rate_plan_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          override_date?: string
          rate?: number
          rate_plan_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_plan_date_overrides_rate_plan_id_fkey"
            columns: ["rate_plan_id"]
            isOneToOne: false
            referencedRelation: "rate_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_plan_prices: {
        Row: {
          base_occupancy: number | null
          created_at: string
          id: string
          max_occupancy: number | null
          max_rate: number | null
          min_rate: number | null
          min_stay: number
          off_peak_rate: number | null
          rate_plan_id: string
          room_type: string
          unit_id: string | null
          weekday_rate: number
          weekend_rate: number
        }
        Insert: {
          base_occupancy?: number | null
          created_at?: string
          id?: string
          max_occupancy?: number | null
          max_rate?: number | null
          min_rate?: number | null
          min_stay?: number
          off_peak_rate?: number | null
          rate_plan_id: string
          room_type: string
          unit_id?: string | null
          weekday_rate: number
          weekend_rate: number
        }
        Update: {
          base_occupancy?: number | null
          created_at?: string
          id?: string
          max_occupancy?: number | null
          max_rate?: number | null
          min_rate?: number | null
          min_stay?: number
          off_peak_rate?: number | null
          rate_plan_id?: string
          room_type?: string
          unit_id?: string | null
          weekday_rate?: number
          weekend_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "rate_plan_prices_rate_plan_id_fkey"
            columns: ["rate_plan_id"]
            isOneToOne: false
            referencedRelation: "rate_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_plan_prices_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_plan_restrictions: {
        Row: {
          channex_task_id: string | null
          closed_to_arrival: boolean | null
          closed_to_departure: boolean | null
          created_at: string | null
          date_from: string
          date_to: string
          id: string
          max_stay: number | null
          min_stay_arrival: number | null
          min_stay_through: number | null
          rate: number | null
          rate_plan_id: string
          stop_sell: boolean | null
          synced_to_channex: boolean | null
          updated_at: string | null
        }
        Insert: {
          channex_task_id?: string | null
          closed_to_arrival?: boolean | null
          closed_to_departure?: boolean | null
          created_at?: string | null
          date_from: string
          date_to: string
          id?: string
          max_stay?: number | null
          min_stay_arrival?: number | null
          min_stay_through?: number | null
          rate?: number | null
          rate_plan_id: string
          stop_sell?: boolean | null
          synced_to_channex?: boolean | null
          updated_at?: string | null
        }
        Update: {
          channex_task_id?: string | null
          closed_to_arrival?: boolean | null
          closed_to_departure?: boolean | null
          created_at?: string | null
          date_from?: string
          date_to?: string
          id?: string
          max_stay?: number | null
          min_stay_arrival?: number | null
          min_stay_through?: number | null
          rate?: number | null
          rate_plan_id?: string
          stop_sell?: boolean | null
          synced_to_channex?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_plan_restrictions_rate_plan_id_fkey"
            columns: ["rate_plan_id"]
            isOneToOne: false
            referencedRelation: "rate_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_plan_value_adds: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_per_night: boolean | null
          name: string
          price: number | null
          rate_plan_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_per_night?: boolean | null
          name: string
          price?: number | null
          rate_plan_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_per_night?: boolean | null
          name?: string
          price?: number | null
          rate_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_plan_value_adds_rate_plan_id_fkey"
            columns: ["rate_plan_id"]
            isOneToOne: false
            referencedRelation: "rate_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_plans: {
        Row: {
          advance_booking_days: number | null
          applicable_room_types: string[] | null
          booking_com_id: string | null
          cancellation_policy: string | null
          created_at: string
          currency: string | null
          default_closed_to_arrival: boolean | null
          default_closed_to_departure: boolean | null
          default_max_stay: number | null
          default_min_stay_arrival: number[] | null
          default_min_stay_through: number[] | null
          default_stop_sell: boolean | null
          extra_adult_rate: number | null
          extra_child_rate: number | null
          id: string
          is_active: boolean
          is_default: boolean
          meal_plan: string | null
          meal_plan_price: number | null
          name: string
          priority: number
          property_id: string | null
          room_type: string | null
          sell_mode: string | null
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          advance_booking_days?: number | null
          applicable_room_types?: string[] | null
          booking_com_id?: string | null
          cancellation_policy?: string | null
          created_at?: string
          currency?: string | null
          default_closed_to_arrival?: boolean | null
          default_closed_to_departure?: boolean | null
          default_max_stay?: number | null
          default_min_stay_arrival?: number[] | null
          default_min_stay_through?: number[] | null
          default_stop_sell?: boolean | null
          extra_adult_rate?: number | null
          extra_child_rate?: number | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          meal_plan?: string | null
          meal_plan_price?: number | null
          name: string
          priority?: number
          property_id?: string | null
          room_type?: string | null
          sell_mode?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          advance_booking_days?: number | null
          applicable_room_types?: string[] | null
          booking_com_id?: string | null
          cancellation_policy?: string | null
          created_at?: string
          currency?: string | null
          default_closed_to_arrival?: boolean | null
          default_closed_to_departure?: boolean | null
          default_max_stay?: number | null
          default_min_stay_arrival?: number[] | null
          default_min_stay_through?: number[] | null
          default_stop_sell?: boolean | null
          extra_adult_rate?: number | null
          extra_child_rate?: number | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          meal_plan?: string | null
          meal_plan_price?: number | null
          name?: string
          priority?: number
          property_id?: string | null
          room_type?: string | null
          sell_mode?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_plans_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_passports: {
        Row: {
          created_at: string | null
          id: string
          passport_url: string
          reservation_id: string
          uploaded_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          passport_url: string
          reservation_id: string
          uploaded_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          passport_url?: string
          reservation_id?: string
          uploaded_at?: string | null
        }
        Relationships: []
      }
      reservations: {
        Row: {
          access_cards_given: number | null
          adults: number | null
          arrival_time: string | null
          booking_reference: string
          booking_screenshot_url: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          channel: string
          channex_booking_id: string | null
          check_in_date: string
          check_out_date: string
          checked_in_at: string | null
          checked_out_at: string | null
          children: number | null
          commission_amount: number | null
          commission_paid: string | null
          commission_paid_at: string | null
          commission_rate: number | null
          confirmation_email_error: string | null
          confirmation_email_sent_at: string | null
          confirmation_email_status: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          currency: string | null
          group_id: string | null
          guest_ages: number[] | null
          guest_genders: string[] | null
          guest_names: string[]
          guest_nationality: string | null
          guest_types: string[] | null
          housekeeping_notes: string | null
          id: string
          id_passport_url: string | null
          id_passport_url_back: string | null
          is_split_reservation: boolean
          last_cleaning_notification_date: string | null
          late_checkout_time: string | null
          marriage_certificate_url: string | null
          mid_stay_cleaning_completed: boolean | null
          net_revenue: number | null
          nights: number | null
          notes: string | null
          number_of_guests: number
          parent_reservation_id: string | null
          payment_method: string | null
          preferred_language: string | null
          price_per_night: number | null
          property_id: string | null
          settled: string | null
          shuffle_log_id: string | null
          shuffled_at: string | null
          shuffled_from_unit_id: string | null
          skip_channex_sync: boolean
          source: string
          status: string
          survey_completed_at: string | null
          survey_sent_at: string | null
          total_price: number | null
          unit_id: string | null
          updated_at: string
          vat_exempt: boolean | null
        }
        Insert: {
          access_cards_given?: number | null
          adults?: number | null
          arrival_time?: string | null
          booking_reference: string
          booking_screenshot_url?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          channel?: string
          channex_booking_id?: string | null
          check_in_date: string
          check_out_date: string
          checked_in_at?: string | null
          checked_out_at?: string | null
          children?: number | null
          commission_amount?: number | null
          commission_paid?: string | null
          commission_paid_at?: string | null
          commission_rate?: number | null
          confirmation_email_error?: string | null
          confirmation_email_sent_at?: string | null
          confirmation_email_status?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string | null
          group_id?: string | null
          guest_ages?: number[] | null
          guest_genders?: string[] | null
          guest_names?: string[]
          guest_nationality?: string | null
          guest_types?: string[] | null
          housekeeping_notes?: string | null
          id?: string
          id_passport_url?: string | null
          id_passport_url_back?: string | null
          is_split_reservation?: boolean
          last_cleaning_notification_date?: string | null
          late_checkout_time?: string | null
          marriage_certificate_url?: string | null
          mid_stay_cleaning_completed?: boolean | null
          net_revenue?: number | null
          nights?: number | null
          notes?: string | null
          number_of_guests: number
          parent_reservation_id?: string | null
          payment_method?: string | null
          preferred_language?: string | null
          price_per_night?: number | null
          property_id?: string | null
          settled?: string | null
          shuffle_log_id?: string | null
          shuffled_at?: string | null
          shuffled_from_unit_id?: string | null
          skip_channex_sync?: boolean
          source?: string
          status: string
          survey_completed_at?: string | null
          survey_sent_at?: string | null
          total_price?: number | null
          unit_id?: string | null
          updated_at?: string
          vat_exempt?: boolean | null
        }
        Update: {
          access_cards_given?: number | null
          adults?: number | null
          arrival_time?: string | null
          booking_reference?: string
          booking_screenshot_url?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          channel?: string
          channex_booking_id?: string | null
          check_in_date?: string
          check_out_date?: string
          checked_in_at?: string | null
          checked_out_at?: string | null
          children?: number | null
          commission_amount?: number | null
          commission_paid?: string | null
          commission_paid_at?: string | null
          commission_rate?: number | null
          confirmation_email_error?: string | null
          confirmation_email_sent_at?: string | null
          confirmation_email_status?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string | null
          group_id?: string | null
          guest_ages?: number[] | null
          guest_genders?: string[] | null
          guest_names?: string[]
          guest_nationality?: string | null
          guest_types?: string[] | null
          housekeeping_notes?: string | null
          id?: string
          id_passport_url?: string | null
          id_passport_url_back?: string | null
          is_split_reservation?: boolean
          last_cleaning_notification_date?: string | null
          late_checkout_time?: string | null
          marriage_certificate_url?: string | null
          mid_stay_cleaning_completed?: boolean | null
          net_revenue?: number | null
          nights?: number | null
          notes?: string | null
          number_of_guests?: number
          parent_reservation_id?: string | null
          payment_method?: string | null
          preferred_language?: string | null
          price_per_night?: number | null
          property_id?: string | null
          settled?: string | null
          shuffle_log_id?: string | null
          shuffled_at?: string | null
          shuffled_from_unit_id?: string | null
          skip_channex_sync?: boolean
          source?: string
          status?: string
          survey_completed_at?: string | null
          survey_sent_at?: string | null
          total_price?: number | null
          unit_id?: string | null
          updated_at?: string
          vat_exempt?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_parent_reservation_id_fkey"
            columns: ["parent_reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_shuffle_log_id_fkey"
            columns: ["shuffle_log_id"]
            isOneToOne: false
            referencedRelation: "room_shuffle_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_shuffled_from_unit_id_fkey"
            columns: ["shuffled_from_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      room_shuffle_log: {
        Row: {
          change_type: string
          created_at: string
          id: string
          move_count: number
          moves: Json
          property_id: string | null
          reason: string | null
          room_type: string
          shuffle_date: string
          triggered_by_booking_id: string | null
          triggered_by_reference: string
        }
        Insert: {
          change_type?: string
          created_at?: string
          id?: string
          move_count?: number
          moves?: Json
          property_id?: string | null
          reason?: string | null
          room_type: string
          shuffle_date?: string
          triggered_by_booking_id?: string | null
          triggered_by_reference: string
        }
        Update: {
          change_type?: string
          created_at?: string
          id?: string
          move_count?: number
          moves?: Json
          property_id?: string | null
          reason?: string | null
          room_type?: string
          shuffle_date?: string
          triggered_by_booking_id?: string | null
          triggered_by_reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_shuffle_log_triggered_by_booking_id_fkey"
            columns: ["triggered_by_booking_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      room_type_photos: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_cover: boolean
          photo_url: string
          property_id: string
          room_type_name: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_cover?: boolean
          photo_url: string
          property_id: string
          room_type_name: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_cover?: boolean
          photo_url?: string
          property_id?: string
          room_type_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_type_photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      selection_accounts: {
        Row: {
          created_at: string | null
          created_by: string | null
          first_access_at: string | null
          id: string
          is_active: boolean | null
          kyc_link_id: string
          landing_page_token: string
          password_hash: string
          session_expires_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          first_access_at?: string | null
          id?: string
          is_active?: boolean | null
          kyc_link_id: string
          landing_page_token: string
          password_hash: string
          session_expires_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          first_access_at?: string | null
          id?: string
          is_active?: boolean | null
          kyc_link_id?: string
          landing_page_token?: string
          password_hash?: string
          session_expires_at?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "selection_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selection_accounts_kyc_link_id_fkey"
            columns: ["kyc_link_id"]
            isOneToOne: true
            referencedRelation: "kyc_links"
            referencedColumns: ["id"]
          },
        ]
      }
      slideshow_images: {
        Row: {
          blur_placeholder: string | null
          created_at: string
          id: string
          image_url: string
          image_url_lg: string | null
          image_url_md: string | null
          image_url_sm: string | null
          sequence_order: number
          updated_at: string
        }
        Insert: {
          blur_placeholder?: string | null
          created_at?: string
          id?: string
          image_url: string
          image_url_lg?: string | null
          image_url_md?: string | null
          image_url_sm?: string | null
          sequence_order: number
          updated_at?: string
        }
        Update: {
          blur_placeholder?: string | null
          created_at?: string
          id?: string
          image_url?: string
          image_url_lg?: string | null
          image_url_md?: string | null
          image_url_sm?: string | null
          sequence_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      stay_surveys: {
        Row: {
          amenities_rating: number | null
          cleanliness_rating: number | null
          created_at: string
          feedback: string | null
          id: string
          location_rating: number | null
          overall_rating: number
          reservation_id: string
          submitted_at: string
          value_rating: number | null
          would_recommend: boolean | null
        }
        Insert: {
          amenities_rating?: number | null
          cleanliness_rating?: number | null
          created_at?: string
          feedback?: string | null
          id?: string
          location_rating?: number | null
          overall_rating: number
          reservation_id: string
          submitted_at?: string
          value_rating?: number | null
          would_recommend?: boolean | null
        }
        Update: {
          amenities_rating?: number | null
          cleanliness_rating?: number | null
          created_at?: string
          feedback?: string | null
          id?: string
          location_rating?: number | null
          overall_rating?: number
          reservation_id?: string
          submitted_at?: string
          value_rating?: number | null
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "stay_surveys_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      summary_report_log: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          pdf_url: string | null
          property_id: string | null
          recipients: string[] | null
          report_date: string
          report_type: string
          sent_at: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          pdf_url?: string | null
          property_id?: string | null
          recipients?: string[] | null
          report_date: string
          report_type: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          pdf_url?: string | null
          property_id?: string | null
          recipients?: string[] | null
          report_date?: string
          report_type?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "summary_report_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          bookings_created: number | null
          bookings_skipped: number | null
          created_at: string | null
          created_by: string | null
          error_message: string | null
          id: string
          status: string
          sync_type: string
          trigger_type: string
        }
        Insert: {
          bookings_created?: number | null
          bookings_skipped?: number | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          status: string
          sync_type: string
          trigger_type: string
        }
        Update: {
          bookings_created?: number | null
          bookings_skipped?: number | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          status?: string
          sync_type?: string
          trigger_type?: string
        }
        Relationships: []
      }
      sync_status: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          last_sync_at: string | null
          refresh_token: string | null
          status: string
          sync_interval_minutes: number
          sync_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          last_sync_at?: string | null
          refresh_token?: string | null
          status?: string
          sync_interval_minutes?: number
          sync_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          last_sync_at?: string | null
          refresh_token?: string | null
          status?: string
          sync_interval_minutes?: number
          sync_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      ticket_surveys: {
        Row: {
          created_at: string
          feedback: string | null
          guest_account_id: string
          id: string
          rating: number
          reservation_id: string
          resolution_satisfaction: number | null
          response_time_satisfaction: number | null
          submitted_at: string
          ticket_id: string
          would_recommend: boolean | null
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          guest_account_id: string
          id?: string
          rating: number
          reservation_id: string
          resolution_satisfaction?: number | null
          response_time_satisfaction?: number | null
          submitted_at?: string
          ticket_id: string
          would_recommend?: boolean | null
        }
        Update: {
          created_at?: string
          feedback?: string | null
          guest_account_id?: string
          id?: string
          rating?: number
          reservation_id?: string
          resolution_satisfaction?: number | null
          response_time_satisfaction?: number | null
          submitted_at?: string
          ticket_id?: string
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_surveys_guest_account_id_fkey"
            columns: ["guest_account_id"]
            isOneToOne: false
            referencedRelation: "guest_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_surveys_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_surveys_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "guest_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_photos: {
        Row: {
          created_at: string
          display_order: number
          id: string
          photo_url: string
          unit_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          photo_url: string
          unit_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          photo_url?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_photos_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          address: string | null
          availability_date: string | null
          baths: number | null
          beds: number | null
          booking_com_id: string | null
          booking_com_name: string | null
          comments: string | null
          count_of_rooms: number | null
          created_at: string
          default_occupancy: number | null
          estimated_cleaning_minutes: number | null
          features: string[] | null
          id: string
          is_private: boolean | null
          latitude: number | null
          location: string | null
          longitude: number | null
          map_description: string | null
          max_children: number | null
          max_guests: number | null
          max_infants: number | null
          min_stay: number | null
          name: string
          payment_terms: string | null
          photos: string[] | null
          price_per_night: number | null
          property_id: string | null
          room_kind: string | null
          room_type_display_order: number
          show_on_website: boolean
          sofa_bed: boolean | null
          status: string
          tax_percentage: number | null
          unit_number: string | null
          unit_size: string | null
          unit_type: string | null
          updated_at: string
          view: string | null
          weekend_rate: number | null
        }
        Insert: {
          address?: string | null
          availability_date?: string | null
          baths?: number | null
          beds?: number | null
          booking_com_id?: string | null
          booking_com_name?: string | null
          comments?: string | null
          count_of_rooms?: number | null
          created_at?: string
          default_occupancy?: number | null
          estimated_cleaning_minutes?: number | null
          features?: string[] | null
          id?: string
          is_private?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          map_description?: string | null
          max_children?: number | null
          max_guests?: number | null
          max_infants?: number | null
          min_stay?: number | null
          name: string
          payment_terms?: string | null
          photos?: string[] | null
          price_per_night?: number | null
          property_id?: string | null
          room_kind?: string | null
          room_type_display_order?: number
          show_on_website?: boolean
          sofa_bed?: boolean | null
          status: string
          tax_percentage?: number | null
          unit_number?: string | null
          unit_size?: string | null
          unit_type?: string | null
          updated_at?: string
          view?: string | null
          weekend_rate?: number | null
        }
        Update: {
          address?: string | null
          availability_date?: string | null
          baths?: number | null
          beds?: number | null
          booking_com_id?: string | null
          booking_com_name?: string | null
          comments?: string | null
          count_of_rooms?: number | null
          created_at?: string
          default_occupancy?: number | null
          estimated_cleaning_minutes?: number | null
          features?: string[] | null
          id?: string
          is_private?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          map_description?: string | null
          max_children?: number | null
          max_guests?: number | null
          max_infants?: number | null
          min_stay?: number | null
          name?: string
          payment_terms?: string | null
          photos?: string[] | null
          price_per_night?: number | null
          property_id?: string | null
          room_kind?: string | null
          room_type_display_order?: number
          show_on_website?: boolean
          sofa_bed?: boolean | null
          status?: string
          tax_percentage?: number | null
          unit_number?: string | null
          unit_size?: string | null
          unit_type?: string | null
          updated_at?: string
          view?: string | null
          weekend_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_settings: {
        Row: {
          cancelled_booking_email: boolean
          checkin_email: boolean
          checkout_email: boolean
          created_at: string
          daily_summary_email: boolean
          id: string
          new_booking_email: boolean
          room_shuffle_email: boolean
          updated_at: string
          user_id: string
          weekly_monthly_summary_email: boolean
        }
        Insert: {
          cancelled_booking_email?: boolean
          checkin_email?: boolean
          checkout_email?: boolean
          created_at?: string
          daily_summary_email?: boolean
          id?: string
          new_booking_email?: boolean
          room_shuffle_email?: boolean
          updated_at?: string
          user_id: string
          weekly_monthly_summary_email?: boolean
        }
        Update: {
          cancelled_booking_email?: boolean
          checkin_email?: boolean
          checkout_email?: boolean
          created_at?: string
          daily_summary_email?: boolean
          id?: string
          new_booking_email?: boolean
          room_shuffle_email?: boolean
          updated_at?: string
          user_id?: string
          weekly_monthly_summary_email?: boolean
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          can_access_front_desk: boolean
          can_access_guest_inbox: boolean
          can_access_pms: boolean
          can_block_dates: boolean | null
          can_change_rooms: boolean | null
          can_check_in: boolean | null
          can_check_out: boolean | null
          can_create_booking: boolean | null
          can_delete_reservation: boolean
          can_export_calendar: boolean | null
          can_manage_rooms: boolean
          can_override_rates: boolean
          can_submit_forms: boolean | null
          can_view_revenue: boolean
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_access_front_desk?: boolean
          can_access_guest_inbox?: boolean
          can_access_pms?: boolean
          can_block_dates?: boolean | null
          can_change_rooms?: boolean | null
          can_check_in?: boolean | null
          can_check_out?: boolean | null
          can_create_booking?: boolean | null
          can_delete_reservation?: boolean
          can_export_calendar?: boolean | null
          can_manage_rooms?: boolean
          can_override_rates?: boolean
          can_submit_forms?: boolean | null
          can_view_revenue?: boolean
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_access_front_desk?: boolean
          can_access_guest_inbox?: boolean
          can_access_pms?: boolean
          can_block_dates?: boolean | null
          can_change_rooms?: boolean | null
          can_check_in?: boolean | null
          can_check_out?: boolean | null
          can_create_booking?: boolean | null
          can_delete_reservation?: boolean
          can_export_calendar?: boolean | null
          can_manage_rooms?: boolean
          can_override_rates?: boolean
          can_submit_forms?: boolean | null
          can_view_revenue?: boolean
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_property_access: {
        Row: {
          granted_at: string | null
          granted_by: string | null
          id: string
          property_id: string
          role: string
          user_id: string
        }
        Insert: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          property_id: string
          role?: string
          user_id: string
        }
        Update: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          property_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_property_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_property_access_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_property_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      whatsapp_message_log: {
        Row: {
          created_at: string
          error_message: string | null
          guest_name: string
          id: string
          message_body: string
          message_type: string
          phone_number: string
          property_id: string | null
          reservation_id: string | null
          sent_at: string
          status: string
          twilio_message_sid: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          guest_name: string
          id?: string
          message_body: string
          message_type: string
          phone_number: string
          property_id?: string | null
          reservation_id?: string | null
          sent_at?: string
          status?: string
          twilio_message_sid?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          guest_name?: string
          id?: string
          message_body?: string
          message_type?: string
          phone_number?: string
          property_id?: string | null
          reservation_id?: string | null
          sent_at?: string
          status?: string
          twilio_message_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_log_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_templates: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          message_body: string
          template_name: string
          template_type: string
          twilio_content_sid: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          message_body: string
          template_name: string
          template_type: string
          twilio_content_sid?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          message_body?: string
          template_name?: string
          template_type?: string
          twilio_content_sid?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_lock_unit_availability: {
        Args: {
          p_check_in_date: string
          p_check_out_date: string
          p_unit_id: string
        }
        Returns: {
          is_available: boolean
          unit_id: string
        }[]
      }
      check_reservation_overlap: {
        Args: {
          p_check_in_date: string
          p_check_out_date: string
          p_exclude_id?: string
          p_unit_id: string
        }
        Returns: {
          conflict_check_in: string
          conflict_check_out: string
          conflict_guest_names: string[]
          conflict_id: string
          conflict_reference: string
        }[]
      }
      delete_property_with_dependencies: {
        Args: { p_property_id: string }
        Returns: undefined
      }
      generate_guest_username: {
        Args: { p_first_name: string; p_last_name: string }
        Returns: string
      }
      get_all_users_with_emails: {
        Args: never
        Returns: {
          email: string
          full_name: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      get_units_by_booking_com_room_id: {
        Args: { p_room_id: string }
        Returns: {
          id: string
          last_allocated_at: string
          name: string
          status: string
          unit_number: string
        }[]
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_property_access: {
        Args: { _property_id: string; _user_id: string }
        Returns: boolean
      }
      has_property_role: {
        Args: { _property_id: string; _roles: string[]; _user_id: string }
        Returns: boolean
      }
      has_reservation_conflict: {
        Args: {
          p_check_in_date: string
          p_check_out_date: string
          p_exclude_id?: string
          p_unit_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_guest_session_valid: {
        Args: { p_reservation_id: string }
        Returns: boolean
      }
      is_system_admin: { Args: { _user_id: string }; Returns: boolean }
      notify_mid_stay_cleaning: { Args: never; Returns: undefined }
      reset_guest_password: {
        Args: { p_account_id: string; p_new_password_hash: string }
        Returns: boolean
      }
      swap_reservation_rooms: {
        Args: { reservation1_id: string; reservation2_id: string }
        Returns: undefined
      }
      update_reservation_status_on_checkin: {
        Args: { p_reservation_id: string }
        Returns: boolean
      }
      update_reservation_statuses: { Args: never; Returns: undefined }
      user_has_property_access: {
        Args: { property_uuid: string; required_role?: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "front_desk"
        | "housekeeping"
        | "manager"
        | "super_admin"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status: "open" | "in_progress" | "resolved" | "closed"
      ticket_type:
        | "not_working"
        | "broken"
        | "repair_needed"
        | "housekeeping"
        | "linen_change"
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
      app_role: [
        "admin",
        "front_desk",
        "housekeeping",
        "manager",
        "super_admin",
      ],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: ["open", "in_progress", "resolved", "closed"],
      ticket_type: [
        "not_working",
        "broken",
        "repair_needed",
        "housekeeping",
        "linen_change",
      ],
    },
  },
} as const
