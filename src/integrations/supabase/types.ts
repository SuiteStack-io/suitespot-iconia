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
      our_story_slideshow: {
        Row: {
          created_at: string
          id: string
          image_url: string
          sequence_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          sequence_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          sequence_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          adults: number | null
          booking_reference: string
          channel: string
          check_in_date: string
          check_out_date: string
          children: number | null
          commission_amount: number | null
          commission_rate: number | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          currency: string | null
          guest_ages: number[] | null
          guest_genders: string[] | null
          guest_names: string[]
          guest_nationality: string | null
          guest_types: string[] | null
          id: string
          id_passport_url: string | null
          id_passport_url_back: string | null
          marriage_certificate_url: string | null
          net_revenue: number | null
          nights: number | null
          notes: string | null
          number_of_guests: number
          price_per_night: number | null
          source: string
          status: string
          total_price: number | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          adults?: number | null
          booking_reference: string
          channel?: string
          check_in_date: string
          check_out_date: string
          children?: number | null
          commission_amount?: number | null
          commission_rate?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string | null
          guest_ages?: number[] | null
          guest_genders?: string[] | null
          guest_names?: string[]
          guest_nationality?: string | null
          guest_types?: string[] | null
          id?: string
          id_passport_url?: string | null
          id_passport_url_back?: string | null
          marriage_certificate_url?: string | null
          net_revenue?: number | null
          nights?: number | null
          notes?: string | null
          number_of_guests: number
          price_per_night?: number | null
          source?: string
          status: string
          total_price?: number | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          adults?: number | null
          booking_reference?: string
          channel?: string
          check_in_date?: string
          check_out_date?: string
          children?: number | null
          commission_amount?: number | null
          commission_rate?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string | null
          guest_ages?: number[] | null
          guest_genders?: string[] | null
          guest_names?: string[]
          guest_nationality?: string | null
          guest_types?: string[] | null
          id?: string
          id_passport_url?: string | null
          id_passport_url_back?: string | null
          marriage_certificate_url?: string | null
          net_revenue?: number | null
          nights?: number | null
          notes?: string | null
          number_of_guests?: number
          price_per_night?: number | null
          source?: string
          status?: string
          total_price?: number | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      slideshow_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          sequence_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          sequence_order: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          sequence_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      sync_status: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          last_sync_at: string | null
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
          status?: string
          sync_interval_minutes?: number
          sync_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          availability_date: string | null
          baths: number | null
          beds: number | null
          booking_com_id: string | null
          comments: string | null
          created_at: string
          id: string
          max_guests: number | null
          name: string
          photos: string[] | null
          price_per_night: number | null
          sofa_bed: boolean | null
          status: string
          tax_percentage: number | null
          unit_number: string | null
          unit_size: string | null
          unit_type: string | null
          updated_at: string
          view: string | null
        }
        Insert: {
          availability_date?: string | null
          baths?: number | null
          beds?: number | null
          booking_com_id?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          max_guests?: number | null
          name: string
          photos?: string[] | null
          price_per_night?: number | null
          sofa_bed?: boolean | null
          status: string
          tax_percentage?: number | null
          unit_number?: string | null
          unit_size?: string | null
          unit_type?: string | null
          updated_at?: string
          view?: string | null
        }
        Update: {
          availability_date?: string | null
          baths?: number | null
          beds?: number | null
          booking_com_id?: string | null
          comments?: string | null
          created_at?: string
          id?: string
          max_guests?: number | null
          name?: string
          photos?: string[] | null
          price_per_night?: number | null
          sofa_bed?: boolean | null
          status?: string
          tax_percentage?: number | null
          unit_number?: string | null
          unit_size?: string | null
          unit_type?: string | null
          updated_at?: string
          view?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_all_users_with_emails: {
        Args: never
        Returns: {
          email: string
          full_name: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
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
      app_role: "admin" | "front_desk" | "housekeeping" | "manager"
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
      app_role: ["admin", "front_desk", "housekeeping", "manager"],
    },
  },
} as const
