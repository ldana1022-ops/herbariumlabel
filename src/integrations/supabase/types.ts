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
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          id: string
          new_value: Json | null
          previous_value: Json | null
          record_id: string | null
          record_label: string | null
          session_info: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          record_id?: string | null
          record_label?: string | null
          session_info?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          record_id?: string | null
          record_label?: string | null
          session_info?: string | null
        }
        Relationships: []
      }
      herbarium_specimens: {
        Row: {
          accession_number: string
          altitude_m: number | null
          collection_date: string | null
          collectors: string | null
          created_at: string
          created_by: string | null
          determination: string | null
          determination_date: string | null
          determined_by: string | null
          family: string | null
          id: string
          image_url: string | null
          latitude: number | null
          local_name: string | null
          local_name_ar: string | null
          locality: string | null
          longitude: number | null
          notes: string | null
          region: string | null
          scientific_name: string
          serial_number: string
          status: Database["public"]["Enums"]["specimen_status"]
          updated_at: string
          visibility: Database["public"]["Enums"]["specimen_visibility"]
        }
        Insert: {
          accession_number: string
          altitude_m?: number | null
          collection_date?: string | null
          collectors?: string | null
          created_at?: string
          created_by?: string | null
          determination?: string | null
          determination_date?: string | null
          determined_by?: string | null
          family?: string | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          local_name?: string | null
          local_name_ar?: string | null
          locality?: string | null
          longitude?: number | null
          notes?: string | null
          region?: string | null
          scientific_name: string
          serial_number?: string
          status?: Database["public"]["Enums"]["specimen_status"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["specimen_visibility"]
        }
        Update: {
          accession_number?: string
          altitude_m?: number | null
          collection_date?: string | null
          collectors?: string | null
          created_at?: string
          created_by?: string | null
          determination?: string | null
          determination_date?: string | null
          determined_by?: string | null
          family?: string | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          local_name?: string | null
          local_name_ar?: string | null
          locality?: string | null
          longitude?: number | null
          notes?: string | null
          region?: string | null
          scientific_name?: string
          serial_number?: string
          status?: Database["public"]["Enums"]["specimen_status"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["specimen_visibility"]
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          body: string
          created_at: string
          id: string
          read_at: string | null
          record_id: string | null
          record_label: string | null
          request_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          record_id?: string | null
          record_label?: string | null
          request_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          record_id?: string | null
          record_label?: string | null
          request_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          last_login_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      public_access_throttle: {
        Row: {
          client_hash: string
          created_at: string
          endpoint: string
          hit_count: number
          id: string
          updated_at: string
          window_start: string
        }
        Insert: {
          client_hash: string
          created_at?: string
          endpoint: string
          hit_count?: number
          id?: string
          updated_at?: string
          window_start?: string
        }
        Update: {
          client_hash?: string
          created_at?: string
          endpoint?: string
          hit_count?: number
          id?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      request_samples: {
        Row: {
          created_at: string
          id: string
          request_id: string
          specimen_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          request_id: string
          specimen_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          request_id?: string
          specimen_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_samples_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_samples_specimen_id_fkey"
            columns: ["specimen_id"]
            isOneToOne: false
            referencedRelation: "herbarium_specimens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_samples_specimen_id_fkey"
            columns: ["specimen_id"]
            isOneToOne: false
            referencedRelation: "specimens_public"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          assigned_to: string
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          message: string | null
          request_number: string
          request_type: string
          specimen_id: string | null
          status: Database["public"]["Enums"]["request_status"]
          status_changed_at: string | null
          status_changed_by: string | null
          updated_at: string
        }
        Insert: {
          assigned_to: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          message?: string | null
          request_number?: string
          request_type: string
          specimen_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          status_changed_at?: string | null
          status_changed_by?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          message?: string | null
          request_number?: string
          request_type?: string
          specimen_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          status_changed_at?: string | null
          status_changed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_specimen_id_fkey"
            columns: ["specimen_id"]
            isOneToOne: false
            referencedRelation: "herbarium_specimens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_specimen_id_fkey"
            columns: ["specimen_id"]
            isOneToOne: false
            referencedRelation: "specimens_public"
            referencedColumns: ["id"]
          },
        ]
      }
      specimen_access: {
        Row: {
          created_at: string
          id: string
          specimen_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          specimen_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          specimen_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "specimen_access_specimen_id_fkey"
            columns: ["specimen_id"]
            isOneToOne: false
            referencedRelation: "herbarium_specimens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specimen_access_specimen_id_fkey"
            columns: ["specimen_id"]
            isOneToOne: false
            referencedRelation: "specimens_public"
            referencedColumns: ["id"]
          },
        ]
      }
      specimen_prints: {
        Row: {
          created_at: string
          first_printed_at: string
          id: string
          last_printed_at: string
          print_count: number
          printed_by: string | null
          serial_number: string | null
          specimen_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_printed_at?: string
          id?: string
          last_printed_at?: string
          print_count?: number
          printed_by?: string | null
          serial_number?: string | null
          specimen_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_printed_at?: string
          id?: string
          last_printed_at?: string
          print_count?: number
          printed_by?: string | null
          serial_number?: string | null
          specimen_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "specimen_prints_specimen_id_fkey"
            columns: ["specimen_id"]
            isOneToOne: true
            referencedRelation: "herbarium_specimens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specimen_prints_specimen_id_fkey"
            columns: ["specimen_id"]
            isOneToOne: true
            referencedRelation: "specimens_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          can_add: boolean
          can_change_status: boolean
          can_delete: boolean
          can_edit: boolean
          can_edit_labels: boolean
          can_edit_samples: boolean
          can_export: boolean
          can_import: boolean
          can_receive_requests: boolean
          can_send_requests: boolean
          created_at: string
          data_scope: Database["public"]["Enums"]["data_scope"]
          updated_at: string
          user_id: string
        }
        Insert: {
          can_add?: boolean
          can_change_status?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_edit_labels?: boolean
          can_edit_samples?: boolean
          can_export?: boolean
          can_import?: boolean
          can_receive_requests?: boolean
          can_send_requests?: boolean
          created_at?: string
          data_scope?: Database["public"]["Enums"]["data_scope"]
          updated_at?: string
          user_id: string
        }
        Update: {
          can_add?: boolean
          can_change_status?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_edit_labels?: boolean
          can_edit_samples?: boolean
          can_export?: boolean
          can_import?: boolean
          can_receive_requests?: boolean
          can_send_requests?: boolean
          created_at?: string
          data_scope?: Database["public"]["Enums"]["data_scope"]
          updated_at?: string
          user_id?: string
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
      user_session_prefs: {
        Row: {
          created_at: string
          idle_timeout_minutes: number | null
          remember_me: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          idle_timeout_minutes?: number | null
          remember_me?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          idle_timeout_minutes?: number | null
          remember_me?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      specimens_public: {
        Row: {
          family: string | null
          id: string | null
          locality: string | null
          region: string | null
          scientific_name: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["specimen_status"] | null
        }
        Insert: {
          family?: string | null
          id?: string | null
          locality?: string | null
          region?: string | null
          scientific_name?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["specimen_status"] | null
        }
        Update: {
          family?: string | null
          id?: string | null
          locality?: string | null
          region?: string | null
          scientific_name?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["specimen_status"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer"
      data_scope: "all" | "selected" | "own" | "admin_only"
      request_status: "pending" | "in_progress" | "completed" | "rejected"
      specimen_status:
        | "incomplete"
        | "in_progress"
        | "pending_review"
        | "completed"
        | "printed"
      specimen_visibility: "everyone" | "admin_only" | "selected_users"
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
      app_role: ["admin", "editor", "viewer"],
      data_scope: ["all", "selected", "own", "admin_only"],
      request_status: ["pending", "in_progress", "completed", "rejected"],
      specimen_status: [
        "incomplete",
        "in_progress",
        "pending_review",
        "completed",
        "printed",
      ],
      specimen_visibility: ["everyone", "admin_only", "selected_users"],
    },
  },
} as const
